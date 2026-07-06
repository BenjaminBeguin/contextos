import "./load-env.js";
import Fastify, { type FastifyError } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import { env } from "./env.js";
import { authRoutes } from "./routes/auth.js";
import { githubRoutes } from "./routes/github.js";
import { waitlistRoutes } from "./routes/waitlist.js";
import { workspaceRoutes } from "./routes/workspaces.js";
import { repoRoutes } from "./routes/repos.js";
import { reviewRoutes } from "./routes/reviews.js";
import { memoryRoutes } from "./routes/memories.js";
import { sessionRoutes } from "./routes/sessions.js";
import { docRoutes } from "./routes/docs.js";
import { mcpRoutes } from "./routes/mcp.js";
import { metricsRoutes } from "./routes/metrics.js";
import { graphRoutes } from "./routes/graph.js";
import { chatRoutes } from "./routes/chat.js";

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

await app.register(authRoutes);
await app.register(githubRoutes);
await app.register(waitlistRoutes);
await app.register(workspaceRoutes);
await app.register(repoRoutes);
await app.register(reviewRoutes);
await app.register(memoryRoutes);
await app.register(sessionRoutes);
await app.register(docRoutes);
await app.register(mcpRoutes);
await app.register(metricsRoutes);
await app.register(graphRoutes);
await app.register(chatRoutes);

app
  .listen({ port: env.port, host: "0.0.0.0" })
  .then(() => app.log.info(`Cortex API on :${env.port}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
