import { muxProvider } from "./mux.js";
import { cloudflareProvider } from "./cloudflare.js";
import type { StreamingProvider } from "./provider.js";

export type { StreamingProvider, ProviderName, DirectUploadResult } from "./provider.js";
export { verifyMuxWebhook } from "./mux.js";

/**
 * Returns the active streaming provider based on configured environment variables.
 *
 * Priority: Mux → Cloudflare Stream → null (falls back to Replit Object Storage)
 *
 * To switch providers, set the relevant env vars and restart. No code changes needed.
 */
export function getStreamingProvider(): StreamingProvider | null {
  if (process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET) {
    return muxProvider;
  }
  if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_STREAM_API_TOKEN) {
    return cloudflareProvider;
  }
  return null;
}
