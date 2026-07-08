-- Bring-your-own-database (data residency, Enterprise): per-workspace external Postgres.
ALTER TABLE "Workspace" ADD COLUMN "externalDbUrl" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "externalDbStatus" TEXT NOT NULL DEFAULT 'unconfigured';
ALTER TABLE "Workspace" ADD COLUMN "externalDbError" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "externalDbCheckedAt" TIMESTAMP(3);
