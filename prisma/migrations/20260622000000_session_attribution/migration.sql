-- Link memory usage to agent sessions for with/without measurement.
ALTER TABLE "AgentSession" ADD COLUMN "externalId" TEXT;
ALTER TABLE "AgentSession" ADD COLUMN "errorCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UsageEvent" ADD COLUMN "sessionId" TEXT;
