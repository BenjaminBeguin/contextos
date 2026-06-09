// Spawns the built ContextOS MCP server over stdio and calls search_memory.
// Usage: node scripts/mcp-smoke.mjs
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["apps/cli/dist/index.js", "mcp"],
});

const client = new Client({ name: "smoke", version: "0.0.1" });
await client.connect(transport);

const tools = await client.listTools();
console.log("Tools:", tools.tools.map((t) => t.name).join(", "));

const result = await client.callTool({
  name: "search_memory",
  arguments: { query: "billing" },
});
const text = result.content.map((c) => c.text).join("\n");
console.log("--- search_memory(billing) ---");
console.log(text);

await client.close();

if (!/test-billing/i.test(text)) {
  console.error("FAIL: expected approved billing memory in MCP result");
  process.exit(1);
}
console.log("PASS: MCP returned the approved billing memory");
