-- Admin-editable Stripe Price IDs per plan (falls back to STRIPE_PRICE_* env).
CREATE TABLE "PlanPrice" (
  "plan" TEXT NOT NULL,
  "stripePriceId" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlanPrice_pkey" PRIMARY KEY ("plan")
);
