import { and, eq, isNotNull, lt } from "drizzle-orm";
import { db, videosTable } from "@workspace/db";
import { ObjectStorageService } from "./objectStorage";
import { getStreamingProvider } from "./streaming/index.js";
import { logger } from "./logger";

const objectStorage = new ObjectStorageService();

export async function purgeExpiredVideos(): Promise<void> {
  const now = new Date();
  const candidates = await db
    .select({
      id: videosTable.id,
      storageKey: videosTable.storageKey,
      streamProvider: videosTable.streamProvider,
      streamUid: videosTable.streamUid,
    })
    .from(videosTable)
    .where(and(isNotNull(videosTable.deletedAt), lt(videosTable.purgeAfter, now)));

  let purgedCount = 0;
  for (const video of candidates) {
    try {
      if (video.storageKey) {
        await objectStorage.deleteObject(video.storageKey);
      }
      if (video.streamProvider && video.streamUid) {
        const provider = getStreamingProvider();
        if (provider) await provider.deleteAsset(video.streamUid);
      }
      await db.delete(videosTable).where(eq(videosTable.id, video.id));
      purgedCount++;
    } catch (err) {
      logger.error({ err, videoId: video.id }, "Failed to purge video");
      // Leave the row soft-deleted so the next sweep retries.
    }
  }

  if (purgedCount > 0) {
    logger.info({ count: purgedCount }, "Purged expired videos");
  }
}

export function startVideoPurge(): void {
  const run = () => {
    void purgeExpiredVideos().catch((err) =>
      logger.error({ err }, "Video purge sweep failed"),
    );
  };
  run();
  setInterval(run, 60 * 60 * 1000).unref();
}
