import { Router, type IRouter } from "express";
import { sql, desc, eq } from "drizzle-orm";
import { db, usersTable, videosTable, projectsTable } from "@workspace/db";
import { GetPlatformStatsResponse, GetFeaturedContentResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// GET /stats/platform
router.get("/stats/platform", async (_req, res): Promise<void> => {
  const [userCount] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);
  const [videoCount] = await db.select({ count: sql<number>`count(*)::int` }).from(videosTable);
  const [projectCount] = await db.select({ count: sql<number>`count(*)::int` }).from(projectsTable);

  const professions = await db
    .select({
      profession: usersTable.profession,
      count: sql<number>`count(*)::int`,
    })
    .from(usersTable)
    .groupBy(usersTable.profession);

  res.json(
    GetPlatformStatsResponse.parse({
      totalUsers: userCount?.count ?? 0,
      totalVideos: videoCount?.count ?? 0,
      totalProjects: projectCount?.count ?? 0,
      professionBreakdown: professions,
    }),
  );
});

// GET /stats/featured
router.get("/stats/featured", async (_req, res): Promise<void> => {
  const filmmakers = await db
    .select()
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt))
    .limit(6);

  const videos = await db
    .select()
    .from(videosTable)
    .where(eq(videosTable.privacy, "public"))
    .orderBy(desc(videosTable.viewCount))
    .limit(8);

  const enrichedFilmmakers = filmmakers.map((u) => ({
    ...u,
    skills: u.skills ?? [],
    socialLinks: u.socialLinks ?? null,
    followerCount: 0,
    followingCount: 0,
    videoCount: 0,
    isFollowing: false,
  }));

  const enrichedVideos = await Promise.all(
    videos.map(async (v) => {
      const [user] = await db
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
        user: user
          ? {
              ...user,
              skills: user.skills ?? [],
              socialLinks: user.socialLinks ?? null,
              followerCount: 0,
              followingCount: 0,
              videoCount: 0,
              isFollowing: false,
            }
          : null,
      };
    }),
  );

  res.json(
    GetFeaturedContentResponse.parse({
      filmmakers: enrichedFilmmakers,
      videos: enrichedVideos,
    }),
  );
});

export default router;
