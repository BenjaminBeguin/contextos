import type { FastifyInstance } from "fastify";
import { loginSchema, createTokenSchema } from "@contextos/shared";
import { prisma } from "../db.js";
import {
  SESSION_COOKIE,
  signSession,
  resolveUser,
  generateToken,
  hashToken,
} from "../auth.js";

export async function authRoutes(app: FastifyInstance) {
  // Email-only login (dev): find-or-create the user, set session cookie.
  app.post("/auth/login", async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.upsert({
      where: { email: body.email },
      update: body.name ? { name: body.name } : {},
      create: { email: body.email, name: body.name },
    });

    // Workspace-centric: users create or join a workspace explicitly after
    // login rather than getting an auto-provisioned personal one.
    const token = signSession(user.id);
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return { id: user.id, email: user.email, name: user.name };
  });

  app.post("/auth/logout", async (_req, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/me", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const memberships = await prisma.membership.findMany({
      where: { userId: user.id },
      include: { workspace: true },
    });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      workspaces: memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        joinCode: m.workspace.joinCode,
        role: m.role,
      })),
    };
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
}
