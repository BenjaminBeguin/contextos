import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import pkg from "@prisma/client";

// tsx does not auto-load .env; load it with override (cwd is the repo root for
// `pnpm db:seed`) so the project's DATABASE_URL wins over any stray shell var.
function loadEnv(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnv(".env");

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

// Fixed dev token so local verification (CLI/MCP) is reproducible.
export const DEV_TOKEN = "ctxos_dev_fixed_token_for_local_testing";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function main() {
  // --- Org A (dev user) ---------------------------------------------------
  const devUser = await prisma.user.upsert({
    where: { email: "dev@contextos.dev" },
    update: {},
    create: { email: "dev@contextos.dev", name: "Dev User" },
  });

  const acme = await prisma.workspace.upsert({
    where: { slug: "acme" },
    update: {},
    create: { name: "Acme Inc", slug: "acme", joinCode: "WS-ACME0001" },
  });

  await prisma.membership.upsert({
    where: { userId_workspaceId: { userId: devUser.id, workspaceId: acme.id } },
    update: {},
    create: { userId: devUser.id, workspaceId: acme.id, role: "owner" },
  });

  await prisma.apiToken.upsert({
    where: { hashedToken: hashToken(DEV_TOKEN) },
    update: { lastUsedAt: null },
    create: { userId: devUser.id, name: "local-dev", hashedToken: hashToken(DEV_TOKEN) },
  });

  // Recreate Acme's billing repo deterministically
  await prisma.repo.deleteMany({ where: { fullName: "acme/billing-api" } });
  const billingRepo = await prisma.repo.create({
    data: {
      workspaceId: acme.id,
      provider: "github",
      name: "billing-api",
      fullName: "acme/billing-api",
      defaultBranch: "main",
      stack: ["Node.js", "Fastify", "PostgreSQL", "Redis"],
      packageManager: "pnpm",
      notes: "Handles subscriptions and Stripe billing.",
    },
  });

  await prisma.memory.create({
    data: {
      repoId: billingRepo.id,
      type: "testing",
      title: "Use billing test command",
      content:
        "For billing changes, run `make test-billing` instead of the full test suite. The full suite times out.",
      scope: "repo",
      confidence: 0.86,
      status: "approved",
      source: "claude_code_session",
      evidence: {
        create: [
          {
            kind: "command_output",
            content:
              "Full test suite timed out. make test-billing completed successfully.",
          },
        ],
      },
    },
  });

  await prisma.memory.create({
    data: {
      repoId: billingRepo.id,
      type: "risk",
      title: "Stripe webhook idempotency",
      content:
        "Previous duplicate invoice outage was caused by missing webhook idempotency. Always check idempotency keys before editing webhook handlers. Do not edit invoices_v1 tables.",
      scope: "repo",
      confidence: 0.92,
      status: "approved",
      source: "incident_report",
    },
  });

  await prisma.memory.create({
    data: {
      repoId: billingRepo.id,
      type: "command",
      title: "Run migrations locally",
      content: "Use `pnpm db:migrate` after pulling schema changes.",
      scope: "repo",
      confidence: 0.7,
      status: "proposed",
      source: "claude_code_session",
    },
  });

  // --- Org B (separate user) for isolation testing ------------------------
  const otherUser = await prisma.user.upsert({
    where: { email: "other@globex.dev" },
    update: {},
    create: { email: "other@globex.dev", name: "Globex User" },
  });

  const globex = await prisma.workspace.upsert({
    where: { slug: "globex" },
    update: {},
    create: { name: "Globex Corp", slug: "globex", joinCode: "WS-GLOBEX01" },
  });

  await prisma.membership.upsert({
    where: { userId_workspaceId: { userId: otherUser.id, workspaceId: globex.id } },
    update: {},
    create: { userId: otherUser.id, workspaceId: globex.id, role: "owner" },
  });

  await prisma.repo.deleteMany({ where: { fullName: "globex/payments" } });
  const globexRepo = await prisma.repo.create({
    data: {
      workspaceId: globex.id,
      provider: "github",
      name: "payments",
      fullName: "globex/payments",
      defaultBranch: "main",
      stack: ["Go"],
      packageManager: "go modules",
    },
  });

  await prisma.memory.create({
    data: {
      repoId: globexRepo.id,
      type: "project_rule",
      title: "Globex-only secret",
      content: "This memory belongs to Globex and must never leak to Acme.",
      scope: "repo",
      confidence: 0.9,
      status: "approved",
    },
  });

  console.log("Seed complete.");
  console.log(`Dev user:        dev@contextos.dev`);
  console.log(`Dev token:       ${DEV_TOKEN}`);
  console.log(`Acme workspace:  ${acme.id} (join code ${acme.joinCode})`);
  console.log(`Acme repo:       ${billingRepo.id} (acme/billing-api)`);
  console.log(`Globex repo:     ${globexRepo.id} (globex/payments)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
