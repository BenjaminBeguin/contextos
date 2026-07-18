import { loadCredentials, loadProjectConfig } from "../config.js";
import { apiFetch, type ApiClientOptions } from "../api.js";

/**
 * Record a project decision — what changed and why — as an approved `decision`
 * memory, so it becomes durable context future agents retrieve.
 */
export async function decisionCommand(text: string[], opts: { why?: string } = {}) {
  const creds = loadCredentials();
  const config = loadProjectConfig();
  if (!creds) throw new Error("Not logged in. Run `memmo login` first.");
  if (!config) throw new Error("Repo not initialized. Run `memmo init` first.");

  const title = text.join(" ").trim();
  if (!title) {
    throw new Error('Usage: memmo decision "what changed" [--why "the reason"]');
  }

  const client: ApiClientOptions = {
    baseUrl: config.apiBaseUrl ?? creds.apiBaseUrl,
    token: creds.token,
  };
  const content = opts.why ? `${title}\n\nWhy: ${opts.why}` : title;

  await apiFetch(client, `/repos/${config.repoId}/memories`, {
    method: "POST",
    body: JSON.stringify({
      type: "decision",
      title: title.slice(0, 140),
      content,
      status: "approved",
      source: "cli_decision",
      confidence: 0.9,
    }),
  });

  console.log(`Recorded decision: ${title}`);
}
