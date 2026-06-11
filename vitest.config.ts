import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Source uses NodeNext-style ".js" extensions in TS imports; resolve to .ts.
    extensionAlias: {
      ".js": [".ts", ".tsx", ".js"],
    },
  },
  test: {
    environment: "node",
    include: ["apps/**/src/**/*.test.ts", "packages/**/src/**/*.test.ts"],
  },
});
