-- Span fields on session events (timeline) + a per-memory usage counter (impact).
ALTER TABLE "SessionEvent" ADD COLUMN "name" TEXT;
ALTER TABLE "SessionEvent" ADD COLUMN "durationMs" INTEGER;
ALTER TABLE "SessionEvent" ADD COLUMN "status" TEXT;
CREATE INDEX "SessionEvent_sessionId_createdAt_idx" ON "SessionEvent"("sessionId", "createdAt");

ALTER TABLE "Memory" ADD COLUMN "usageCount" INTEGER NOT NULL DEFAULT 0;
