-- Add a shareable join code to organizations (backfill existing rows).
ALTER TABLE "Organization" ADD COLUMN "joinCode" TEXT;

UPDATE "Organization"
SET "joinCode" = 'ORG-' || upper(substr(md5(random()::text || "id"), 1, 8))
WHERE "joinCode" IS NULL;

ALTER TABLE "Organization" ALTER COLUMN "joinCode" SET NOT NULL;

CREATE UNIQUE INDEX "Organization_joinCode_key" ON "Organization"("joinCode");
