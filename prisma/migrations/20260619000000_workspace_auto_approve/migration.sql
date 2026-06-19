-- Optional confidence threshold; proposed memories at/above it auto-approve.
ALTER TABLE "Workspace" ADD COLUMN "autoApproveThreshold" DOUBLE PRECISION;
