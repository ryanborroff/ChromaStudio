import Mux from "@mux/mux-node";
import crypto from "crypto";
import type { StreamingProvider, DirectUploadResult } from "./provider.js";

function getMuxClient(): Mux {
  return new Mux({
    tokenId: process.env.MUX_TOKEN_ID!,
    tokenSecret: process.env.MUX_TOKEN_SECRET!,
  });
}

export const muxProvider: StreamingProvider = {
  name: "mux",

  async createDirectUpload(): Promise<DirectUploadResult> {
    const uid = crypto.randomUUID();
    const mux = getMuxClient();
    const upload = await mux.video.uploads.create({
      cors_origin: "*",
      new_asset_settings: {
        playback_policy: ["public"],
        passthrough: uid,
      },
    });
    if (!upload.url) throw new Error("Mux did not return an upload URL");
    return { uploadUrl: upload.url, uid, uploadMethod: "put" };
  },

  async deleteAsset(_uid: string): Promise<void> {
    // Mux cleanup requires the Mux asset ID, which only arrives via webhook
    // (video.asset.ready). Cleanup of abandoned uploads is best handled via
    // the Mux dashboard or a periodic job. This is intentionally a no-op.
  },
};

/**
 * Verifies a Mux webhook signature using the HMAC-SHA256 method.
 * Returns true if valid, or if MUX_WEBHOOK_SECRET is not set (dev convenience).
 */
export function verifyMuxWebhook(
  rawBody: Buffer,
  headers: Record<string, string | string[] | undefined>,
  secret: string,
): boolean {
  const sigHeader = Array.isArray(headers["mux-signature"])
    ? headers["mux-signature"][0]
    : headers["mux-signature"];
  if (!sigHeader) return false;

  const parts: Record<string, string> = {};
  for (const part of sigHeader.split(",")) {
    const idx = part.indexOf("=");
    if (idx > 0) parts[part.slice(0, idx)] = part.slice(idx + 1);
  }
  const timestamp = parts["t"];
  const expected = parts["v1"];
  if (!timestamp || !expected) return false;

  const hmac = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody.toString()}`)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(hmac, "hex"),
      Buffer.from(expected, "hex"),
    );
  } catch {
    return false;
  }
}
