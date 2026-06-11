import type { FastifyReply, FastifyRequest } from "fastify";

interface Bucket {
  count: number;
  resetAt: number;
}

// In-memory fixed-window limiter. Single-instance only; swap for Redis if the
// API is ever scaled horizontally.
const store = new Map<string, Bucket>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) if (v.resetAt < now) store.delete(k);
}, 60_000).unref();

/** Returns a Fastify preHandler that limits a route to `max` requests per IP per window. */
export function rateLimit({
  max,
  windowMs,
  key = "rl",
}: {
  max: number;
  windowMs: number;
  key?: string;
}) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const id = `${key}:${req.ip}`;
    const now = Date.now();
    let bucket = store.get(id);
    if (!bucket || bucket.resetAt < now) {
      bucket = { count: 0, resetAt: now + windowMs };
      store.set(id, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      reply.header("retry-after", String(Math.ceil((bucket.resetAt - now) / 1000)));
      return reply.code(429).send({ error: "Too many requests. Please slow down." });
    }
  };
}
