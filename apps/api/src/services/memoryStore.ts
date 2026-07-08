import { prisma } from "../db.js";
import {
  ExternalMemoryStore,
  getExternalClient,
  type MemoryRow,
  type CreateMemoryInput,
} from "./dataStore.js";

/**
 * The memory data-access layer. For an ordinary workspace this is the shared
 * control-plane Postgres; for a workspace using bring-your-own-database it is
 * the customer's own Postgres (ExternalMemoryStore). Routing every memory
 * read/write through here keeps a BYODB project's memories consistently in one
 * place — no split brain between the two databases.
 */
export interface MemoryStore {
  readonly external: boolean;
  create(input: CreateMemoryInput & { evidence?: { kind: string; content: string }[] }): Promise<MemoryRow>;
  findById(id: string): Promise<MemoryRow | null>;
  listByRepo(repoId: string, opts?: { status?: string; type?: string }): Promise<MemoryRow[]>;
  listByRepos(repoIds: string[], opts?: { status?: string; type?: string }): Promise<MemoryRow[]>;
  countByRepos(repoIds: string[], opts?: { status?: string }): Promise<number>;
  search(opts: {
    repoId: string;
    query: string;
    limit: number;
    approvedOnly?: boolean;
    countUsage?: boolean;
  }): Promise<MemoryRow[]>;
  setStatus(id: string, status: string): Promise<MemoryRow>;
  archiveMany(ids: string[]): Promise<void>;
  update(
    id: string,
    patch: { title?: string; content?: string; type?: string; confidence?: number; paths?: string[] },
  ): Promise<MemoryRow>;
}

type PrismaMemory = {
  id: string;
  repoId: string;
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
  evidence?: { id: string; kind: string; content: string }[];
};

function mapPrisma(m: PrismaMemory, workspaceId: string): MemoryRow {
  return {
    id: m.id,
    repoId: m.repoId,
    workspaceId,
    type: m.type,
    title: m.title,
    content: m.content,
    paths: m.paths,
    scope: m.scope,
    confidence: m.confidence,
    status: m.status,
    source: m.source,
    usageCount: m.usageCount,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    lastUsedAt: m.lastUsedAt,
    evidence: (m.evidence ?? []).map((e) => ({ id: e.id, kind: e.kind, content: e.content })),
  };
}

/** Shared control-plane store — the default. Preserves evidence rows. */
class SharedMemoryStore implements MemoryStore {
  readonly external = false;
  constructor(private readonly workspaceId: string) {}

  async create(
    input: CreateMemoryInput & { evidence?: { kind: string; content: string }[] },
  ): Promise<MemoryRow> {
    const m = await prisma.memory.create({
      data: {
        repoId: input.repoId,
        type: input.type,
        title: input.title,
        content: input.content,
        paths: input.paths ?? [],
        scope: input.scope ?? "repo",
        confidence: input.confidence ?? 0.7,
        status: input.status ?? "proposed",
        source: input.source ?? undefined,
        evidence: input.evidence?.length ? { create: input.evidence } : undefined,
      },
      include: { evidence: true },
    });
    return mapPrisma(m, this.workspaceId);
  }

  async findById(id: string): Promise<MemoryRow | null> {
    const m = await prisma.memory.findUnique({ where: { id }, include: { evidence: true } });
    return m ? mapPrisma(m, this.workspaceId) : null;
  }

  async listByRepo(repoId: string, opts: { status?: string; type?: string } = {}): Promise<MemoryRow[]> {
    const rows = await prisma.memory.findMany({
      where: { repoId, status: opts.status, type: opts.type },
      orderBy: { updatedAt: "desc" },
      include: { evidence: true },
    });
    return rows.map((m) => mapPrisma(m, this.workspaceId));
  }

  async listByRepos(
    repoIds: string[],
    opts: { status?: string; type?: string } = {},
  ): Promise<MemoryRow[]> {
    const rows = await prisma.memory.findMany({
      where: { repoId: { in: repoIds }, status: opts.status, type: opts.type },
      orderBy: { updatedAt: "desc" },
      include: { evidence: true },
    });
    return rows.map((m) => mapPrisma(m, this.workspaceId));
  }

  async countByRepos(repoIds: string[], opts: { status?: string } = {}): Promise<number> {
    return prisma.memory.count({ where: { repoId: { in: repoIds }, status: opts.status } });
  }

