import { z } from "zod";
import { MEMORY_TYPES, MEMORY_STATUSES, MEMORY_SCOPES } from "./types.js";

export const memoryTypeSchema = z.enum(MEMORY_TYPES);
export const memoryStatusSchema = z.enum(MEMORY_STATUSES);
export const memoryScopeSchema = z.enum(MEMORY_SCOPES);

export const loginSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
});

export const waitlistSchema = z.object({
  email: z.string().email(),
  source: z.string().max(120).optional(),
});

export const TOKEN_SCOPES = ["cli", "mcp", "both"] as const;
export const tokenScopeSchema = z.enum(TOKEN_SCOPES);
export type TokenScope = (typeof TOKEN_SCOPES)[number];

export const createTokenSchema = z.object({
  name: z.string().min(1).max(80).default("cli"),
  scope: tokenScopeSchema.default("both"),
});

export const createWorkspaceSchema = z.object({
  name: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "slug must be lowercase alphanumeric with dashes"),
});

export const joinWorkspaceSchema = z.object({
  joinCode: z.string().min(1),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  // null disables; a value in [0,1] auto-approves proposals at/above it.
  autoApproveThreshold: z.number().min(0).max(1).nullable().optional(),
  // null disables; a value in [0,1] auto-rejects proposals below it.
  autoRejectThreshold: z.number().min(0).max(1).nullable().optional(),
});

export const chatSchema = z.object({
  message: z.string().min(1).max(2000),
});

export const createRepoSchema = z.object({
  workspaceId: z.string().min(1),
  provider: z.string().default("github"),
  name: z.string().min(1),
  fullName: z.string().min(1),
  defaultBranch: z.string().optional(),
});

export const updateRepoSchema = z.object({
  name: z.string().min(1).optional(),
  stack: z.array(z.string().min(1)).max(40).optional(),
  packageManager: z.string().max(40).optional(),
  notes: z.string().max(5000).optional(),
  defaultBranch: z.string().max(120).optional(),
  reviewerEnabled: z.boolean().optional(),
  reviewerInstructions: z.string().max(4000).optional(),
});

export const reviewPrSchema = z.object({
  prNumber: z.number().int().positive(),
  post: z.boolean().optional(),
});

/** CI-native review: the caller (a CI job) supplies the diff; no GitHub access needed. */
export const reviewDiffSchema = z.object({
  prTitle: z.string().min(1).max(500),
  prBody: z.string().max(20000).optional(),
  diff: z.string().min(1).max(400000),
});

export const PLANS = ["free", "team", "business", "enterprise"] as const;
export const planSchema = z.enum(PLANS);
export type Plan = (typeof PLANS)[number];

/** What each plan is allowed. `null` = unlimited. Single source of truth for
    entitlements — enforced in the API and shown in the app. */
export interface PlanLimits {
  maxRepos: number | null;
  maxSeats: number | null;
  reviewer: boolean; // memory-grounded PR reviewer
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: { maxRepos: 3, maxSeats: 2, reviewer: false },
  team: { maxRepos: 20, maxSeats: 10, reviewer: true },
  business: { maxRepos: 100, maxSeats: 50, reviewer: true },
  enterprise: { maxRepos: null, maxSeats: null, reviewer: true },
};

export const PLAN_LABELS: Record<Plan, string> = {
  free: "Free",
  team: "Team",
  business: "Business",
  enterprise: "Enterprise",
};

export function planLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[(plan as Plan) in PLAN_LIMITS ? (plan as Plan) : "free"];
}

/** True if `used` is still under `max` (null = unlimited). Use before adding one. */
export function withinLimit(used: number, max: number | null): boolean {
  return max === null || used < max;
}

export const PLAN_SOURCES = ["none", "stripe", "comp", "manual"] as const;
export const planSourceSchema = z.enum(PLAN_SOURCES);

/** Owner starts a self-serve upgrade to a paid plan. */
export const billingCheckoutSchema = z.object({
  plan: planSchema,
});

/** Superadmin: set a workspace's plan (e.g. comp / promote-for-free). */
export const setPlanSchema = z.object({
  plan: planSchema,
  source: planSourceSchema.default("manual"),
  status: z.enum(["active", "past_due", "canceled"]).default("active"),
  note: z.string().max(500).optional(),
});

export const reviewFeedbackValueSchema = z.enum(["pending", "accepted", "dismissed"]);

