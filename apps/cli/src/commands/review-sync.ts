import { loadCredentials, loadProjectConfig } from "../config.js";
import { apiFetch, type ApiClientOptions } from "../api.js";
import { extractMarkers } from "../github-review.js";
import { readEvent, ghContext, gh, type GhContext } from "../github.js";
import type { ReviewFeedback } from "@memmo/shared";

export interface ReviewSyncOptions {
  api?: string;
}

interface GhComment {
  id: number;
  body: string;
}

interface GhReaction {
  content: string;
}

/**
 * Map a comment's reactions to a single feedback verdict. 👍 wins over 👎 when both are
 * present; returns null when neither is set (nothing to sync).
 */
function verdictFromReactions(reactions: GhReaction[]): ReviewFeedback | null {
  let up = false;
  let down = false;
  for (const r of reactions) {
    if (r.content === "+1") up = true;
    else if (r.content === "-1") down = true;
  }
  if (up) return "accepted";
  if (down) return "dismissed";
  return null;
}

/** Read GitHub 👍/👎 reactions on Memmo review comments and push them back as feedback. */
export async function reviewSyncCommand(opts: ReviewSyncOptions = {}) {
  const config = loadProjectConfig();
  if (!config) {
    throw new Error("Repo not initialized. Run `memmo init` and commit .memmo/config.json.");
  }
  const creds = loadCredentials();
  const token = process.env.MEMMO_TOKEN ?? creds?.token;
  if (!token) throw new Error("No API token. Set MEMMO_TOKEN (CI) or run `memmo login`.");
  const baseUrl = opts.api ?? process.env.MEMMO_API_URL ?? config.apiBaseUrl ?? creds?.apiBaseUrl;
  if (!baseUrl) throw new Error("No API base URL. Set MEMMO_API_URL or pass --api.");
  const client: ApiClientOptions = { baseUrl, token };

  const ev = readEvent();
  const ctx = ghContext(ev.prNumber);
  if (!ctx) {
    throw new Error(
      "review-sync needs GitHub Actions context (GITHUB_REPOSITORY, a PR event or refs/pull/<n>, and GH_TOKEN/GITHUB_TOKEN).",
    );
  }

  const comments = await listReviewComments(ctx);
  const items: { key: string; feedback: ReviewFeedback }[] = [];
  for (const c of comments) {
    const keys = extractMarkers([c.body ?? ""]);
    if (keys.size === 0) continue;
    const reactions = await gh<GhReaction[]>(
      ctx,
      `/repos/${ctx.repo}/pulls/comments/${c.id}/reactions?per_page=100`,
    ).catch(() => [] as GhReaction[]);
    const feedback = verdictFromReactions(reactions);
    if (!feedback) continue;
    for (const key of keys) items.push({ key, feedback });
  }

  if (items.length === 0) {
    console.error("Memmo: no 👍/👎 reactions on Memmo review comments — nothing to sync.");
    return;
  }

  const res = await apiFetch<{ updated: number }>(
    client,
    `/repos/${config.repoId}/review-feedback`,
    { method: "POST", body: JSON.stringify({ items }) },
  );
  const accepted = items.filter((i) => i.feedback === "accepted").length;
  const dismissed = items.length - accepted;
  console.error(
    `Memmo: synced ${res.updated}/${items.length} finding(s) (${accepted} accepted, ${dismissed} dismissed).`,
  );
}

/** List the PR's review (inline) comments — Memmo findings carry a dedup marker. */
async function listReviewComments(ctx: GhContext): Promise<GhComment[]> {
  return gh<GhComment[]>(ctx, `/repos/${ctx.repo}/pulls/${ctx.pr}/comments?per_page=100`).catch(
    () => [] as GhComment[],
  );
}