  async search(opts: {
    repoId: string;
    query: string;
    limit: number;
    approvedOnly?: boolean;
    countUsage?: boolean;
  }): Promise<MemoryRow[]> {
    const where: Record<string, unknown> = { repoId: opts.repoId };
    if (opts.approvedOnly) where.status = "approved";
    const q = opts.query.trim();
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { content: { contains: q, mode: "insensitive" } },
      ];
    }
    const rows = await prisma.memory.findMany({
      where,
      orderBy: [{ confidence: "desc" }, { updatedAt: "desc" }],
      take: opts.limit,
      include: { evidence: true },
    });
    if (rows.length > 0) {
      await prisma.memory.updateMany({
        where: { id: { in: rows.map((m) => m.id) } },
        data: { lastUsedAt: new Date(), ...(opts.countUsage ? { usageCount: { increment: 1 } } : {}) },
      });
    }
    return rows.map((m) => mapPrisma(m, this.workspaceId));
  }

  async setStatus(id: string, status: string): Promise<MemoryRow> {
    const m = await prisma.memory.update({ where: { id }, data: { status }, include: { evidence: true } });
    return mapPrisma(m, this.workspaceId);
  }

  async archiveMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await prisma.memory.updateMany({ where: { id: { in: ids } }, data: { status: "archived" } });
  }

  async update(
    id: string,
    patch: { title?: string; content?: string; type?: string; confidence?: number; paths?: string[] },
  ): Promise<MemoryRow> {
    const m = await prisma.memory.update({ where: { id }, data: patch, include: { evidence: true } });
    return mapPrisma(m, this.workspaceId);
  }
}

/** Adapts ExternalMemoryStore (which already returns MemoryRow) to MemoryStore. */
class ExternalStore implements MemoryStore {
  readonly external = true;
  constructor(private readonly inner: ExternalMemoryStore) {}
  create(input: CreateMemoryInput) {
    return this.inner.create(input);
  }
  findById(id: string) {
    return this.inner.findById(id);
  }
  listByRepo(repoId: string, opts: { status?: string; type?: string } = {}) {
    return this.inner.listByRepos([repoId], opts);
  }
  listByRepos(repoIds: string[], opts: { status?: string; type?: string } = {}) {
    return this.inner.listByRepos(repoIds, opts);
  }
  countByRepos(repoIds: string[], opts: { status?: string } = {}) {
    return this.inner.countByRepos(repoIds, opts);
  }
  search(opts: {
    repoId: string;
    query: string;
    limit: number;
    approvedOnly?: boolean;
    countUsage?: boolean;
  }) {
    return this.inner.search(opts);
  }
  setStatus(id: string, status: string) {
    return this.inner.setStatus(id, status);
  }
  archiveMany(ids: string[]) {
    return this.inner.archiveMany(ids);
  }
  update(
    id: string,
    patch: { title?: string; content?: string; type?: string; confidence?: number; paths?: string[] },
  ) {
    return this.inner.update(id, patch);
  }
}

/** Resolve the store for a workspace (external if BYODB is connected). */
export async function memoryStore(workspaceId: string): Promise<MemoryStore> {
  const client = await getExternalClient(workspaceId);
  return client ? new ExternalStore(new ExternalMemoryStore(client)) : new SharedMemoryStore(workspaceId);
}

// Cache repo → workspaceId so store resolution from a repoId is one lookup.
const repoWorkspace = new Map<string, string>();

export async function workspaceIdForRepo(repoId: string): Promise<string> {
  const cached = repoWorkspace.get(repoId);
  if (cached) return cached;
  const repo = await prisma.repo.findUnique({ where: { id: repoId }, select: { workspaceId: true } });
  if (!repo) throw new Error(`Repo ${repoId} not found`);
  repoWorkspace.set(repoId, repo.workspaceId);
  return repo.workspaceId;
}

/** Resolve the store from a repoId (looks up its workspace). */
export async function memoryStoreForRepo(
  repoId: string,
): Promise<{ store: MemoryStore; workspaceId: string }> {
  const workspaceId = await workspaceIdForRepo(repoId);
  return { store: await memoryStore(workspaceId), workspaceId };
}

/**
 * Resolve a memory by id when we don't have repo context (the
 * /memories/:id/* mutation routes). Checks the shared control plane first, then
 * each of the user's BYODB-connected workspaces. Returns the memory, its store,
 * and workspace so the caller can enforce access + write back to the same place.
 */
export async function resolveMemoryById(
  userId: string,
  memoryId: string,
): Promise<{ memory: MemoryRow; store: MemoryStore; workspaceId: string; repoId: string } | null> {
  const shared = await prisma.memory.findUnique({
    where: { id: memoryId },
    include: { repo: { select: { workspaceId: true } }, evidence: true },
  });
  if (shared) {
    const workspaceId = shared.repo.workspaceId;
    return {
      memory: mapPrisma(shared, workspaceId),
      store: new SharedMemoryStore(workspaceId),
      workspaceId,
      repoId: shared.repoId,
    };
  }
  // Not in the control plane — look through the user's BYODB workspaces.
  const memberships = await prisma.membership.findMany({
    where: { userId, workspace: { externalDbStatus: "connected" } },
    select: { workspaceId: true },
  });
  for (const m of memberships) {
    const store = await memoryStore(m.workspaceId);
    if (!store.external) continue;
    const found = await store.findById(memoryId);
    if (found) {
      return { memory: found, store, workspaceId: m.workspaceId, repoId: found.repoId };
    }
  }
  return null;
}