/** Feedback on a single persisted finding (web app). */
export const reviewFeedbackSchema = z.object({
  feedback: reviewFeedbackValueSchema,
});

/** Bulk feedback keyed by finding dedup key (CLI `review-sync` from GitHub reactions). */
export const reviewFeedbackBulkSchema = z.object({
  items: z
    .array(z.object({ key: z.string().min(1), feedback: reviewFeedbackValueSchema }))
    .min(1)
    .max(200),
});

export const reviewerSkillSchema = z.object({
  name: z.string().min(1).max(120),
  instructions: z.string().min(1).max(8000),
  paths: z.array(z.string().min(1)).max(40).optional(),
});
export const updateReviewerSkillSchema = reviewerSkillSchema.partial();
export const setRepoSkillsSchema = z.object({
  skillIds: z.array(z.string().min(1)).max(50),
});

export const memoryEvidenceSchema = z.object({
  kind: z.string().min(1),
  content: z.string().min(1),
  url: z.string().url().optional(),
});

export const createMemorySchema = z.object({
  type: memoryTypeSchema,
  title: z.string().min(1),
  content: z.string().min(1),
  paths: z.array(z.string().min(1)).max(50).optional(),
  scope: memoryScopeSchema.default("repo"),
  confidence: z.number().min(0).max(1).default(0.7),
  status: memoryStatusSchema.default("proposed"),
  source: z.string().optional(),
  evidence: z.array(memoryEvidenceSchema).optional(),
});

export const updateMemorySchema = z.object({
  type: memoryTypeSchema.optional(),
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  paths: z.array(z.string().min(1)).max(50).optional(),
  scope: memoryScopeSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  status: memoryStatusSchema.optional(),
});

export const memoryListQuerySchema = z.object({
  status: memoryStatusSchema.optional(),
  type: memoryTypeSchema.optional(),
  search: z.string().optional(),
});

export const sessionEventSchema = z.object({
  type: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
});

export const recordSessionSchema = z.object({
  agent: z.string().default("claude-code"),
  sessionId: z.string().optional(),
  task: z.string().optional(),
  summary: z.string().optional(),
  filesChanged: z.array(z.string()).optional(),
  commandsRun: z.array(z.string()).optional(),
  errors: z.array(z.string()).optional(),
  events: z.array(sessionEventSchema).optional(),
});

// Shape the extractor (LLM or heuristic) must produce.
export const extractedMemorySchema = z.object({
  type: memoryTypeSchema,
  title: z.string().min(1).max(140),
  content: z.string().min(1),
  confidence: z.number().min(0).max(1),
  paths: z.array(z.string().min(1)).max(50).optional(),
  evidence: z.string().optional(),
});
export const extractedMemoriesSchema = z.array(extractedMemorySchema).max(20);

// Memories an agent (Claude Code) proposes directly via MCP. Confidence optional.
export const proposedMemoryInputSchema = z.object({
  type: memoryTypeSchema,
  title: z.string().min(1).max(140),
  content: z.string().min(1),
  confidence: z.number().min(0).max(1).default(0.6),
  paths: z.array(z.string().min(1)).max(50).optional(),
  evidence: z.string().optional(),
});
export const proposeMemoriesSchema = z.object({
  memories: z.array(proposedMemoryInputSchema).min(1).max(20),
});

// MCP payloads
export const mcpSearchMemorySchema = z.object({
  repoId: z.string().min(1),
  query: z.string().default(""),
  limit: z.number().int().min(1).max(50).default(10),
});

export const mcpRepoContextSchema = z.object({
  repoId: z.string().min(1),
  sessionId: z.string().optional(),
});

export const mcpRelevantWarningsSchema = z.object({
  repoId: z.string().min(1),
  files: z.array(z.string().min(1)).min(1).max(100),
  sessionId: z.string().optional(),
});

export type RecordSessionInput = z.infer<typeof recordSessionSchema>;
export type ExtractedMemory = z.infer<typeof extractedMemorySchema>;

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type JoinWorkspaceInput = z.infer<typeof joinWorkspaceSchema>;
export type CreateRepoInput = z.infer<typeof createRepoSchema>;
export type CreateMemoryInput = z.infer<typeof createMemorySchema>;
export type UpdateMemoryInput = z.infer<typeof updateMemorySchema>;
