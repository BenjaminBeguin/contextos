-- Per-workspace BYOK Anthropic API key (encrypted at rest).
ALTER TABLE "Workspace" ADD COLUMN "anthropicKey" TEXT;
