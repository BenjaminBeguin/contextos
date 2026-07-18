import type { FastifyInstance } from "fastify";
import { waitlistSchema } from "@memmo/shared";
import { prisma } from "../db.js";
import { rateLimit } from "../rate-limit.js";

export async function waitlistRoutes(app: FastifyInstance) {
  // Public endpoint: join the waitlist. Idempotent on email. Rate-limited.
  app.post(
    "/waitlist",
    { preHandler: rateLimit({ max: 10, windowMs: 60_000, key: "waitlist" }) },
    async (req, reply) => {
      const body = waitlistSchema.parse(req.body);
      const email = body.email.trim().toLowerCase();
      await prisma.waitlistSignup.upsert({
        where: { email },
        update: {},
        create: { email, source: body.source },
      });
      const count = await prisma.waitlistSignup.count();
      return reply.code(201).send({ ok: true, count });
    },
  );

  // Public count for social proof on the landing page.
  app.get("/waitlist/count", async () => {
    const count = await prisma.waitlistSignup.count();
    return { count };
  });
}
