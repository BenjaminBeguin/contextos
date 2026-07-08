-- Project-scoped API tokens: bind a token to a single workspace (null = account-wide).
ALTER TABLE "ApiToken" ADD COLUMN "workspaceId" TEXT;

CREATE INDEX "ApiToken_workspaceId_idx" ON "ApiToken"("workspaceId");

ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
