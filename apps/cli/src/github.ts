/**
 * Shared GitHub Actions helpers used by `cortex review` and `cortex review-sync`:
 * reading the PR event, resolving the Actions context, and a thin authenticated
 * GitHub REST client.
 */
import { readFileSync, existsSync } from "node:fs";

export function readEvent(): { title?: string; body?: string; prNumber?: number } {
  const p = process.env.GITHUB_EVENT_PATH;
  if (!p || !existsSync(p)) return {};
  try {
    const ev = JSON.parse(readFileSync(p, "utf8")) as {
      pull_request?: { title?: string; body?: string | null; number?: number };
      number?: number;
    };
    return {
      title: ev.pull_request?.title,
      body: ev.pull_request?.body ?? undefined,
      prNumber: ev.pull_request?.number ?? ev.number,
    };
  } catch {
    return {};
  }
}

export interface GhContext {
  repo: string;
  pr: number;
  token: string;
}

export function ghContext(prFromEvent?: number): GhContext | null {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  let pr = prFromEvent;
  if (!pr) {
    const m = (process.env.GITHUB_REF ?? "").match(/refs\/pull\/(\d+)\//);
    if (m) pr = parseInt(m[1]!, 10);
  }
  if (!repo || !token || !pr) return null;
  return { repo, pr, token };
}

export async function gh<T>(ctx: GhContext, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${ctx.token}`,
      accept: "application/vnd.github+json",
      "user-agent": "cortex",
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : null) as T;
}
