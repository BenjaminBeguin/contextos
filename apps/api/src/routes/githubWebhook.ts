import type { FastifyInstance } from "fastify";
import { env } from "../env.js";
import { prisma } from "../db.js";
import { extractMemories } from "../services/extract.js";
import { getWorkspaceLlm } from "../services/llm.js";
import { recordUsage } from "../services/analytics.js";
import { loadDedupSet, partitionNew } from "../services/dedup.js";
import { getAutoThresholds, statusFor } from "../services/memory.js";
import { redactSecrets } from "../services/sanitize.js";
import {
  verifyGithubSignature,
  isMergedPr,
  prToSessionInput,
  type PullRequestPayload,
} from "../services/githubPr.js";

/**
 * GitHub webhook — merged PRs become proposed memory automatically, so the
 * "what changed and why" stays current without a manual scan. Its own plugin so
 * the raw-body parser (needed for signature verification) is scoped here.
 * Configure a repo/org webhook → POST /github/webhook, event: Pull requests,
 * content type application/json, secret = GITHUB_WEBHOOK_SECRET.
 */
export async function githubWebhookRoutes(app: FastifyInstance) {
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) =>
    done(null, body),
  );

  app.post("/github/webhook", async (req, reply) => {
    if (!env.github.webhookSecret) return reply.code(400).send({ error: "webhook_not_configured" });
    const raw = req.body as Buffer;
    if (!verifyGithubSignature(env.github.webhookSecret, raw, req.headers["x-hub-signature-256"] as string | undefined)) {
      return reply.code(401).send({ error: "signature_verification_failed" });
    }

    let payload: PullRequestPayload;
    try {
      payload = JSON.parse(raw.toString("utf8"));
    } catch {
      return reply.code(400).send({ error: "invalid_json" });
    }

    const event = req.headers["x-github-event"] as string | undefined;
    if (!isMergedPr(event, payload)) return { ignored: true }; // ping, non-merge, etc.

    const fullName = payload.repository?.full_name;
    const input = prToSessionInput(payload);
    if (!fullName || !input) return { ignored: true };

    // A repo may be connected in more than one project — capture into each.
    const repos = await prisma.repo.findMany({ where: { fullName }, select: { id: true, workspaceId: true } });
    let created = 0;
    for (const repo of repos) {
      const llm = await getWorkspaceLlm(repo.workspaceId);
      const extracted = await extractMemories(input, llm);
      const { fresh } = partitionNew(await loadDedupSet(repo.id), extracted);
      const thresholds = await getAutoThresholds(repo.workspaceId);
      for (const m of fresh) {
        await prisma.memory.create({
          data: {
            repoId: repo.id,
            type: m.type,
            title: redactSecrets(m.title),
            content: redactSecrets(m.content),
            scope: "repo",
            confidence: m.confidence,
            status: statusFor(thresholds, m.confidence),
            source: "github_pr",
            evidence: m.evidence
              ? { create: [{ kind: "github_pr", content: redactSecrets(m.evidence) }] }
              : undefined,
          },
        });
        created++;
      }
      await recordUsage("github.pr_merged", {
        workspaceId: repo.workspaceId,
        repoId: repo.id,
        metadata: { pr: payload.pull_request?.number, proposed: fresh.length },
      });
    }

    return { received: true, repos: repos.length, proposed: created };
  });
}
