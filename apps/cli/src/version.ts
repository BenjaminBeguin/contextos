import { createRequire } from "node:module";

// Single source of truth for the CLI version: package.json. Avoids drift when
// bumping the version (just bump package.json).
const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

export const VERSION = pkg.version;
