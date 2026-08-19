import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, exportJobsTable, videosTable, notDeleted } from "@workspace/db";
import {
  RequestBulkExportBody,
  ListExportJobsResponse,
  ListExportJobsResponseItem,
  RequestVideoExportResponse,
} from "@workspace/api-zod";
import { requireAuth, getCurrentUser } from "../lib/auth";
import { getStreamingProvider } from "../lib/streaming";

const router: IRouter = Router();

async function directExportUrl(
  video: typeof videosTable.$inferSelect,
): Promise<string | null> {
  if (video.videoUrl) return video.videoUrl;
  const provider = getStreamingProvider();
  if (!provider || video.streamStatus !== "ready" || !video.streamUid)
    return null;
  return provider.createExportUrl(video.streamUid, video.streamPlaybackId);
}

router.post(
  "/videos/:id/export",
  requireAuth,
  async (req, res): Promise<void> => {
    const user = await getCurrentUser(req);
    const id = Number(req.params.id);
    const [video] = await db
      .select()
      .from(videosTable)
      .where(
        and(
          eq(videosTable.id, id),
          eq(videosTable.userId, user.id),
          notDeleted(),
        ),
      )
      .limit(1);
    if (!video) {
      res.status(404).json({ error: "Video not found" });
      return;
    }

    const downloadUrl = await directExportUrl(video);
    if (!downloadUrl) {
      res.status(400).json({ error: "This video is not ready for export" });
      return;
    }

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    res.json(
      RequestVideoExportResponse.parse({
        videoId: video.id,
        downloadUrl,
        expiresAt,
      }),
    );
  },
);

router.post("/exports", requireAuth, async (req, res): Promise<void> => {
  const parsed = RequestBulkExportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await getCurrentUser(req);
  const { scope, targetId } = parsed.data;

  let videos;
  if (scope === "video") {
    videos = await db
      .select()
      .from(videosTable)
      .where(
        and(
          eq(videosTable.id, Number(targetId)),
          eq(videosTable.userId, user.id),
          notDeleted(),
        ),
      );
  } else if (scope === "project") {
    res
      .status(400)
      .json({
        error:
          "Project exports are not available until videos are linked to projects",
      });
    return;
  } else {
    videos = await db
      .select()
      .from(videosTable)
      .where(and(eq(videosTable.userId, user.id), notDeleted()));
  }

  const downloadUrls = (await Promise.all(videos.map(directExportUrl))).filter(
    (url): url is string => Boolean(url),
  );
  const [job] = await db
    .insert(exportJobsTable)
    .values({
      ownerId: user.id,
      scope,
      targetId: targetId ?? "account",
      status: "ready",
      downloadUrls,
      completedAt: new Date(),
    })
    .returning();

  res.status(202).json(ListExportJobsResponseItem.parse(job));
});

router.get("/exports", requireAuth, async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  const jobs = await db
    .select()
    .from(exportJobsTable)
    .where(eq(exportJobsTable.ownerId, user.id))
    .orderBy(desc(exportJobsTable.createdAt));
  res.json(ListExportJobsResponse.parse(jobs));
});

export default router;
