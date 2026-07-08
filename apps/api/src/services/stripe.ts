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

/** The Stripe Price ID for a plan, or null if that plan isn't sold via Stripe. */
export function priceForPlan(plan: string): string | null {
  return env.stripe.prices[plan] || null;
}

/** Ensure the workspace has a Stripe customer, creating one on first checkout. */
async function ensureCustomer(
  stripe: Stripe,
  workspaceId: string,
  email: string,
): Promise<string> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { stripeCustomerId: true, name: true },
  });
  if (ws?.stripeCustomerId) return ws.stripeCustomerId;
  const customer = await stripe.customers.create({
    email,
    name: ws?.name ?? undefined,
    metadata: { workspaceId },
  });
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

/** Create a Checkout Session for a plan upgrade. Returns the hosted-page URL. */
export async function createCheckoutSession(opts: {
  workspaceId: string;
  plan: string;
  email: string;
}): Promise<{ url: string | null }> {
  const stripe = getStripe();
  if (!stripe) throw new Error("billing_not_configured");
  const price = priceForPlan(opts.plan);
  if (!price) throw new Error("price_not_configured");

  const customer = await ensureCustomer(stripe, opts.workspaceId, opts.email);
  const base = `${env.appUrl}/projects/${opts.workspaceId}?tab=Settings`;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price, quantity: 1 }],
    success_url: `${base}&billing=success`,
    cancel_url: `${base}&billing=cancel`,
    metadata: { workspaceId: opts.workspaceId, plan: opts.plan },
    subscription_data: { metadata: { workspaceId: opts.workspaceId, plan: opts.plan } },
  });
  return { url: session.url };
}

/** Apply a plan change coming from a verified Stripe webhook event. */
export async function applyStripePlan(opts: {
  workspaceId: string;
  plan: string;
  status: string; // active | past_due | canceled
  actorEmail?: string | null;
  amountCents?: number | null;
  currency?: string | null;
}): Promise<void> {
  const current = await prisma.workspace.findUnique({
    where: { id: opts.workspaceId },
    select: { plan: true },
  });
  await prisma.workspace.update({
    where: { id: opts.workspaceId },
    data: {
      plan: opts.plan,
      planSource: "stripe",
      planStatus: opts.status,
      planUpdatedAt: new Date(),
    },
  });
  await prisma.billingEvent.create({
    data: {
      workspaceId: opts.workspaceId,
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
