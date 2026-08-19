import { createHash } from "node:crypto";
import type { Readable } from "node:stream";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { and, eq, isNotNull } from "drizzle-orm";
import { db, videosTable, notDeleted } from "@workspace/db";
import { getR2Client, getR2Bucket } from "./r2Client";
import { logger } from "./logger";

async function hashObject(key: string): Promise<string> {
  const response = await getR2Client().send(
    new GetObjectCommand({ Bucket: getR2Bucket(), Key: key }),
  );
  const hash = createHash("sha256");
  for await (const chunk of response.Body as Readable) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

export async function checkVideoIntegrity(): Promise<void> {
  const videos = await db
    .select({
      id: videosTable.id,
      storageKey: videosTable.storageKey,
      fileSizeBytes: videosTable.fileSizeBytes,
      checksumSha256: videosTable.checksumSha256,
    })
    .from(videosTable)
    .where(and(notDeleted(), isNotNull(videosTable.storageKey)));

  for (const video of videos) {
    const key = video.storageKey!;
    try {
      const head = await getR2Client().send(
        new HeadObjectCommand({ Bucket: getR2Bucket(), Key: key }),
      );
      if (
        video.fileSizeBytes != null &&
        head.ContentLength !== video.fileSizeBytes
      ) {
        logger.warn(
          {
            videoId: video.id,
            expected: video.fileSizeBytes,
            actual: head.ContentLength,
          },
          "Video size mismatch detected",
        );
        await db
          .update(videosTable)
          .set({ uploadError: "Integrity check: size mismatch" })
          .where(eq(videosTable.id, video.id));
      }

      if (!video.checksumSha256) {
        const checksum = await hashObject(key);
        await db
          .update(videosTable)
          .set({ checksumSha256: checksum })
          .where(eq(videosTable.id, video.id));
      }
    } catch (err) {
      logger.error(
        { err, videoId: video.id },
        "Video integrity check: object missing or unreadable",
      );
      await db
        .update(videosTable)
        .set({ uploadError: "Integrity check: object not found in storage" })
        .where(eq(videosTable.id, video.id));
    }
  }
}

export function startVideoIntegrityCheck(): void {
  const run = () => {
    void checkVideoIntegrity().catch((err) =>
      logger.error({ err }, "Video integrity check failed"),
    );
  };
  run();
  setInterval(run, 6 * 60 * 60 * 1000).unref();
}
