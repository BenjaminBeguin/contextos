import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadCredentials, loadProjectConfig } from "../config.js";
import { apiFetch } from "../api.js";
import { VERSION } from "../version.js";

interface SearchResult {
  memories: { type: string; title: string; content: string; confidence: number }[];
}

interface RepoContextResult {
  repoContext: { stack: string[]; packageManager: string | null; notes: string | null };
  warnings: string[];
  recommendedCommands: string[];
}

export async function mcpCommand() {
  const creds = loadCredentials();
  const config = loadProjectConfig();
  if (!creds) throw new Error("Not logged in. Run `cortex login` first.");
  if (!config) throw new Error("Repo not initialized. Run `cortex init` first.");

  const client = { baseUrl: config.apiBaseUrl ?? creds.apiBaseUrl, token: creds.token };

  const server = new McpServer({ name: "cortex", version: VERSION });

  server.registerTool(
    "search_memory",
    {
      title: "Search Cortex memory",
      description:
        "Search approved operational memories for the connected repo (conventions, risks, commands, decisions).",
      inputSchema: { query: z.string().describe("What to search for"), limit: z.number().optional() },
    },
    async ({ query, limit }) => {
      const result = await apiFetch<SearchResult>(client, "/mcp/search_memory", {
        method: "POST",
        body: JSON.stringify({ repoId: config.repoId, query: query ?? "", limit: limit ?? 10 }),
      });
      const text =
        result.memories.length === 0
          ? "No relevant approved memories found."
          : result.memories
              .map((m) => `- [${m.type}] ${m.title}\n  ${m.content}`)
              .join("\n");
      return { content: [{ type: "text", text }] };
    },
  );

  server.registerTool(
    "get_repo_context",
    {
      title: "Get Cortex repo context",
      description:
        "Retrieve the stack, package manager, known risks/warnings, and recommended commands for the connected repo.",
      inputSchema: {},
    },
    async () => {
      const result = await apiFetch<RepoContextResult>(client, "/mcp/get_repo_context", {
        method: "POST",
        body: JSON.stringify({ repoId: config.repoId }),
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    "get_relevant_warnings",
    {
      title: "Get Cortex risk warnings for files",
      description:
        "Before editing files, get risk/failure warnings that apply to them (past outages, gotchas). Call with the file paths you're about to modify.",
      inputSchema: {
        files: z.array(z.string()).describe("Repo-relative paths you're about to edit"),
      },
    },
    async ({ files }) => {
      const result = await apiFetch<{
        warnings: { type: string; title: string; content: string; paths: string[] }[];
      }>(client, "/mcp/get_relevant_warnings", {
        method: "POST",
        body: JSON.stringify({ repoId: config.repoId, files }),
      });
      const text =
        result.warnings.length === 0
          ? "No known risks for these files."
          : result.warnings
              .map((w) => `⚠ [${w.type}] ${w.title}\n  ${w.content}`)
              .join("\n");
      return { content: [{ type: "text", text }] };
    },
  );

  server.registerTool(
    "record_session_summary",
    {
      title: "Record a Cortex session summary",
      description:
        "Submit a summary of the work you just did so Cortex can propose new memories for review. Call this at the end of a meaningful task.",
      inputSchema: {
        task: z.string().optional().describe("What the task was"),
        summary: z.string().optional().describe("What happened: decisions, findings, outcomes"),
        filesChanged: z.array(z.string()).optional(),
        commandsRun: z.array(z.string()).optional(),
        errors: z.array(z.string()).optional(),
      },
    },
    async (args) => {
      const result = await apiFetch<{ proposedCount: number }>(client, `/repos/${config.repoId}/sessions`, {
        method: "POST",
        body: JSON.stringify(args),
      });
      return {
        content: [
          {
            type: "text",
            text: `Session recorded. ${result.proposedCount} memory proposal(s) created for review in Cortex.`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "propose_memories",
    {
      title: "Propose Cortex memories",
      description:
        "Record durable, reusable knowledge you discovered (conventions, architecture, commands, risks, gotchas) as PROPOSED memories for human review. Use this to bootstrap a repo — read its key files (README, configs, manifests, schema, entry points) and propose memories — or any time you learn something a future agent should know. Add file globs in `paths` for risk/area-specific memories.",
      inputSchema: {
        memories: z.array(
          z.object({
            type: z.enum([
              "project_rule",
              "architecture",
              "command",
              "workflow",
              "decision",
              "failure",
              "risk",
              "dependency",
              "testing",
              "deployment",
              "business_context",
            ]),
            title: z.string(),
            content: z.string(),
            confidence: z.number().min(0).max(1).optional(),
            paths: z.array(z.string()).optional(),
            evidence: z.string().optional(),
          }),
        ),
      },
    },
    async ({ memories }) => {
      const result = await apiFetch<{ proposedCount: number }>(
        client,
        `/repos/${config.repoId}/proposals`,
        { method: "POST", body: JSON.stringify({ memories }) },
      );
      return {
        content: [
          {
            type: "text",
            text: `Proposed ${result.proposedCount} memory(ies) for review in Cortex.`,
          },
        ],
      };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
