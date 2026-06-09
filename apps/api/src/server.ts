import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import { env } from "./env.js";
import { authRoutes } from "./routes/auth.js";
import { workspaceRoutes } from "./routes/workspaces.js";
import { repoRoutes } from "./routes/repos.js";
import { memoryRoutes } from "./routes/memories.js";
import { mcpRoutes } from "./routes/mcp.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: [env.webOrigin],
  credentials: true,
});
await app.register(cookie);

app.setErrorHandler((error, _req, reply) => {
  if (error instanceof ZodError) {
    return reply.code(400).send({ error: "ValidationError", issues: error.issues });
  }
  app.log.error(error);
  return reply.code(error.statusCode ?? 500).send({ error: error.message });
});

app.get("/health", async () => ({ ok: true }));

await app.register(authRoutes);
await app.register(workspaceRoutes);
await app.register(repoRoutes);
await app.register(memoryRoutes);
await app.register(mcpRoutes);

app
  .listen({ port: env.port, host: "0.0.0.0" })
  .then(() => app.log.info(`ContextOS API on :${env.port}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
