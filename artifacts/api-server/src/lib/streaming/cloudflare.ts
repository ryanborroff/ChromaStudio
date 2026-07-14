import { createDirectUpload as cfCreateDirectUpload, deleteStreamVideo } from "../cloudflare.js";
import type { StreamingProvider, DirectUploadResult } from "./provider.js";

export const cloudflareProvider: StreamingProvider = {
  name: "cloudflare",

  async createDirectUpload(): Promise<DirectUploadResult> {
    const result = await cfCreateDirectUpload();
    return { uploadUrl: result.uploadURL, uid: result.uid, uploadMethod: "post" };
  },

  async deleteAsset(uid: string): Promise<void> {
    await deleteStreamVideo(uid);
  },
};
