import { Router, type IRouter } from "express";
import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, subscriptionsTable, usersTable } from "@workspace/db";
import { requireAuth, getCurrentUser } from "../lib/auth";
import {
  getAppUrl,
  getEntitlementsForUser,
  getStripeClient,
  PLAN_CONFIG,
} from "../lib/billing";

const router: IRouter = Router();

router.get("/billing/plans", (_req, res) => {
  res.json(
    Object.entries(PLAN_CONFIG).map(([planId, plan]) => ({
      planId,
      ...plan,
    })),
  );
});

router.get("/billing/entitlements", requireAuth, async (req, res) => {
  const user = await getCurrentUser(req);
  res.json(await getEntitlementsForUser(user.id));
});

router.post(
  "/billing/checkout",
  requireAuth,
  async (req, res): Promise<void> => {
    const stripe = getStripeClient();
    const user = await getCurrentUser(req);
    const planId = typeof req.body?.planId === "string" ? req.body.planId : "";
    const plan = PLAN_CONFIG[planId];
    if (!stripe) {
      res.status(503).json({ error: "Billing is not configured" });
      return;
    }
    if (!plan || !plan.stripePriceId || planId === "free") {
      res
        .status(400)
        .json({ error: "That plan is not available for checkout" });
      return;
    }
    try {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: plan.stripePriceId, quantity: 1 }],
        client_reference_id: String(user.id),
        customer_email: user.email ?? undefined,
        success_url: `${getAppUrl()}/account/billing?checkout=success`,
        cancel_url: `${getAppUrl()}/account/billing?checkout=cancelled`,
        subscription_data: { metadata: { userId: String(user.id), planId } },
      });
      res.json({ url: session.url });
    } catch (error) {
      req.log.error({ err: error }, "Failed to create Stripe checkout session");
      res.status(502).json({ error: "Could not start checkout" });
    }
  },
);

router.post("/billing/portal", requireAuth, async (req, res): Promise<void> => {
  const stripe = getStripeClient();
  const user = await getCurrentUser(req);
  if (!stripe) {
    res.status(503).json({ error: "Billing is not configured" });
    return;
  }
  const [subscription] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, user.id))
    .limit(1);
  if (!subscription?.stripeCustomerId) {
    res.status(400).json({ error: "No billing customer exists yet" });
    return;
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${getAppUrl()}/account/billing`,
  });
  res.json({ url: session.url });
});

router.post("/webhooks/stripe", (req, res): void => {
  const stripe = getStripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers["stripe-signature"];
  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
  if (!stripe || !secret || !rawBody || typeof signature !== "string") {
    res
      .status(503)
      .json({ error: "Stripe webhook verification is not configured" });
    return;
  }
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    res.status(400).json({ error: "Invalid webhook signature" });
    return;
  }
  void handleStripeEvent(event)
    .then(() => res.json({ received: true }))
    .catch((error: unknown) => {
      req.log.error({ err: error }, "Failed to process Stripe webhook");
      res.status(500).json({ error: "Webhook processing failed" });
    });
});

async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = Number(session.client_reference_id);
    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
    if (!userId || !subscriptionId) return;
    const stripe = getStripeClient();
    if (!stripe) return;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const planId = subscription.metadata.planId || "creator";
    await upsertSubscription(userId, planId, subscription);
    return;
  }
  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const [row] = await db
      .select({ userId: subscriptionsTable.userId })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.stripeSubscriptionId, subscription.id))
      .limit(1);
    if (row) {
      await upsertSubscription(
        row.userId,
        subscription.metadata.planId || "creator",
        subscription,
      );
    }
    return;
  }
  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionDetails =
      invoice.parent?.type === "subscription_details"
        ? invoice.parent.subscription_details
        : null;
    const subscriptionId = subscriptionDetails
      ? typeof subscriptionDetails.subscription === "string"
        ? subscriptionDetails.subscription
        : subscriptionDetails.subscription.id
      : undefined;
    if (subscriptionId) {
      await db
        .update(subscriptionsTable)
        .set({ status: "past_due", updatedAt: new Date() })
        .where(eq(subscriptionsTable.stripeSubscriptionId, subscriptionId));
    }
  }
}

async function upsertSubscription(
  userId: number,
  planId: string,
  subscription: Stripe.Subscription,
): Promise<void> {
  const values = {
    planId,
    stripeCustomerId:
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id,
    stripeSubscriptionId: subscription.id,
    status: ([
      subscription.status === "active" ||
      subscription.status === "past_due" ||
      subscription.status === "canceled" ||
      subscription.status === "trialing"
        ? subscription.status
        : "past_due",
    ][0] ?? "past_due") as "active" | "past_due" | "canceled" | "trialing",
    currentPeriodEnd: subscription.items.data[0]?.current_period_end
      ? new Date(subscription.items.data[0].current_period_end * 1000)
      : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    updatedAt: new Date(),
  } as const;
  await db
    .insert(subscriptionsTable)
    .values({ userId, ...values })
    .onConflictDoUpdate({
      target: subscriptionsTable.userId,
      set: values,
    });
  await db
    .update(usersTable)
    .set({ plan: planId })
    .where(eq(usersTable.id, userId));
}

export default router;
