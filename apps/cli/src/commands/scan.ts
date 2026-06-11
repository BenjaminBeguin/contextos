import { loadCredentials, loadProjectConfig } from "../config.js";
import { apiFetch } from "../api.js";

interface ScanResult {
  proposedCount: number;
  filesRead?: number;
}

export async function scanCommand() {
  const creds = loadCredentials();
  const config = loadProjectConfig();
  if (!creds) throw new Error("Not logged in. Run `cortex login` first.");
  if (!config) throw new Error("Repo not initialized. Run `cortex init` first.");

  const client = { baseUrl: config.apiBaseUrl ?? creds.apiBaseUrl, token: creds.token };

  console.log("Scanning the repo from GitHub…");
  const result = await apiFetch<ScanResult>(client, `/repos/${config.repoId}/scan`, {
    method: "POST",
  });

  const from = result.filesRead != null ? ` (read ${result.filesRead} files)` : "";
  console.log(
    `Proposed ${result.proposedCount} memory(ies)${from}. Review them in the Cortex inbox.`,
  );
}
