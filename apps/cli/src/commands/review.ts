import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { loadCredentials, loadProjectConfig } from "../config.js";
import { apiFetch, type ApiClientOptions } from "../api.js";
import {
  parseDiffNewLines,
  buildReviewPayload,
  extractMarkers,
  type Finding,
} from "../github-review.js";
import { readEvent, ghContext, gh, type GhContext } from "../github.js";

interface ReviewDiffResult {
  skipped?: boolean;
  reason?: string;
  review?: { summary: string; findings: Finding[] };
  comment?: string;
}

export interface ReviewOptions {
  base?: string;
  title?: string;
  body?: string;
  out?: string;
  api?: string;
  post?: boolean;
}

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

/** Diff the PR branch against its base. Prefers the remote ref (present in CI with fetch-depth:0). */
function computeDiff(base: string): string {
  for (const ref of [`origin/${base}`, base]) {
    try {
      git(["rev-parse", "--verify", "--quiet", ref]);
      return git(["diff", `${ref}...HEAD`]);
    } catch {
      /* try next candidate */
    }
  }
  try {
    return git(["diff", "HEAD~1...HEAD"]);
  } catch {
    return "";
  }
}

/** Post a PR review with inline comments, deduping against findings already posted. */
async function postInlineReview(
  ctx: GhContext,
  diff: string,
  review: { summary: string; findings: Finding[] },
): Promise<void> {
  const commentable = parseDiffNewLines(diff);
  const existing = await gh<{ body: string }[]>(
    ctx,
    `/repos/${ctx.repo}/pulls/${ctx.pr}/comments?per_page=100`,
  ).catch(() => [] as { body: string }[]);
  const existingKeys = extractMarkers(existing.map((c) => c.body ?? ""));

  const payload = buildReviewPayload(review.summary, review.findings, commentable, existingKeys);
  if (payload.newCount === 0 && existingKeys.size > 0) {
    console.error("Cortex: no new findings since the last review — nothing to post.");
    return;
  }
  await gh(ctx, `/repos/${ctx.repo}/pulls/${ctx.pr}/reviews`, {
    method: "POST",
    body: JSON.stringify({ body: payload.body, event: payload.event, comments: payload.comments }),
  });
  console.error(
    `Cortex: posted review (${payload.comments.length} inline, ${payload.newCount} new findings).`,
  );
}

export async function reviewCommand(opts: ReviewOptions = {}) {
  const config = loadProjectConfig();
  if (!config) {
    throw new Error("Repo not initialized. Run `cortex init` and commit .cortex/config.json.");
  }
  const creds = loadCredentials();
  const token = process.env.CORTEX_TOKEN ?? creds?.token;
  if (!token) throw new Error("No API token. Set CORTEX_TOKEN (CI) or run `cortex login`.");
  const baseUrl = opts.api ?? process.env.CORTEX_API_URL ?? config.apiBaseUrl ?? creds?.apiBaseUrl;
  if (!baseUrl) throw new Error("No API base URL. Set CORTEX_API_URL or pass --api.");
  const client: ApiClientOptions = { baseUrl, token };

  const base = opts.base ?? process.env.GITHUB_BASE_REF ?? "main";
  const diff = computeDiff(base).slice(0, 380000);
  if (!diff.trim()) {
    console.error(`No diff detected against base "${base}" — nothing to review.`);
    return;
  }

  const ev = readEvent();
  const prTitle = (opts.title ?? ev.title ?? git(["log", "-1", "--pretty=%s"]).trim()).slice(0, 500);
  const prBody = opts.body ?? ev.body;

  const res = await apiFetch<ReviewDiffResult>(client, `/repos/${config.repoId}/review-diff`, {
    method: "POST",
    body: JSON.stringify({ prTitle, prBody, diff }),
  });

  if (res.skipped) {
    console.error("Cortex reviewer is disabled for this repo — skipping (enable it in the dashboard).");
    return;
  }
  const comment = res.comment ?? "";

  if (opts.post) {
    const ctx = ghContext(ev.prNumber);
    if (!ctx) {
      console.error(
        "--post needs GitHub Actions context (GITHUB_REPOSITORY, a PR event, and GH_TOKEN/GITHUB_TOKEN). Falling back to markdown output.",
      );
    } else if (res.review) {
      try {
        await postInlineReview(ctx, diff, res.review);
        return;
      } catch (e) {
        console.error(
          `Cortex: inline review failed (${(e as Error).message}); posting a summary comment instead.`,
        );
        await gh(ctx, `/repos/${ctx.repo}/issues/${ctx.pr}/comments`, {
          method: "POST",
          body: JSON.stringify({ body: comment }),
        });
        return;
      }
    }
  }

  if (opts.out) {
    writeFileSync(opts.out, comment);
    console.error(`Wrote review to ${opts.out} (${res.review?.findings.length ?? 0} findings).`);
  }
  process.stdout.write(comment + "\n");
}
