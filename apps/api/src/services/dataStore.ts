import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { prisma } from "../db.js";
import { decryptToken } from "../crypto.js";
import { redactSecrets } from "./sanitize.js";

/**
 * Bring-your-own-database (data residency). When a workspace connects its own
 * Postgres, that project's memories are stored in the customer's database
 * instead of the shared control plane. We keep only metadata (status, the
 * encrypted URL) in the control plane; the memory rows live in the MemmoMemory
 * table we provision on the customer's DB.
 *
 * The external table is standalone (no cross-database foreign keys — those
 * can't span databases); repoId/workspaceId are plain indexed columns and the
 * app enforces referential integrity.
 */

const DDL = `
CREATE TABLE IF NOT EXISTS "MemmoMemory" (
  "id"          TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "repoId"      TEXT NOT NULL,
  "type"        TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "content"     TEXT NOT NULL,
  "paths"       TEXT[] NOT NULL DEFAULT '{}',
  "scope"       TEXT NOT NULL DEFAULT 'repo',
  "confidence"  DOUBLE PRECISION NOT NULL DEFAULT 0.7,
  "status"      TEXT NOT NULL DEFAULT 'proposed',
  "source"      TEXT,
  "usageCount"  INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "lastUsedAt"  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "MemmoMemory_repo_status_idx" ON "MemmoMemory" ("repoId", "status");
CREATE INDEX IF NOT EXISTS "MemmoMemory_ws_idx" ON "MemmoMemory" ("workspaceId");
`;

/** Plain, relation-free shape both the shared and external stores return. */
export interface MemoryRow {
  id: string;
  repoId: string;
  workspaceId: string;
  type: string;
  title: string;
  content: string;
  paths: string[];
  scope: string;
  confidence: number;
  status: string;
  source: string | null;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date | null;
  /** External store keeps memory content only, not evidence rows — always []. */
  evidence: { id: string; kind: string; content: string }[];
}

// One PrismaClient per external URL, cached. Keyed by the (encrypted) URL so a
// config change naturally produces a new client.
const clients = new Map<string, PrismaClient>();

function clientFor(url: string): PrismaClient {
  let c = clients.get(url);
  if (!c) {
    c = new PrismaClient({ datasources: { db: { url } } });
    clients.set(url, c);
  }
  return c;
}

/** Drop and disconnect a cached client (on disconnect / URL change). */
export async function dropExternalClient(encryptedUrl: string): Promise<void> {
  const url = decryptToken(encryptedUrl);
  if (!url) return;
  const c = clients.get(url);
  if (c) {
    clients.delete(url);
    await c.$disconnect().catch(() => {});
  }
}

/** Connect and run a trivial query — used to validate a URL before saving. */
export async function testConnection(url: string): Promise<{ ok: boolean; error?: string }> {
  const c = new PrismaClient({ datasources: { db: { url } } });
  try {
    await c.$queryRawUnsafe("SELECT 1");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Connection failed" };
  } finally {
    await c.$disconnect().catch(() => {});
  }
}

/** Connect and ensure the MemmoMemory table exists (idempotent). */
export async function provisionExternalStore(url: string): Promise<{ ok: boolean; error?: string }> {
  const c = clientFor(url);
  try {
    // executeRawUnsafe runs one statement at a time; split the DDL script.
    for (const stmt of DDL.split(";").map((s) => s.trim()).filter(Boolean)) {
      await c.$executeRawUnsafe(stmt);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Provisioning failed" };
  }
}

/** The external client for a workspace, or null if it isn't using BYODB. */
export async function getExternalClient(workspaceId: string): Promise<PrismaClient | null> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { externalDbUrl: true, externalDbStatus: true },
  });
  if (!ws?.externalDbUrl || ws.externalDbStatus !== "connected") return null;
  const url = decryptToken(ws.externalDbUrl);
  if (!url) return null;
  return clientFor(url);
}

/** Row mapper: raw SQL returns snake-free quoted columns already matching MemoryRow. */
function toRow(r: Record<string, unknown>): MemoryRow {
  return {
    id: String(r.id),
    repoId: String(r.repoId),
    workspaceId: String(r.workspaceId),
    type: String(r.type),
    title: String(r.title),
    content: String(r.content),
    paths: (r.paths as string[]) ?? [],
    scope: String(r.scope ?? "repo"),
    confidence: Number(r.confidence ?? 0.7),
    status: String(r.status),
    source: r.source == null ? null : String(r.source),
    usageCount: Number(r.usageCount ?? 0),
    createdAt: new Date(r.createdAt as string),
    updatedAt: new Date(r.updatedAt as string),
    lastUsedAt: r.lastUsedAt == null ? null : new Date(r.lastUsedAt as string),
    evidence: [],
  };
}

export interface CreateMemoryInput {
  repoId: string;
  workspaceId: string;
  type: string;
  title: string;
  content: string;
  paths?: string[];
  scope?: string;
  confidence?: number;
  status?: string;
  source?: string | null;
}

/** Raw-SQL memory store backed by the customer's Postgres. */
export class ExternalMemoryStore {
  constructor(private readonly c: PrismaClient) {}

