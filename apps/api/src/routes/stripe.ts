import type { FastifyInstance } from "fastify";
import type Stripe from "stripe";
import { env } from "../env.js";
import { prisma } from "../db.js";
import { getStripe, applyStripePlan } from "../services/stripe.js";

/**
 * Stripe webhook. Registered as its own plugin so the raw-body parser (needed
 * for signature verification) is scoped here and doesn't affect JSON parsing
 * elsewhere. Point a Stripe webhook endpoint at POST /billing/webhook and
 * subscribe to checkout.session.completed + customer.subscription.* events.
 */
export async function stripeRoutes(app: FastifyInstance) {
  // Keep the raw bytes — constructEvent verifies the signature over them.
  app.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (_req, body, done) => done(null, body),
  );

  app.post("/billing/webhook", async (req, reply) => {
    const stripe = getStripe();
    if (!stripe || !env.stripe.webhookSecret) {
      return reply.code(400).send({ error: "billing_not_configured" });
    }
    const sig = req.headers["stripe-signature"];
    if (!sig) return reply.code(400).send({ error: "missing_signature" });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        sig,
        env.stripe.webhookSecret,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "invalid";
      return reply.code(400).send({ error: `signature_verification_failed: ${msg}` });
    }

    try {
      await handleEvent(stripe, event);
    } catch (e) {
      app.log.error(e, "stripe webhook handler failed");
      // 500 tells Stripe to retry.
      return reply.code(500).send({ error: "handler_failed" });
    }
    return { received: true };
  });
}

async function orgIdFor(sub: Stripe.Subscription): Promise<string | null> {
  if (sub.metadata?.organizationId) return sub.metadata.organizationId;
  // Fall back to the customer's stored org mapping.
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const org = await prisma.organization.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  return org?.id ?? null;
}

async function handleEvent(_stripe: Stripe, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const organizationId = session.metadata?.organizationId;
      const plan = session.metadata?.plan;
      if (organizationId && plan) {
        await applyStripePlan({
          organizationId,
          plan,
          status: "active",
          amountCents: session.amount_total,
          currency: session.currency,
        });
      }
      break;
    }
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const organizationId = await orgIdFor(sub);
      const plan = sub.metadata?.plan;
      if (organizationId && plan) {
        // Map Stripe status → our planStatus (active | past_due | canceled).
        const status =
          sub.status === "active" || sub.status === "trialing"
            ? "active"
            : sub.status === "past_due" || sub.status === "unpaid"
              ? "past_due"
              : "canceled";
        await applyStripePlan({ organizationId, plan, status });
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const organizationId = await orgIdFor(sub);
      if (organizationId) {
        // Subscription ended → drop back to free.
        await applyStripePlan({ organizationId, plan: "free", status: "canceled" });
      }
      break;
    }
    default:
      // Ignore unhandled event types.
      break;
  }
}
