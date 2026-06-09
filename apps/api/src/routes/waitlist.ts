import type { FastifyInstance } from "fastify";
import { waitlistSchema } from "@contextos/shared";
import { prisma } from "../db.js";

export async function waitlistRoutes(app: FastifyInstance) {
  // Public endpoint: join the waitlist. Idempotent on email.
  app.post("/waitlist", async (req, reply) => {
    const body = waitlistSchema.parse(req.body);
    const email = body.email.trim().toLowerCase();
    await prisma.waitlistSignup.upsert({
      where: { email },
      update: {},
      create: { email, source: body.source },
    });
    const count = await prisma.waitlistSignup.count();
    return reply.code(201).send({ ok: true, count });
  });

  // Public count for social proof on the landing page.
  app.get("/waitlist/count", async () => {
    const count = await prisma.waitlistSignup.count();
    return { count };
  });
}
