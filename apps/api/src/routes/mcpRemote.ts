import type { FastifyInstance, FastifyRequest } from "fastify";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { prisma } from "../db.js";
import { resolveUser, hashToken, type AuthedUser } from "../auth.js";
import { listReposForUser, resolveRepoForUser } from "../services/repoResolve.js";
import { toolSearchMemory, toolRepoContext, toolRelevantWarnings, type ToolRepo } from "../services/mcpTools.js";

/**
 * Remote MCP connector — the same memory tools over Streamable HTTP so a hosted
 * URL can be added in Claude Code (`claude mcp add --transport http`) or Desktop.
 * A remote server has no working directory, so tools take a `repo` identifier
 * (git remote / owner/repo) that we resolve to a repo the caller can access.
 * Authenticated by an account-wide API token in the Authorization header.
 */

/** The project scope of the presented token (null = account-wide). */
async function tokenScope(req: FastifyRequest): Promise<string | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  const token = await prisma.apiToken.findUnique({
    where: { hashedToken: hashToken(auth.slice(7).trim()) },
    select: { workspaceId: true },
  });
  return token?.workspaceId ?? null;
}

const REPO_ARG = z
  .string()
  .describe("This repo's git remote or owner/name, e.g. 'BenjaminBeguin/contextos'. Call list_repos if unsure.");

function textResult(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload) }] };
}

function buildServer(user: AuthedUser, scope: string | null): McpServer {
  const server = new McpServer({ name: "cortex", version: "1.0.0" });

  async function repoRow(identifier: string): Promise<ToolRepo | null> {
    const resolved = await resolveRepoForUser(user.id, identifier, scope);
    if (!resolved) return null;
    const repo = await prisma.repo.findUnique({
      where: { id: resolved.repoId },
      select: { id: true, workspaceId: true, stack: true, packageManager: true, notes: true },
    });
    return repo;
  }

  const notFound = (identifier: string) =>
    textResult({
      error: `No connected repo matched "${identifier}". Call list_repos to see available repos.`,
    });

  server.registerTool(
    "list_repos",
    {
      title: "List Cortex repos",
      description: "List the repos this token can access (id, owner/name, project). Use to find the repo identifier.",
      inputSchema: {},
    },
    async () => textResult({ repos: await listReposForUser(user.id, scope) }),
  );

  server.registerTool(
    "search_memory",
    {
      title: "Search Cortex memory",
      description: "Search approved operational memories (conventions, risks, commands, decisions) for a repo.",
      inputSchema: { repo: REPO_ARG, query: z.string().describe("What to search for"), limit: z.number().optional() },
    },
    async ({ repo, query, limit }) => {
      const r = await repoRow(repo);
      if (!r) return notFound(repo);
      return textResult(await toolSearchMemory(r, query, limit ?? 10));
    },
  );

  server.registerTool(
    "get_repo_context",
    {
      title: "Get repo context",
      description: "Stack, package manager, key commands, and known risks for a repo. Call before starting work.",
      inputSchema: { repo: REPO_ARG },
    },
    async ({ repo }) => {
      const r = await repoRow(repo);
      if (!r) return notFound(repo);
      return textResult(await toolRepoContext(r));
    },
  );

  server.registerTool(
    "get_relevant_warnings",
    {
      title: "Get relevant warnings",
      description: "Risk/failure memories for the files you're about to edit. Call before editing sensitive files.",
      inputSchema: { repo: REPO_ARG, files: z.array(z.string()).describe("Paths about to be edited") },
    },
    async ({ repo, files }) => {
      const r = await repoRow(repo);
      if (!r) return notFound(repo);
      return textResult(await toolRelevantWarnings(r, files));
    },
  );

  return server;
}

export async function mcpRemoteRoutes(app: FastifyInstance) {
  app.post("/mcp", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) {
      return reply.code(401).send({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unauthorized — provide a Cortex API token" },
        id: null,
      });
    }
    const scope = await tokenScope(req);
    const server = buildServer(user, scope);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    reply.hijack();
    reply.raw.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req.raw, reply.raw, req.body);
  });
}
