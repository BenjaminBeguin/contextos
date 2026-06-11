import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { loginSchema, createTokenSchema } from "@contextos/shared";
import { prisma } from "../db.js";
import { env } from "../env.js";
import {
  SESSION_COOKIE,
  signSession,
  resolveUser,
  generateToken,
  hashToken,
} from "../auth.js";
import { encryptToken } from "../crypto.js";

const OAUTH_STATE_COOKIE = "contextos_oauth_state";
// `repo` lets the dashboard list the user's repositories (incl. private).
const GITHUB_SCOPE = "repo read:user user:email";

function setSession(reply: import("fastify").FastifyReply, userId: string) {
  reply.setCookie(SESSION_COOKIE, signSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  email: string | null;
}

async function exchangeCodeForToken(code: string, state: string): Promise<string> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: env.github.clientId,
      client_secret: env.github.clientSecret,
      code,
      redirect_uri: `${env.apiBaseUrl}/auth/github/callback`,
      state,
    }),
  });
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(data.error ?? "token exchange failed");
  return data.access_token;
}

async function fetchGitHubIdentity(token: string): Promise<{ user: GitHubUser; email: string | null }> {
  const headers = {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "user-agent": "contextos",
  };
  const user = (await (await fetch("https://api.github.com/user", { headers })).json()) as GitHubUser;
  let email = user.email;
  if (!email) {
    const emails = (await (
      await fetch("https://api.github.com/user/emails", { headers })
    ).json()) as { email: string; primary: boolean; verified: boolean }[];
    email = emails.find((e) => e.primary && e.verified)?.email ?? emails[0]?.email ?? null;
  }
  return { user, email };
}

export async function authRoutes(app: FastifyInstance) {
  // --- GitHub OAuth -------------------------------------------------------
  app.get("/auth/github/login", async (_req, reply) => {
    if (!env.github.configured) {
      return reply.code(503).send({ error: "GitHub OAuth is not configured" });
    }
    const state = randomBytes(16).toString("hex");
    reply.setCookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.isProd,
      path: "/",
      maxAge: 600,
    });
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", env.github.clientId);
    url.searchParams.set("redirect_uri", `${env.apiBaseUrl}/auth/github/callback`);
    url.searchParams.set("scope", GITHUB_SCOPE);
    url.searchParams.set("state", state);
    return reply.redirect(url.toString());
  });

  app.get("/auth/github/callback", async (req, reply) => {
    const { code, state } = req.query as { code?: string; state?: string };
    const cookieState = (req.cookies as Record<string, string | undefined>)[OAUTH_STATE_COOKIE];
    reply.clearCookie(OAUTH_STATE_COOKIE, { path: "/" });

    if (!code || !state || !cookieState || state !== cookieState) {
      return reply.redirect(`${env.appUrl}/login?error=oauth_state`);
    }
    try {
      const accessToken = await exchangeCodeForToken(code, state);
      const { user: gh, email } = await fetchGitHubIdentity(accessToken);
      const githubId = String(gh.id);
      const displayName = gh.name ?? gh.login;
      const encrypted = encryptToken(accessToken);

      let user = await prisma.user.findUnique({ where: { githubId } });
      if (!user && email) user = await prisma.user.findUnique({ where: { email } });

      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            githubId,
            avatarUrl: gh.avatar_url,
            name: user.name ?? displayName,
            githubAccessToken: encrypted,
          },
        });
      } else {
        user = await prisma.user.create({
          data: {
            githubId,
            email: email ?? `${gh.login}@users.noreply.github.com`,
            name: displayName,
            avatarUrl: gh.avatar_url,
            githubAccessToken: encrypted,
          },
        });
      }

      setSession(reply, user.id);
      return reply.redirect(`${env.appUrl}/dashboard`);
    } catch {
      return reply.redirect(`${env.appUrl}/login?error=oauth`);
    }
  });

  // --- Dev email login (non-production only) ------------------------------
  app.post("/auth/login", async (req, reply) => {
    if (!env.allowDevLogin) {
      return reply.code(403).send({ error: "Email login is disabled. Use GitHub." });
    }
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.upsert({
      where: { email: body.email },
      update: body.name ? { name: body.name } : {},
      create: { email: body.email, name: body.name },
    });
    setSession(reply, user.id);
    return { id: user.id, email: user.email, name: user.name };
  });

  app.post("/auth/logout", async (_req, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  // Expose which auth methods are available so the login UI can adapt.
  app.get("/auth/config", async () => ({
    github: env.github.configured,
    devLogin: env.allowDevLogin,
  }));

  app.get("/me", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const [memberships, ghStatus] = await Promise.all([
      prisma.membership.findMany({ where: { userId: user.id }, include: { workspace: true } }),
      prisma.user.findUnique({
        where: { id: user.id },
        select: { githubId: true, githubAccessToken: true },
      }),
    ]);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      github: Boolean(ghStatus?.githubId),
      githubConnected: Boolean(ghStatus?.githubAccessToken),
      workspaces: memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        joinCode: m.workspace.joinCode,
        role: m.role,
      })),
    };
  });

  // List the user's API tokens (never returns the raw/hashed token).
  app.get("/auth/tokens", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    return prisma.apiToken.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, lastUsedAt: true, createdAt: true },
    });
  });

  // Mint an API token for CLI/MCP use. Returns the raw token once.
  app.post("/auth/tokens", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const body = createTokenSchema.parse(req.body ?? {});
    const raw = generateToken();
    await prisma.apiToken.create({
      data: { userId: user.id, name: body.name, hashedToken: hashToken(raw) },
    });
    return { token: raw, name: body.name };
  });

  // Revoke an API token.
  app.delete("/auth/tokens/:tokenId", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { tokenId } = req.params as { tokenId: string };
    const token = await prisma.apiToken.findUnique({ where: { id: tokenId } });
    if (!token || token.userId !== user.id) {
      return reply.code(404).send({ error: "Token not found" });
    }
    await prisma.apiToken.delete({ where: { id: tokenId } });
    return { ok: true };
  });
}
