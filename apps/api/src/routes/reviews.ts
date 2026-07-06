import type { FastifyInstance } from "fastify";
import { reviewFeedbackSchema, reviewFeedbackBulkSchema } from "@cortex/shared";
import { prisma } from "../db.js";
import { resolveUser, assertRepoAccess, HttpError } from "../auth.js";
import { applyFindingFeedback, applyBulkFeedbackByKey, toReviewDTO } from "../services/feedback.js";

export async function reviewRoutes(app: FastifyInstance) {
  // List a repo's persisted reviews (newest first), each with its findings.
  app.get("/repos/:repoId/reviews", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { repoId } = req.params as { repoId: string };
    try {
      await assertRepoAccess(user.id, repoId);
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    const q = req.query as { limit?: string; offset?: string };
    const limit = Math.min(Math.max(parseInt(q.limit ?? "20", 10) || 20, 1), 100);
    const offset = Math.max(parseInt(q.offset ?? "0", 10) || 0, 0);
    const [reviews, total] = await Promise.all([
      prisma.prReview.findMany({
        where: { repoId },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: { findings: { orderBy: { createdAt: "asc" } } },
      }),
      prisma.prReview.count({ where: { repoId } }),
    ]);
    return { reviews: reviews.map(toReviewDTO), total };
  });

  // Fetch a single persisted review (authorized via its repo).
  app.get("/reviews/:reviewId", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { reviewId } = req.params as { reviewId: string };
    const review = await prisma.prReview.findUnique({
      where: { id: reviewId },
      include: { findings: { orderBy: { createdAt: "asc" } } },
    });
    if (!review) return reply.code(404).send({ error: "Review not found" });
    try {
      await assertRepoAccess(user.id, review.repoId);
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    return toReviewDTO(review);
  });

  // Give feedback on a single finding; may adjust the grounding memory's confidence.
  app.post("/findings/:findingId/feedback", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { findingId } = req.params as { findingId: string };
    const finding = await prisma.prReviewFinding.findUnique({
      where: { id: findingId },
      select: { review: { select: { repoId: true } } },
    });
    if (!finding) return reply.code(404).send({ error: "Finding not found" });
    try {
      await assertRepoAccess(user.id, finding.review.repoId);
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    const body = reviewFeedbackSchema.parse(req.body);
    return applyFindingFeedback(findingId, body.feedback, user.id);
  });

  // Bulk feedback keyed by finding dedup key (used by `cortex review-sync`).
  app.post("/repos/:repoId/review-feedback", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { repoId } = req.params as { repoId: string };
    try {
      await assertRepoAccess(user.id, repoId);
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    const body = reviewFeedbackBulkSchema.parse(req.body);
    return applyBulkFeedbackByKey(repoId, body.items, user.id);
  });
}
