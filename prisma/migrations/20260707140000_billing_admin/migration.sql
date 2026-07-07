-- Per-workspace plan/billing fields + an append-only billing event log, for the
-- superadmin dashboard (plans, subscriptions, payment log, comp/promote-for-free).
ALTER TABLE "Workspace" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "Workspace" ADD COLUMN "planSource" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "Workspace" ADD COLUMN "planStatus" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Workspace" ADD COLUMN "planNote" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "planUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Workspace" ADD COLUMN "stripeCustomerId" TEXT;

CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "type" TEXT NOT NULL,
    "plan" TEXT,
    "amountCents" INTEGER,
    "currency" TEXT,
    "status" TEXT,
    "note" TEXT,
    "actorEmail" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BillingEvent_createdAt_idx" ON "BillingEvent"("createdAt");
CREATE INDEX "BillingEvent_workspaceId_createdAt_idx" ON "BillingEvent"("workspaceId", "createdAt");

ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
