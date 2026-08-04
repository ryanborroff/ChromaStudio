export type ProviderName = "mux" | "cloudflare";

export interface DirectUploadResult {
  uploadUrl: string;
  uid: string;
  uploadMethod: "put" | "post";
}

/**
 * Common interface every streaming provider must implement.
 * Add a new provider by creating a file that exports an object implementing
 * this interface, then register it in index.ts.
 */
export interface StreamingProvider {
  readonly name: ProviderName;
  /** Create a one-time direct-upload URL. The browser uploads straight to it. */
  createDirectUpload(): Promise<DirectUploadResult>;
  /** Best-effort asset cleanup on failed video record creation. Never throws. */
  deleteAsset(uid: string): Promise<void>;
  /** Return a provider-hosted download URL for a ready asset. */
  createExportUrl(
    uid: string,
    playbackId?: string | null,
  ): Promise<string | null>;
}
