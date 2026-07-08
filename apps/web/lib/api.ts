import type { PrReviewDTO, PrReviewFindingDTO, ReviewFeedback } from "@cortex/shared";

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

export interface PlanLimits {
  maxRepos: number | null;
  maxSeats: number | null;
  reviewer: boolean;
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
  plan?: Plan;
  planStatus?: string;
  planSource?: string;
  limits?: PlanLimits;
  usage?: { repos: number; seats: number };
  billingEnabled?: boolean;
  repos: { id: string; fullName: string; _count?: { memories: number } }[];
  memberships: {
    role: string;
    user: { id: string; email: string; name: string | null; avatarUrl: string | null };
  }[];
}

/** Start a self-serve upgrade. Resolves to a Stripe URL, or throws with
    "billing_not_configured" until STRIPE_SECRET_KEY is set. */
export function startCheckout(workspaceId: string, plan: Plan): Promise<{ url?: string }> {
  return api<{ url?: string }>(`/workspaces/${workspaceId}/billing/checkout`, {
    method: "POST",
    body: JSON.stringify({ plan }),
  });
}

/** Request an upgrade when self-serve billing is off — logged for the admin. */
export function requestUpgrade(workspaceId: string, plan: Plan, note?: string): Promise<{ ok: boolean }> {
  return api<{ ok: boolean }>(`/workspaces/${workspaceId}/request-upgrade`, {
    method: "POST",
    body: JSON.stringify({ plan, note }),
  });
}

/** This workspace's billing history (owner-only) — plan grants, upgrade
    requests, and (once Stripe is wired) invoices. */
export function getWorkspaceBillingEvents(workspaceId: string): Promise<BillingEventRow[]> {
  return api<BillingEventRow[]>(`/workspaces/${workspaceId}/billing-events`);
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
  line?: number;
  memory?: string;
}

/** Persisted reviews for a repo, newest first. */
export function getReviews(
  repoId: string,
  params?: { limit?: number; offset?: number },
): Promise<{ reviews: PrReviewDTO[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.limit != null) query.set("limit", String(params.limit));
  if (params?.offset != null) query.set("offset", String(params.offset));
  const qs = query.toString();
  return api<{ reviews: PrReviewDTO[]; total: number }>(
    `/repos/${repoId}/reviews${qs ? `?${qs}` : ""}`,
  );
}

/** A persisted review annotated with its repo (workspace-level Reviews tab). */
export type WorkspaceReview = PrReviewDTO & { repoId: string; repoFullName: string };

/** All persisted reviews across a workspace's repos, newest first. */
export function getWorkspaceReviews(workspaceId: string): Promise<WorkspaceReview[]> {
  return api<WorkspaceReview[]>(`/workspaces/${workspaceId}/reviews`);
}

// ---- Admin (superadmin) ------------------------------------------------------

export type Plan = "free" | "team" | "business" | "enterprise";

export interface AdminOverview {
  totals: { users: number; workspaces: number; repos: number; memories: number };
  plans: Record<string, number>;
  mrrCents: number;
  recentEvents: BillingEventRow[];
}

export interface AdminWorkspace {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
  planSource: string;
  planStatus: string;
  planNote: string | null;
  planUpdatedAt: string | null;
  createdAt: string;
  repoCount: number;
  memberCount: number;
  owner: { email: string; name: string | null } | null;
}

export interface BillingEventRow {
  id: string;
  workspaceId: string | null;
  type: string;
  plan: string | null;
  amountCents: number | null;
  currency: string | null;
  status: string | null;
  note: string | null;
  actorEmail: string | null;
  createdAt: string;
  workspace?: { name: string; slug: string } | null;
}

export function getAdminWhoami(): Promise<{ isSuperAdmin: boolean }> {
  return api<{ isSuperAdmin: boolean }>("/admin/whoami");
}
export function getAdminOverview(): Promise<AdminOverview> {
  return api<AdminOverview>("/admin/overview");
}
export function getAdminWorkspaces(): Promise<AdminWorkspace[]> {
  return api<AdminWorkspace[]>("/admin/workspaces");
}
export function setWorkspacePlan(
  workspaceId: string,
  body: { plan: Plan; source?: string; status?: string; note?: string },
): Promise<AdminWorkspace> {
  return api<AdminWorkspace>(`/admin/workspaces/${workspaceId}/plan`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
export function getBillingEvents(): Promise<BillingEventRow[]> {
  return api<BillingEventRow[]>("/admin/billing-events");
}

export interface AdminWorkspaceDetail {
  id: string;
  name: string;
  slug: string;
  joinCode: string;
  plan: Plan;
  planSource: string;
  planStatus: string;
  planNote: string | null;
  createdAt: string;
  members: {
    userId: string;
    role: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  }[];
  repos: { id: string; fullName: string; memories: number }[];
}

export function getAdminWorkspace(id: string): Promise<AdminWorkspaceDetail> {
  return api<AdminWorkspaceDetail>(`/admin/workspaces/${id}`);
}
export function adminAddMember(
  id: string,
  email: string,
  role = "member",
): Promise<{ ok: boolean }> {
  return api(`/admin/workspaces/${id}/members`, {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
}
export function adminRemoveMember(id: string, userId: string): Promise<{ ok: boolean }> {
  return api(`/admin/workspaces/${id}/members/${userId}`, { method: "DELETE" });
}
export function adminDeleteWorkspace(id: string): Promise<{ ok: boolean }> {
  return api(`/admin/workspaces/${id}`, { method: "DELETE" });
}

/** Result of marking a finding accepted / dismissed / pending. */
export interface FindingFeedbackResult {
  finding: PrReviewFindingDTO;
  memory?: { id: string; confidence: number; previousConfidence: number };
}

/** Mark a single finding's feedback; may move the grounding memory's confidence. */
export function sendFindingFeedback(
  findingId: string,
  feedback: ReviewFeedback,
): Promise<FindingFeedbackResult> {
  return api<FindingFeedbackResult>(`/findings/${findingId}/feedback`, {
    method: "POST",
    body: JSON.stringify({ feedback }),
  });
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
  scope: "cli" | "mcp" | "both";
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
  errorCount?: number;
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
  usageCount?: number;
  evidence?: { id: string; kind: string; content: string; url: string | null }[];
  duplicateOf?: { id: string; title: string } | null;
}

/** One event/span in a session timeline. */
export interface SessionSpan {
  id: string;
  type: string;
  name?: string | null;
  durationMs?: number | null;
  status?: string | null;
  payload?: Record<string, unknown>;
  createdAt: string;
}

/** A session with its events (GET /sessions/:id). */
export function getSession(
  sessionId: string,
): Promise<AgentSession & { events: SessionSpan[] }> {
  return api<AgentSession & { events: SessionSpan[] }>(`/sessions/${sessionId}`);
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
