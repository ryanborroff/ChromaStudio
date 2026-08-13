import { Router, type IRouter, type Request } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  CreateCheckoutSessionBody,
  CreateCheckoutSessionResponse,
  CreatePortalSessionResponse,
} from "@workspace/api-zod";
import { requireAuth, getCurrentUser } from "../lib/auth";
import {
  getPriceIdForPlan,
  getStripeClient,
  isStripeConfigured,
} from "../lib/stripe";

const router: IRouter = Router();

function appOrigin(req: Request): string {
  const configured = process.env.PUBLIC_APP_URL?.replace(/\/$/, "");
  return configured || `${req.protocol}://${req.get("host")}`;
}

router.post(
  "/billing/checkout-session",
  requireAuth,
  async (req, res): Promise<void> => {
    if (!isStripeConfigured()) {
      res.status(400).json({ error: "Billing is not configured" });
      return;
    }
    const parsed = CreateCheckoutSessionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const priceId = getPriceIdForPlan(parsed.data.plan);
    if (!priceId) {
      res
        .status(400)
        .json({ error: "This plan is not available for checkout yet" });
      return;
    }

    const user = await getCurrentUser(req);
    const stripe = getStripeClient();

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: user.name,
        metadata: { userId: String(user.id) },
      });
      customerId = customer.id;
      await db
        .update(usersTable)
        .set({ stripeCustomerId: customerId })
        .where(eq(usersTable.id, user.id));
    }

    const origin = appOrigin(req);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/account/security?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=cancelled`,
      client_reference_id: String(user.id),
      metadata: { userId: String(user.id), plan: parsed.data.plan },
      subscription_data: {
        metadata: { userId: String(user.id), plan: parsed.data.plan },
      },
    });

    if (!session.url) {
      res.status(502).json({ error: "Could not start checkout" });
      return;
    }

    res.json(CreateCheckoutSessionResponse.parse({ url: session.url }));
  },
);

router.post(
  "/billing/portal-session",
  requireAuth,
  async (req, res): Promise<void> => {
    if (!isStripeConfigured()) {
      res.status(400).json({ error: "Billing is not configured" });
      return;
    }
    const user = await getCurrentUser(req);
    if (!user.stripeCustomerId) {
      res.status(400).json({ error: "No active subscription found" });
      return;
    }

    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appOrigin(req)}/account/security`,
    });

    res.json(CreatePortalSessionResponse.parse({ url: session.url }));
  },
);

export default router;