  async create(input: CreateMemoryInput): Promise<MemoryRow> {
    const id = `cm_${randomUUID().replace(/-/g, "")}`;
    const rows = (await this.c.$queryRawUnsafe(
      `INSERT INTO "MemmoMemory"
        ("id","workspaceId","repoId","type","title","content","paths","scope","confidence","status","source")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      id,
      input.workspaceId,
      input.repoId,
      input.type,
      redactSecrets(input.title),
      redactSecrets(input.content),
      input.paths ?? [],
      input.scope ?? "repo",
      input.confidence ?? 0.7,
      input.status ?? "proposed",
      input.source ?? null,
    )) as Record<string, unknown>[];
    return toRow(rows[0]!);
  }

  async findById(id: string): Promise<MemoryRow | null> {
    const rows = (await this.c.$queryRawUnsafe(
      `SELECT * FROM "MemmoMemory" WHERE "id" = $1 LIMIT 1`,
      id,
    )) as Record<string, unknown>[];
    return rows[0] ? toRow(rows[0]) : null;
  }

  async listByRepos(
    repoIds: string[],
    opts: { status?: string; type?: string } = {},
  ): Promise<MemoryRow[]> {
    if (repoIds.length === 0) return [];
    const params: unknown[] = [repoIds];
    let sql = `SELECT * FROM "MemmoMemory" WHERE "repoId" = ANY($1)`;
    if (opts.status) {
      params.push(opts.status);
      sql += ` AND "status" = $${params.length}`;
    }
    if (opts.type) {
      params.push(opts.type);
      sql += ` AND "type" = $${params.length}`;
    }
    sql += ` ORDER BY "updatedAt" DESC`;
    const rows = (await this.c.$queryRawUnsafe(sql, ...params)) as Record<string, unknown>[];
    return rows.map(toRow);
  }

  async countByRepos(repoIds: string[], opts: { status?: string } = {}): Promise<number> {
    if (repoIds.length === 0) return 0;
    const params: unknown[] = [repoIds];
    let sql = `SELECT COUNT(*)::int AS n FROM "MemmoMemory" WHERE "repoId" = ANY($1)`;
    if (opts.status) {
      params.push(opts.status);
      sql += ` AND "status" = $${params.length}`;
    }
    const rows = (await this.c.$queryRawUnsafe(sql, ...params)) as { n: number }[];
    return rows[0]?.n ?? 0;
  }

  async search(opts: {
    repoId: string;
    query: string;
    limit: number;
    approvedOnly?: boolean;
    countUsage?: boolean;
  }): Promise<MemoryRow[]> {
    const params: unknown[] = [opts.repoId];
    let sql = `SELECT * FROM "MemmoMemory" WHERE "repoId" = $1`;
    if (opts.approvedOnly) sql += ` AND "status" = 'approved'`;
    const q = opts.query.trim();
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND ("title" ILIKE $${params.length} OR "content" ILIKE $${params.length})`;
    }
    params.push(opts.limit);
    sql += ` ORDER BY "confidence" DESC, "updatedAt" DESC LIMIT $${params.length}`;
    const rows = (await this.c.$queryRawUnsafe(sql, ...params)) as Record<string, unknown>[];
    const out = rows.map(toRow);
    if (out.length > 0) {
      await this.markRetrieved(out.map((m) => m.id), opts.countUsage ?? false);
    }
    return out;
  }

  async markRetrieved(ids: string[], countUsage: boolean): Promise<void> {
    if (ids.length === 0) return;
    const inc = countUsage ? `, "usageCount" = "usageCount" + 1` : "";
    await this.c.$executeRawUnsafe(
      `UPDATE "MemmoMemory" SET "lastUsedAt" = now()${inc} WHERE "id" = ANY($1)`,
      ids,
    );
  }

  async setStatus(id: string, status: string): Promise<MemoryRow> {
    const rows = (await this.c.$queryRawUnsafe(
      `UPDATE "MemmoMemory" SET "status" = $2, "updatedAt" = now() WHERE "id" = $1 RETURNING *`,
      id,
      status,
    )) as Record<string, unknown>[];
    return toRow(rows[0]!);
  }

  async archiveMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.c.$executeRawUnsafe(
      `UPDATE "MemmoMemory" SET "status" = 'archived', "updatedAt" = now() WHERE "id" = ANY($1)`,
      ids,
    );
  }

  async update(
    id: string,
    patch: { title?: string; content?: string; type?: string; confidence?: number; paths?: string[] },
  ): Promise<MemoryRow> {
    const sets: string[] = [];
    const params: unknown[] = [id];
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      params.push(v);
      sets.push(`"${k}" = $${params.length}`);
    }
    sets.push(`"updatedAt" = now()`);
    const rows = (await this.c.$queryRawUnsafe(
      `UPDATE "MemmoMemory" SET ${sets.join(", ")} WHERE "id" = $1 RETURNING *`,
      ...params,
    )) as Record<string, unknown>[];
    return toRow(rows[0]!);
  }
}
