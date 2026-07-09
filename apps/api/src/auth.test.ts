import { describe, it, expect } from "vitest";
import { scopedTokenMayReach } from "./auth.js";

// A project-scoped API token is a CLI/MCP credential for ONE project. These
// assert the default-deny allowlist that keeps such a token from escaping its
// project — most importantly, from minting new (account-wide) tokens.
describe("scopedTokenMayReach", () => {
  it("allows the CLI/MCP surface", () => {
    for (const pattern of [
      "/health",
      "/repos",
      "/repos/:repoId",
      "/repos/:repoId/memories",
      "/repos/:repoId/proposals",
      "/repos/:repoId/sessions",
      "/repos/:repoId/scan",
      "/repos/:repoId/review-diff",
      "/mcp/search_memory",
      "/mcp/get_repo_context",
      "/mcp/get_relevant_warnings",
    ]) {
      expect(scopedTokenMayReach(pattern), pattern).toBe(true);
    }
  });

  it("denies token minting (privilege escalation)", () => {
    expect(scopedTokenMayReach("/auth/tokens")).toBe(false);
    expect(scopedTokenMayReach("/auth/tokens/:tokenId")).toBe(false);
  });

  it("denies org, admin, and cross-workspace routes", () => {
    for (const pattern of [
      "/orgs",
      "/orgs/:orgId",
      "/orgs/:orgId/members",
      "/orgs/:orgId/billing/checkout",
      "/admin/overview",
      "/admin/workspaces/:workspaceId/plan",
      "/workspaces", // list every workspace / create a new one
      "/workspaces/join", // join an arbitrary workspace by code
      "/me",
      "/stats",
      "/github/repos",
    ]) {
      expect(scopedTokenMayReach(pattern), pattern).toBe(false);
    }
  });

  it("does not treat a lookalike prefix as a repos route", () => {
    // Guards against a future "/repos-export" style route being auto-allowed.
    expect(scopedTokenMayReach("/repos-export")).toBe(false);
    expect(scopedTokenMayReach("/reposx")).toBe(false);
  });
});
