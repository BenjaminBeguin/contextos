export const MEMORY_TYPES = [
  "project_rule",
  "architecture",
  "command",
  "workflow",
  "decision",
  "failure",
  "risk",
  "dependency",
  "testing",
  "deployment",
  "business_context",
] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];

export const MEMORY_STATUSES = [
  "proposed",
  "approved",
  "rejected",
  "archived",
  "stale",
] as const;

export type MemoryStatus = (typeof MEMORY_STATUSES)[number];

export const MEMORY_SCOPES = ["repo", "org", "global"] as const;
export type MemoryScope = (typeof MEMORY_SCOPES)[number];

export interface RepoContext {
  stack: string[];
  packageManager: string | null;
  notes: string | null;
}

export interface MemoryDTO {
  id: string;
  repoId: string;
  type: MemoryType;
  title: string;
  content: string;
  scope: MemoryScope;
  confidence: number;
  status: MemoryStatus;
  source: string | null;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
}
