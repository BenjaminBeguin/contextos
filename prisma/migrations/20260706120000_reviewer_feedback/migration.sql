-- Persisted PR reviews + findings, so human feedback on findings can feed back
-- into the confidence of the memory that grounded each finding.
CREATE TABLE "PrReview" (
    "id" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "prNumber" INTEGER,
    "prTitle" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ci',
    "summary" TEXT NOT NULL,
    "findingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrReviewFinding" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "path" TEXT,
    "line" INTEGER,
    "memoryId" TEXT,
    "memoryTitle" TEXT,
    "feedback" TEXT NOT NULL DEFAULT 'pending',
    "feedbackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrReviewFinding_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrReview_repoId_createdAt_idx" ON "PrReview"("repoId", "createdAt");
CREATE INDEX "PrReviewFinding_reviewId_idx" ON "PrReviewFinding"("reviewId");
CREATE INDEX "PrReviewFinding_memoryId_idx" ON "PrReviewFinding"("memoryId");

ALTER TABLE "PrReview" ADD CONSTRAINT "PrReview_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrReviewFinding" ADD CONSTRAINT "PrReviewFinding_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "PrReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrReviewFinding" ADD CONSTRAINT "PrReviewFinding_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "Memory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
