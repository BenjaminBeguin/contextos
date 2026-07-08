// Generate docs/api-reference.md from the Fastify route registrations.
// Scans apps/api/src/routes/*.ts for `app.<method>("<path>", ...)` and the
// leading `// comment`, grouping by file. Run: node scripts/gen-api-docs.mjs
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const routesDir = join(root, "apps/api/src/routes");
const METHOD_RE = /app\.(get|post|patch|put|delete)\(\s*[`"']([^`"']+)[`"']/;

const groups = [];
for (const file of readdirSync(routesDir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
  const lines = readFileSync(join(routesDir, file), "utf8").split("\n");
  const routes = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(METHOD_RE);
    if (!m) continue;
    // Collect the contiguous `//` comment block immediately above the route.
    const comment = [];
    for (let j = i - 1; j >= 0; j--) {
      const t = lines[j].trim();
      if (t.startsWith("//")) comment.unshift(t.replace(/^\/\/\s?/, ""));
      else if (t === "") break;
      else break;
    }
    routes.push({ method: m[1].toUpperCase(), path: m[2], desc: comment.join(" ") });
  }
  if (routes.length) groups.push({ file: file.replace(/\.ts$/, ""), routes });
}

const total = groups.reduce((n, g) => n + g.routes.length, 0);
const out = [
  "# API reference",
  "",
  "> Generated from `apps/api/src/routes/*.ts` by `scripts/gen-api-docs.mjs`.",
  "> Don't edit by hand — re-run the script after changing routes.",
  "",
  `${total} endpoints. All app endpoints authenticate via a session cookie or a \`Bearer\` API token; MCP/CLI use the token. Admin endpoints require a superadmin (\`SUPERADMIN_EMAILS\`).`,
  "",
];
for (const g of groups.sort((a, b) => a.file.localeCompare(b.file))) {
  out.push(`## ${g.file}`, "");
  out.push("| Method | Path | Description |", "| --- | --- | --- |");
  for (const r of g.routes) {
    out.push(`| \`${r.method}\` | \`${r.path}\` | ${r.desc || "—"} |`);
  }
  out.push("");
}
writeFileSync(join(root, "docs/api-reference.md"), out.join("\n"));
console.log(`Wrote docs/api-reference.md — ${total} endpoints across ${groups.length} route files.`);
