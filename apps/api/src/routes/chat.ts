import type { FastifyInstance } from "fastify";
import { chatSchema } from "@cortex/shared";
import { prisma } from "../db.js";
import { resolveUser, assertWorkspaceAccess, HttpError } from "../auth.js";
import { complete, getWorkspaceKey } from "../services/llm.js";
import { rateLimit } from "../rate-limit.js";

const SYSTEM = `You are Cortex, answering questions about a software team's repositories.
Use ONLY the provided memory snippets. Be concise and practical. Reference the memories you
used by their title in **bold**. If the snippets don't contain the answer, say so plainly —
do not invent facts.`;

function score(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  return terms.reduce((acc, t) => acc + (lower.includes(t) ? 1 : 0), 0);
}

export async function chatRoutes(app: FastifyInstance) {
  app.post(
    "/workspaces/:workspaceId/chat",
    { preHandler: rateLimit({ max: 30, windowMs: 60_000, key: "chat" }) },
    async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { workspaceId } = req.params as { workspaceId: string };
    try {
      await assertWorkspaceAccess(user.id, workspaceId);
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    const { message } = chatSchema.parse(req.body);

    const repos = await prisma.repo.findMany({
      where: { workspaceId },
      select: { id: true, fullName: true },
    });
    const repoIds = repos.map((r) => r.id);
    const repoName = new Map(repos.map((r) => [r.id, r.fullName]));

    const memories = await prisma.memory.findMany({
      where: { repoId: { in: repoIds }, status: "approved" },
      select: { id: true, repoId: true, type: true, title: true, content: true, confidence: true },
      take: 500,
    });

    const terms = message.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    const ranked = memories
      .map((m) => ({ m, s: score(`${m.title} ${m.content}`, terms) }))
      .sort((a, b) => b.s - a.s || b.m.confidence - a.m.confidence)
      .slice(0, 8);
    const top = (ranked.some((r) => r.s > 0) ? ranked.filter((r) => r.s > 0) : ranked.slice(0, 5)).map(
      (r) => r.m,
    );

    const sources = top.map((m) => ({
      id: m.id,
      title: m.title,
      type: m.type,
      repoId: m.repoId,
      repo: repoName.get(m.repoId) ?? "",
    }));

    if (top.length === 0) {
      return {
        answer: "There are no approved memories in this workspace yet, so I can't answer from your data. Approve some memories first.",
        sources: [],
      };
    }

    const context = top
      .map((m) => `- [${m.type}] ${m.title} (${repoName.get(m.repoId)}): ${m.content}`)
      .join("\n");

    const apiKey = await getWorkspaceKey(workspaceId);
    if (!apiKey) {
      return {
        answer:
          "AI answers are off — add an Anthropic API key in workspace settings. Most relevant memories:\n\n" +
          context,
        sources,
      };
    }

    try {
      const answer = await complete(
        apiKey,
        SYSTEM,
        `Question: ${message}\n\nMemories:\n${context}`,
        1024,
      );
      return { answer: answer.trim(), sources };
    } catch {
      return {
        answer: "I couldn't reach the AI service. Relevant memories:\n\n" + context,
        sources,
      };
    }
    },
  );
}
