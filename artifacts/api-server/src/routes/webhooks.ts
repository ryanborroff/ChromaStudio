import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { db, videosTable, usersTable } from "@workspace/db";
import { verifyMuxWebhook } from "../lib/streaming/index.js";
import {
  getPlanForPriceId,
  getStripeClient,
  isStripeConfigured,
} from "../lib/stripe";

const router: IRouter = Router();

async function alertWebhookFailure(
  message: string,
  details?: unknown,
): Promise<void> {
  const payload = { source: "chroma-mux-webhook", message, details };
  console.error(message, details);
  const alertUrl = process.env.ALERT_WEBHOOK_URL;
  if (!alertUrl) return;
  try {
    await fetch(alertUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("Failed to deliver webhook failure alert", err);
  }
}

/**
 * POST /webhooks/mux
 *
 * Handles Mux webhook events. When a video asset finishes processing
 * (video.asset.ready), stores the Mux playback ID and marks the video as ready.
 *
 * Set MUX_WEBHOOK_SECRET in Replit Secrets and configure the webhook URL in
 * the Mux dashboard: https://dashboard.mux.com/settings/webhooks
 * URL: https://<your-domain>/api/webhooks/mux
 */
router.post("/webhooks/mux", (req, res, next) => {
  void (async () => {
    try {
      const secret = process.env.MUX_WEBHOOK_SECRET;
      const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;

      if (secret && rawBody) {
        const valid = verifyMuxWebhook(
          rawBody,
          req.headers as Record<string, string | string[] | undefined>,
          secret,
        );
        if (!valid) {
          void alertWebhookFailure("Mux webhook signature verification failed");
          res.status(400).json({ error: "Invalid webhook signature" });
          return;
        }
      }

      const event = req.body as {
        type?: string;
        data?: {
          id?: string;
          passthrough?: string;
          duration?: number;
          errors?: { messages?: string[] };
          playback_ids?: Array<{ id: string; policy: string }>;
        };
      };

      if (!secret || !rawBody) {
        void alertWebhookFailure("Mux webhook verification is not configured");
        res
          .status(503)
          .json({ error: "Mux webhook verification is not configured" });
        return;
      }

      if (event.type === "video.upload.asset_created") {
        const passthrough = event.data?.passthrough;
        if (passthrough && event.data?.id) {
          await db
            .update(videosTable)
            .set({ streamAssetId: event.data.id, streamStatus: "processing" })
            .where(eq(videosTable.streamUid, passthrough));
        }
      } else if (event.type === "video.asset.ready") {
        const passthrough = event.data?.passthrough;
        const playbackId = event.data?.playback_ids?.[0]?.id;

        if (passthrough && playbackId) {
          await db
            .update(videosTable)
            .set({
              streamPlaybackId: playbackId,
              streamStatus: "ready",
              duration: event.data?.duration ?? undefined,
              thumbnailUrl: `https://image.mux.com/${playbackId}/thumbnail.jpg`,
            })
            .where(eq(videosTable.streamUid, passthrough));
        }
      } else if (event.type === "video.asset.errored") {
        const passthrough = event.data?.passthrough;
        if (passthrough) {
          await db
            .update(videosTable)
            .set({
              streamStatus: "error",
              uploadError:
                event.data?.errors?.messages?.join("; ") ??
                "Mux asset processing failed",
            })
            .where(eq(videosTable.streamUid, passthrough));
        }
      }

      res.json({ ok: true });
    } catch (err) {
      void alertWebhookFailure(
        "Mux webhook processing failed",
        err instanceof Error ? err.message : err,
      );
      next(err);
    }
  })();
});

// Syncs a Stripe subscription's plan/status/period onto the matching user,
// looked up by Stripe customer id. Shared by checkout completion and every
// subsequent subscription-updated event so there's one source of truth for
// "what plan does this customer's subscription map to right now".
async function syncSubscriptionToUser(
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;
  if (!customerId) return;

  const item = subscription.items.data[0];
  const priceId = item?.price.id;
  const plan = priceId ? getPlanForPriceId(priceId) : null;
  const isActive =
    subscription.status === "active" || subscription.status === "trialing";

  await db
    .update(usersTable)
    .set({
      // Falls back to "free" if the subscription is no longer active, or if
      // the price on it doesn't match a plan we recognize (e.g. it was
      // changed to something outside STRIPE_PRICE_* in the Stripe dashboard).
      plan: isActive && plan ? plan : "free",
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      currentPeriodEnd: item ? new Date(item.current_period_end * 1000) : null,
    })
    .where(eq(usersTable.stripeCustomerId, customerId));
}

/**
 * POST /webhooks/stripe
 *
 * Handles Stripe webhook events that keep a user's plan in sync with their
 * subscription. This is the ONLY code path that ever sets `plan` to a paid
 * tier for a real customer — see routes/billing.ts for how checkout starts.
 *
 * Set STRIPE_WEBHOOK_SECRET in Replit Secrets and configure the webhook URL
 * in the Stripe dashboard (Developers -> Webhooks):
 * URL: https://<your-domain>/api/webhooks/stripe
 * Events: checkout.session.completed, customer.subscription.updated,
 * customer.subscription.deleted
 */
router.post("/webhooks/stripe", (req, res, next) => {
  void (async () => {
    try {
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
      const signature = req.headers["stripe-signature"];

      if (!isStripeConfigured() || !secret || !rawBody) {
        void alertWebhookFailure(
          "Stripe webhook verification is not configured",
        );
        res
          .status(503)
          .json({ error: "Stripe webhook verification is not configured" });
        return;
      }
      if (!signature || Array.isArray(signature)) {
        res.status(400).json({ error: "Missing Stripe-Signature header" });
        return;
      }

      const stripe = getStripeClient();
      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(rawBody, signature, secret);
      } catch (err) {
        void alertWebhookFailure(
          "Stripe webhook signature verification failed",
          err instanceof Error ? err.message : err,
        );
        res.status(400).json({ error: "Invalid webhook signature" });
        return;
      }

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          if (typeof session.subscription === "string") {
            const subscription = await stripe.subscriptions.retrieve(
              session.subscription,
            );
            await syncSubscriptionToUser(subscription);
          }
          break;
        }
        case "customer.subscription.updated": {
          await syncSubscriptionToUser(
            event.data.object as Stripe.Subscription,
          );
          break;
        }
        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId =
            typeof subscription.customer === "string"
              ? subscription.customer
              : subscription.customer?.id;
          if (customerId) {
            await db
              .update(usersTable)
              .set({ plan: "free", subscriptionStatus: "canceled" })
              .where(eq(usersTable.stripeCustomerId, customerId));
          }
          break;
        }
        default:
          break;
      }

      res.json({ ok: true });
    } catch (err) {
      void alertWebhookFailure(
        "Stripe webhook processing failed",
        err instanceof Error ? err.message : err,
      );
      next(err);
    }
  })();
});

export default router;
