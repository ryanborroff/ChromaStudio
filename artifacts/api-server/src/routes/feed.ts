import { Router, type IRouter } from "express";
import { eq, sql, desc, inArray } from "drizzle-orm";
import { db, videosTable, usersTable, followsTable } from "@workspace/db";
import { requireAuth, getCurrentUser } from "../lib/auth";
import { GetFeedResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// GET /feed
router.get("/feed", requireAuth, async (req, res): Promise<void> => {
  const { limit = "20", offset = "0" } = req.query as Record<string, string>;
  const user = await getCurrentUser(req);

  // Get users the current user follows
  const following = await db
    .select({ followingId: followsTable.followingId })
    .from(followsTable)
    .where(eq(followsTable.followerId, user.id));

  const followingIds = following.map((f) => f.followingId);

  // Get videos from followed users + public featured videos
  let videos: any[];
  if (followingIds.length > 0) {
    videos = await db
      .select()
      .from(videosTable)
      .where(sql`${videosTable.userId} = ANY(${followingIds}) AND ${videosTable.privacy} = 'public'`)
      .orderBy(desc(videosTable.createdAt))
      .limit(parseInt(limit))
      .offset(parseInt(offset))
      .catch(() =>
        db
          .select()
          .from(videosTable)
          .where(eq(videosTable.privacy, "public"))
          .orderBy(desc(videosTable.createdAt))
          .limit(parseInt(limit))
          .offset(parseInt(offset)),
      );
  } else {
    // Show all public videos if not following anyone
    videos = await db
      .select()
      .from(videosTable)
      .where(eq(videosTable.privacy, "public"))
      .orderBy(desc(videosTable.createdAt))
      .limit(parseInt(limit))
      .offset(parseInt(offset));
  }

  const enriched = await Promise.all(
    videos.map(async (v) => {
      const [videoUser] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, v.userId))
        .limit(1);
      const { sharePasswordHash, shareToken: _t, ...rest } = v;
      return {
        ...rest,
        tags: v.tags ?? [],
        shareToken: null,
        hasSharePassword: !!sharePasswordHash,
        isLiked: false,
        user: videoUser
          ? {
              ...videoUser,
              skills: videoUser.skills ?? [],
              socialLinks: videoUser.socialLinks ?? null,
              followerCount: 0,
              followingCount: 0,
              videoCount: 0,
              isFollowing: true,
            }
          : null,
      };
    }),
  );

  res.json(GetFeedResponse.parse({ videos: enriched, total: enriched.length }));
});

export default router;
