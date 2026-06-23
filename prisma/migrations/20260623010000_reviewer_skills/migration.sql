-- Reusable, named reviewer skills (instructions + path scope), attachable to repos.
CREATE TABLE "ReviewerSkill" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "paths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewerSkill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RepoReviewerSkill" (
    "repoId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,

    CONSTRAINT "RepoReviewerSkill_pkey" PRIMARY KEY ("repoId","skillId")
);

CREATE INDEX "ReviewerSkill_workspaceId_idx" ON "ReviewerSkill"("workspaceId");
CREATE INDEX "RepoReviewerSkill_skillId_idx" ON "RepoReviewerSkill"("skillId");

ALTER TABLE "ReviewerSkill" ADD CONSTRAINT "ReviewerSkill_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RepoReviewerSkill" ADD CONSTRAINT "RepoReviewerSkill_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RepoReviewerSkill" ADD CONSTRAINT "RepoReviewerSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "ReviewerSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
