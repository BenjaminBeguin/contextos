import Stripe from "stripe";
import { env } from "../env.js";
import { prisma } from "../db.js";

// Lazily-constructed singleton — only when a secret key is configured.
let client: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!env.stripe.enabled) return null;
  if (!client) client = new Stripe(env.stripe.secretKey);
  return client;
}

/** The Stripe Price ID for a plan: admin-set config (DB) first, then the
    STRIPE_PRICE_* env fallback. Null if neither is set. */
export async function priceForPlan(plan: string): Promise<string | null> {
  const configured = await prisma.planPrice.findUnique({ where: { plan } });
  if (configured?.stripePriceId) return configured.stripePriceId;
  return env.stripe.prices[plan] || null;
}

/** Ensure the org has a Stripe customer, creating one on first checkout. */
async function ensureCustomer(
  stripe: Stripe,
  organizationId: string,
  email: string,
): Promise<string> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { stripeCustomerId: true, name: true },
  });
  if (org?.stripeCustomerId) return org.stripeCustomerId;
  const customer = await stripe.customers.create({
    email,
    name: org?.name ?? undefined,
    metadata: { organizationId },
  });
  await prisma.organization.update({
    where: { id: organizationId },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

/** Create a Checkout Session for a plan upgrade. Returns the hosted-page URL. */
export async function createCheckoutSession(opts: {
  organizationId: string;
  plan: string;
  email: string;
}): Promise<{ url: string | null }> {
  const stripe = getStripe();
  if (!stripe) throw new Error("billing_not_configured");
  const price = await priceForPlan(opts.plan);
  if (!price) throw new Error("price_not_configured");

  const customer = await ensureCustomer(stripe, opts.organizationId, opts.email);
  const base = `${env.appUrl}/orgs/${opts.organizationId}?tab=Billing`;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price, quantity: 1 }],
    success_url: `${base}&billing=success`,
    cancel_url: `${base}&billing=cancel`,
    metadata: { organizationId: opts.organizationId, plan: opts.plan },
    subscription_data: { metadata: { organizationId: opts.organizationId, plan: opts.plan } },
  });
  return { url: session.url };
}

/** Apply a plan change coming from a verified Stripe webhook event. */
export async function applyStripePlan(opts: {
  organizationId: string;
  plan: string;
  status: string; // active | past_due | canceled
  actorEmail?: string | null;
  amountCents?: number | null;
  currency?: string | null;
}): Promise<void> {
  const current = await prisma.organization.findUnique({
    where: { id: opts.organizationId },
    select: { plan: true },
  });
  await prisma.organization.update({
    where: { id: opts.organizationId },
    data: {
      plan: opts.plan,
      planSource: "stripe",
      planStatus: opts.status,
      planUpdatedAt: new Date(),
    },
  });
  await prisma.billingEvent.create({
    data: {
      organizationId: opts.organizationId,
      type: "plan.changed",
      plan: opts.plan,
      status: opts.status,
      amountCents: opts.amountCents ?? null,
      currency: opts.currency ?? null,
      note: `Stripe: ${current?.plan ?? "?"} → ${opts.plan}`,
      actorEmail: opts.actorEmail ?? null,
    },
  });
}
