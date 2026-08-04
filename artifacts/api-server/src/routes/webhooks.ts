import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, videosTable } from "@workspace/db";
import { verifyMuxWebhook } from "../lib/streaming/index.js";

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

export default router;
