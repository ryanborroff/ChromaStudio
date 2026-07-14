import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, videosTable } from "@workspace/db";
import { verifyMuxWebhook } from "../lib/streaming/index.js";

const router: IRouter = Router();

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
        const valid = verifyMuxWebhook(rawBody, req.headers as Record<string, string | string[] | undefined>, secret);
        if (!valid) {
          res.status(400).json({ error: "Invalid webhook signature" });
          return;
        }
      }

      const event = req.body as {
        type?: string;
        data?: {
          passthrough?: string;
          playback_ids?: Array<{ id: string; policy: string }>;
        };
      };

      if (event.type === "video.asset.ready") {
        const passthrough = event.data?.passthrough;
        const playbackId = event.data?.playback_ids?.[0]?.id;

        if (passthrough && playbackId) {
          await db
            .update(videosTable)
            .set({ streamPlaybackId: playbackId, streamStatus: "ready" })
            .where(eq(videosTable.streamUid, passthrough));
        }
      }

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  })();
});

export default router;
