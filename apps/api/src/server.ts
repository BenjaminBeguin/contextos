import "./load-env.js";
import Fastify, { type FastifyError } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import { env } from "./env.js";
import { authRoutes } from "./routes/auth.js";
import { githubRoutes } from "./routes/github.js";
import { waitlistRoutes } from "./routes/waitlist.js";
import { orgRoutes } from "./routes/orgs.js";
import { workspaceRoutes } from "./routes/workspaces.js";
import { repoRoutes } from "./routes/repos.js";
import { reviewRoutes } from "./routes/reviews.js";
import { memoryRoutes } from "./routes/memories.js";
import { sessionRoutes } from "./routes/sessions.js";
import { docRoutes } from "./routes/docs.js";
import { mcpRoutes } from "./routes/mcp.js";
import { mcpRemoteRoutes } from "./routes/mcpRemote.js";
import { metricsRoutes } from "./routes/metrics.js";
import { graphRoutes } from "./routes/graph.js";
import { chatRoutes } from "./routes/chat.js";
import { adminRoutes } from "./routes/admin.js";
import { auditRoutes } from "./routes/audit.js";
import { stripeRoutes } from "./routes/stripe.js";
import { githubWebhookRoutes } from "./routes/githubWebhook.js";
import { enforceTokenScope } from "./auth.js";

// trustProxy so req.ip reflects the real client behind Railway's proxy (used by rate limiting).
const app = Fastify({ logger: true, trustProxy: true });

await app.register(cors, {
  origin: env.allowedOrigins,
  credentials: true,
});
await app.register(cookie);

app.setErrorHandler((error: FastifyError, _req, reply) => {
  if (error instanceof ZodError) {
    return reply.code(400).send({ error: "ValidationError", issues: error.issues });
  }
  app.log.error(error);
  return reply.code(error.statusCode ?? 500).send({ error: error.message });
});

app.get("/health", async () => ({ ok: true }));

// Confine project-scoped API tokens to their workspace (no-op for cookie
// sessions and account-wide tokens). Runs after body parsing so it can also
// inspect a `repoId` in the request body (the MCP routes).
app.addHook("preHandler", enforceTokenScope);

await app.register(authRoutes);
await app.register(githubRoutes);
await app.register(waitlistRoutes);
await app.register(orgRoutes);
await app.register(workspaceRoutes);
await app.register(repoRoutes);
await app.register(reviewRoutes);
await app.register(memoryRoutes);
await app.register(sessionRoutes);
await app.register(docRoutes);
await app.register(mcpRoutes);
await app.register(mcpRemoteRoutes);
await app.register(metricsRoutes);
await app.register(graphRoutes);
await app.register(chatRoutes);
await app.register(adminRoutes);
await app.register(auditRoutes);
await app.register(stripeRoutes);
await app.register(githubWebhookRoutes);

app
  .listen({ port: env.port, host: "0.0.0.0" })
  .then(() => app.log.info(`Memmo API on :${env.port}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
