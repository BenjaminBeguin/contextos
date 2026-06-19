-- Optional confidence floor; proposed memories below it are auto-rejected.
ALTER TABLE "Workspace" ADD COLUMN "autoRejectThreshold" DOUBLE PRECISION;
