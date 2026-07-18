// Bundle the CLI into a single self-contained ESM file so the published npm
// package does not depend on the private @memmo/shared workspace package.
// Real runtime deps stay external (resolved from the CLI's own node_modules);
// @memmo/shared is inlined so findingKey/severities stay a single source of truth.
import { build } from "esbuild";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
// Everything in dependencies is a real npm dep and must stay external.
const external = Object.keys(pkg.dependencies ?? {});

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  external,
  // The entry (src/index.ts) already starts with a shebang; esbuild preserves it.
  logLevel: "info",
});
