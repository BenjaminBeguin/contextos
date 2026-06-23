-- Per-repo automated PR reviewer config.
ALTER TABLE "Repo" ADD COLUMN "reviewerEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Repo" ADD COLUMN "reviewerInstructions" TEXT;
