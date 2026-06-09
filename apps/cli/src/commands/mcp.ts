import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadCredentials, loadProjectConfig } from "../config.js";
import { apiFetch } from "../api.js";

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
  if (!creds) throw new Error("Not logged in. Run `contextos login` first.");
  if (!config) throw new Error("Repo not initialized. Run `contextos init` first.");

  const client = { baseUrl: config.apiBaseUrl ?? creds.apiBaseUrl, token: creds.token };

  const server = new McpServer({ name: "contextos", version: "0.1.0" });

  server.registerTool(
    "search_memory",
    {
      title: "Search ContextOS memory",
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
      title: "Get ContextOS repo context",
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

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
