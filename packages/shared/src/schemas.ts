import { z } from "zod";
import { MEMORY_TYPES, MEMORY_STATUSES, MEMORY_SCOPES } from "./types.js";

export const memoryTypeSchema = z.enum(MEMORY_TYPES);
export const memoryStatusSchema = z.enum(MEMORY_STATUSES);
export const memoryScopeSchema = z.enum(MEMORY_SCOPES);

export const loginSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
});

export const createTokenSchema = z.object({
  name: z.string().min(1).default("cli"),
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

export const createRepoSchema = z.object({
  workspaceId: z.string().min(1),
  provider: z.string().default("github"),
  name: z.string().min(1),
  fullName: z.string().min(1),
  defaultBranch: z.string().optional(),
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
  scope: memoryScopeSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  status: memoryStatusSchema.optional(),
});

export const memoryListQuerySchema = z.object({
  status: memoryStatusSchema.optional(),
  type: memoryTypeSchema.optional(),
  search: z.string().optional(),
});

// MCP payloads
export const mcpSearchMemorySchema = z.object({
  repoId: z.string().min(1),
  query: z.string().default(""),
  limit: z.number().int().min(1).max(50).default(10),
});

export const mcpRepoContextSchema = z.object({
  repoId: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type JoinWorkspaceInput = z.infer<typeof joinWorkspaceSchema>;
export type CreateRepoInput = z.infer<typeof createRepoSchema>;
export type CreateMemoryInput = z.infer<typeof createMemorySchema>;
export type UpdateMemoryInput = z.infer<typeof updateMemorySchema>;
