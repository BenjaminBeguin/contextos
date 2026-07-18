// @prisma/client is CommonJS; under ESM the named export isn't statically
// detectable, so default-import the module object and destructure.
import pkg from "@prisma/client";

const { PrismaClient } = pkg;

// Startup diagnostic: show which database we'll connect to (password redacted).
// "(unset)" here means the root .env was not loaded — see load-env.ts.
const url = process.env.DATABASE_URL;
try {
  if (url) {
    const u = new URL(url);
    console.log(`[memmo] DB target: ${u.protocol}//${u.username}@${u.host}${u.pathname}`);
  } else {
    console.warn("[memmo] DATABASE_URL is (unset) — .env was not loaded");
  }
} catch {
  console.warn("[memmo] DATABASE_URL is malformed");
}

export const prisma = new PrismaClient();
