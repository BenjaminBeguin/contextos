export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3008";

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Only send a JSON content-type when there's a body — Fastify rejects an empty
  // body that carries `Content-Type: application/json`.
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (init.body != null && headers["content-type"] === undefined) {
    headers["content-type"] = "application/json";
  }
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  joinCode: string;
  role: string;
  repoCount?: number;
  pendingMemories?: number;
}

export interface Me {
  id: string;
  email: string;
  name: string | null;
  avatarUrl?: string | null;
  github?: boolean;
  githubConnected?: boolean;
  workspaces: Workspace[];
}

export interface WorkspaceDetail {
  id: string;
  name: string;
  slug: string;
  joinCode: string;
  hasAnthropicKey?: boolean;
  autoApproveThreshold?: number | null;
  autoRejectThreshold?: number | null;
  pendingMemories?: number;
  repos: { id: string; fullName: string; _count?: { memories: number } }[];
  memberships: {
    role: string;
    user: { id: string; email: string; name: string | null; avatarUrl: string | null };
  }[];
}

export interface PullRequest {
  number: number;
  title: string;
  url: string;
  updatedAt: string;
  draft: boolean;
  author: string | null;
}

export interface ReviewFinding {
  severity: "blocker" | "warning" | "nit" | "praise";
  title: string;
  detail: string;
  path?: string;
  memory?: string;
}

export interface PrReview {
  summary: string;
  findings: ReviewFinding[];
}

export interface ReviewResult {
  review: PrReview;
  posted: boolean;
}

export interface ReviewerSkill {
  id: string;
  workspaceId: string;
  name: string;
  instructions: string;
  paths: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ApiTokenInfo {
  id: string;
  name: string;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface GraphNode {
  id: string;
  type: "workspace" | "repo" | "memory" | "session";
  label: string;
  group?: string;
  href?: string;
}
export interface GraphData {
  nodes: GraphNode[];
  edges: { source: string; target: string }[];
}

export interface ChatSource {
  id: string;
  title: string;
  type: string;
  repoId: string;
  repo: string;
}
export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
}

export interface RepoSummary {
  id: string;
  name: string;
  fullName: string;
  provider: string;
  stack: string[];
  packageManager: string | null;
  workspace?: { name: string; slug: string };
  _count?: { memories: number };
}

export interface AgentSessionSummary {
  id: string;
  agent: string;
  task: string | null;
  summary: string | null;
  status: string;
  createdAt: string;
  _count?: { events: number };
}

export interface WorkspaceMetrics {
  reposCount: number;
  memoryCounts: Record<string, number>;
  approvedMemories: number;
  pendingMemories: number;
  retrievals30: number;
  retrievals7: number;
  retrievalSeries: { date: string; count: number }[];
  contextInjections30: number;
  warningChecks30: number;
  warningsMatched30: number;
  sessions30: number;
  approved30: number;
  reposWithMemory: number;
  comparison: {
    withMemory: { sessions: number; avgErrors: number };
    withoutMemory: { sessions: number; avgErrors: number };
  };
  topRepos: { id: string; fullName: string; memories: number }[];
}

export interface GithubRepo {
  fullName: string;
  name: string;
  private: boolean;
  defaultBranch: string;
  language: string | null;
  updatedAt: string;
}

export interface GeneratedDoc {
  id: string;
  repoId: string;
  type: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentSession {
  id: string;
  agent: string;
  task: string | null;
  summary: string | null;
  status: string;
  createdAt: string;
  _count?: { events: number };
}

export interface Memory {
  id: string;
  repoId: string;
  type: string;
  title: string;
  content: string;
  paths?: string[];
  scope: string;
  confidence: number;
  status: string;
  source: string | null;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string | null;
  evidence?: { id: string; kind: string; content: string; url: string | null }[];
  duplicateOf?: { id: string; title: string } | null;
}

export interface WorkspaceMemory extends Memory {
  repoFullName: string;
}

/** Compact relative time, e.g. "just now", "5m ago", "3h ago", "2d ago". */
export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export const STALE_DAYS = 30;

/** An approved memory not retrieved or edited in STALE_DAYS is "stale" and worth re-reviewing. */
export function isStaleMemory(m: Memory): boolean {
  if (m.status !== "approved") return false;
  const ref = m.lastUsedAt ?? m.updatedAt;
  return Date.now() - new Date(ref).getTime() > STALE_DAYS * 86_400_000;
}
