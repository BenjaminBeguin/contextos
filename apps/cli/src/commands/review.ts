import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { loadCredentials, loadProjectConfig } from "../config.js";
import { apiFetch, type ApiClientOptions } from "../api.js";

interface ReviewFinding {
  severity: string;
  title: string;
  detail: string;
  path?: string;
  memory?: string;
}
interface ReviewDiffResult {
  skipped?: boolean;
  reason?: string;
  review?: { summary: string; findings: ReviewFinding[] };
  comment?: string;
}

export interface ReviewOptions {
  base?: string;
  title?: string;
  body?: string;
  out?: string;
  api?: string;
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

/** PR title/body from the GitHub Actions event payload, when running in CI. */
function prMetaFromEvent(): { title?: string; body?: string } {
  const p = process.env.GITHUB_EVENT_PATH;
  if (!p || !existsSync(p)) return {};
  try {
    const ev = JSON.parse(readFileSync(p, "utf8")) as {
      pull_request?: { title?: string; body?: string | null };
    };
    return { title: ev.pull_request?.title, body: ev.pull_request?.body ?? undefined };
  } catch {
    return {};
  }
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

  const ev = prMetaFromEvent();
  const prTitle = (opts.title ?? ev.title ?? git(["log", "-1", "--pretty=%s"]).trim()).slice(0, 500);
  const prBody = opts.body ?? ev.body;

  const res = await apiFetch<ReviewDiffResult>(client, `/repos/${config.repoId}/review-diff`, {
    method: "POST",
    body: JSON.stringify({ prTitle, prBody, diff }),
  });

  if (res.skipped) {
    console.error("Cortex reviewer is disabled for this repo — skipping (enable it in the dashboard).");
    return; // No output file written → the CI step's hashFiles guard skips posting.
  }

  const comment = res.comment ?? "";
  if (opts.out) {
    writeFileSync(opts.out, comment);
    console.error(`Wrote review to ${opts.out} (${res.review?.findings.length ?? 0} findings).`);
  }
  process.stdout.write(comment + "\n");
}
