-- Organization layer: billing + entitlement + membership container above projects.

CREATE TABLE "Organization" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "plan" TEXT NOT NULL DEFAULT 'free',
  "planSource" TEXT NOT NULL DEFAULT 'none',
  "planStatus" TEXT NOT NULL DEFAULT 'active',
  "planNote" TEXT,
  "planUpdatedAt" TIMESTAMP(3),
  "stripeCustomerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

CREATE TABLE "OrgMembership" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'owner',
  CONSTRAINT "OrgMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrgMembership_userId_organizationId_key" ON "OrgMembership"("userId","organizationId");
CREATE INDEX "OrgMembership_organizationId_idx" ON "OrgMembership"("organizationId");
ALTER TABLE "OrgMembership" ADD CONSTRAINT "OrgMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrgMembership" ADD CONSTRAINT "OrgMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One org per existing workspace, copying the plan/billing fields up.
INSERT INTO "Organization" ("id","name","slug","plan","planSource","planStatus","planNote","planUpdatedAt","stripeCustomerId","createdAt")
SELECT 'org_'||w."id", w."name", w."slug"||'-org', w."plan", w."planSource", w."planStatus", w."planNote", w."planUpdatedAt", w."stripeCustomerId", w."createdAt"
FROM "Workspace" w;

-- Mirror workspace memberships to org memberships (owner/admin kept; member/viewer → member).
INSERT INTO "OrgMembership" ("id","userId","organizationId","role")
SELECT 'om_'||m."id", m."userId", 'org_'||m."workspaceId",
  CASE WHEN m."role" IN ('owner','admin') THEN m."role" ELSE 'member' END
FROM "Membership" m;

-- Link workspaces to their org.
ALTER TABLE "Workspace" ADD COLUMN "organizationId" TEXT;
UPDATE "Workspace" w SET "organizationId" = 'org_'||w."id";
ALTER TABLE "Workspace" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Workspace_organizationId_idx" ON "Workspace"("organizationId");

-- BillingEvent moves to the org.
ALTER TABLE "BillingEvent" ADD COLUMN "organizationId" TEXT;
UPDATE "BillingEvent" b SET "organizationId" = 'org_'||b."workspaceId" WHERE b."workspaceId" IS NOT NULL;
ALTER TABLE "BillingEvent" DROP CONSTRAINT IF EXISTS "BillingEvent_workspaceId_fkey";
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
DROP INDEX IF EXISTS "BillingEvent_workspaceId_createdAt_idx";
CREATE INDEX "BillingEvent_organizationId_createdAt_idx" ON "BillingEvent"("organizationId","createdAt");

-- Plan/billing fields now live on the Organization.
ALTER TABLE "Workspace" DROP COLUMN "plan";
ALTER TABLE "Workspace" DROP COLUMN "planSource";
ALTER TABLE "Workspace" DROP COLUMN "planStatus";
ALTER TABLE "Workspace" DROP COLUMN "planNote";
ALTER TABLE "Workspace" DROP COLUMN "planUpdatedAt";
ALTER TABLE "Workspace" DROP COLUMN "stripeCustomerId";
