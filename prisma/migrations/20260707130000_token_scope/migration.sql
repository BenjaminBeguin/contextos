-- Let a user label an API token and scope it to CLI, MCP, or both.
ALTER TABLE "ApiToken" ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'both';
