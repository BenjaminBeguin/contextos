-- Provider-agnostic BYOK: generalize the Anthropic-only key into a provider config.
ALTER TABLE "Workspace" RENAME COLUMN "anthropicKey" TO "llmKey";
ALTER TABLE "Workspace" ADD COLUMN "llmProvider" TEXT NOT NULL DEFAULT 'anthropic';
ALTER TABLE "Workspace" ADD COLUMN "llmModel" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "llmBaseUrl" TEXT;
