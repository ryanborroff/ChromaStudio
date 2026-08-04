import { Router, type IRouter } from "express";
import { and, desc, eq, gt } from "drizzle-orm";
import { analyticsCacheTable, db, videosTable } from "@workspace/db";
import { requireAuth, getCurrentUser } from "../lib/auth";
import {
  fetchMuxVideoAnalytics,
  localVideoAnalytics,
  type VideoAnalytics,
} from "../lib/analytics";

const router: IRouter = Router();
const CACHE_TTL_MS = 10 * 60 * 1000;

async function analyticsForVideo(
  video: typeof videosTable.$inferSelect,
): Promise<VideoAnalytics> {
  const [cached] = await db
    .select()
    .from(analyticsCacheTable)
    .where(
      and(
        eq(analyticsCacheTable.videoId, video.id),
        gt(analyticsCacheTable.fetchedAt, new Date(Date.now() - CACHE_TTL_MS)),
      ),
    )
    .limit(1);
  if (cached) return cached.data as VideoAnalytics;

  let fresh: VideoAnalytics | null = null;
  if (video.streamProvider === "mux" && video.streamPlaybackId) {
    try {
      fresh = await fetchMuxVideoAnalytics(
        video.streamPlaybackId,
        video.duration,
      );
    } catch {
      fresh = null;
    }
  }
  const data = fresh ?? localVideoAnalytics(video.viewCount);
  await db
    .insert(analyticsCacheTable)
    .values({ videoId: video.id, data })
    .onConflictDoUpdate({
      target: analyticsCacheTable.videoId,
      set: { data, fetchedAt: new Date() },
    });
  return data;
}

router.get(
  "/videos/:id/analytics",
  requireAuth,
  async (req, res): Promise<void> => {
    const user = await getCurrentUser(req);
    const id = Number(req.params.id);
    const [video] = await db
      .select()
      .from(videosTable)
      .where(and(eq(videosTable.id, id), eq(videosTable.userId, user.id)))
      .limit(1);
    if (!video) {
      res.status(404).json({ error: "Video not found" });
      return;
    }
    res.json(await analyticsForVideo(video));
  },
);

router.get(
  "/analytics/portfolio",
  requireAuth,
  async (req, res): Promise<void> => {
    const user = await getCurrentUser(req);
    const videos = await db
      .select()
      .from(videosTable)
      .where(
        and(
          eq(videosTable.userId, user.id),
          eq(videosTable.isPortfolioPiece, true),
          eq(videosTable.privacy, "public"),
          eq(videosTable.streamStatus, "ready"),
        ),
      )
      .orderBy(desc(videosTable.viewCount));
    const analytics = await Promise.all(
      videos.map(async (video) => ({
        video,
        data: await analyticsForVideo(video),
      })),
    );
    const totalViews = analytics.reduce(
      (sum, item) => sum + item.data.views,
      0,
    );
    res.json({
      totalViews,
      videoCount: videos.length,
      videos: analytics.map(({ video, data }) => ({
        videoId: video.id,
        title: video.portfolioTitle || video.title,
        views: data.views,
        completionRatePercent: data.completionRatePercent,
      })),
    });
  },
);

export default router;
