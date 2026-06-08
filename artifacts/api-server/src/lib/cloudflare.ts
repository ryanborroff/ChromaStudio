const CF_API_BASE = "https://api.cloudflare.com/client/v4";

export function getStreamConfig(): { accountId: string; token: string } | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_STREAM_API_TOKEN;
  if (!accountId || !token) return null;
  return { accountId, token };
}

export interface DirectUploadResult {
  uploadURL: string;
  uid: string;
}

/**
 * Requests a one-time direct creator upload URL from Cloudflare Stream.
 * The browser uploads the file straight to this URL, so video bytes never
 * pass through our server.
 */
export async function createDirectUpload(
  maxDurationSeconds = 3600,
): Promise<DirectUploadResult> {
  const config = getStreamConfig();
  if (!config) {
    throw new Error("Cloudflare Stream is not configured");
  }

  const resp = await fetch(
    `${CF_API_BASE}/accounts/${config.accountId}/stream/direct_upload`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ maxDurationSeconds }),
    },
  );

  const data = (await resp.json()) as {
    success: boolean;
    result?: { uploadURL: string; uid: string };
    errors?: unknown;
  };

  if (!resp.ok || !data.success || !data.result) {
    throw new Error(
      `Cloudflare Stream upload URL request failed: ${JSON.stringify(data.errors ?? data)}`,
    );
  }

  return { uploadURL: data.result.uploadURL, uid: data.result.uid };
}

/**
 * Best-effort deletion of a Stream video by UID. Used to clean up orphaned
 * uploads when persisting the video record fails. Never throws.
 */
export async function deleteStreamVideo(uid: string): Promise<void> {
  const config = getStreamConfig();
  if (!config) return;
  try {
    await fetch(`${CF_API_BASE}/accounts/${config.accountId}/stream/${uid}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${config.token}` },
    });
  } catch {
    // swallow: cleanup is best-effort
  }
}
