import { and, inArray, lt } from "drizzle-orm";
import { db, videosTable, notDeleted } from "@workspace/db";
import { logger } from "./logger";

export async function sweepStuckUploads(): Promise<void> {
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const stuck = await db
    .update(videosTable)
    .set({ uploadError: "Upload has not progressed for more than two hours." })
    .where(
      and(
        inArray(videosTable.streamStatus, ["uploading", "processing"]),
        lt(videosTable.createdAt, cutoff),
        notDeleted(),
      ),
    )
    .returning({ id: videosTable.id });

  if (stuck.length > 0) {
    logger.warn(
      { videoIds: stuck.map(({ id }) => id) },
      "Flagged stuck video uploads",
    );
  }
}

export function startUploadSweep(): void {
  const run = () => {
    void sweepStuckUploads().catch((err) =>
      logger.error({ err }, "Upload sweep failed"),
    );
  };
  run();
  setInterval(run, 60 * 60 * 1000).unref();
}
