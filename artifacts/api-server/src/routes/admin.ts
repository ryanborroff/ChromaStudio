import { Router, type IRouter } from "express";
import { eq, ilike, sql } from "drizzle-orm";
import { db, usersTable, videosTable, followsTable } from "@workspace/db";
import { requireAuth, getCurrentUser } from "../lib/auth";
import { AdminToggleFeaturedBody } from "@workspace/api-zod";

const router: IRouter = Router();

async function requireAdmin(req: any, res: any): Promise<typeof usersTable.$inferSelect | null> {
  const user = await getCurrentUser(req);
  if (!user.isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return null;
  }
  return user;
}

async function buildAdminUserResponse(user: typeof usersTable.$inferSelect) {
  const [followerCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(followsTable)
    .where(eq(followsTable.followingId, user.id));
  const [videoCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(videosTable)
    .where(eq(videosTable.userId, user.id));
  const { googleId: _g, appleId: _a, email: _e, passwordHash: _p, ...safe } = user;
  return {
    ...safe,
    followerCount: followerCountRow?.count ?? 0,
    followingCount: 0,
    videoCount: videoCountRow?.count ?? 0,
    isFollowing: false,
    skills: user.skills ?? [],
    socialLinks: user.socialLinks ?? null,
    credits: (user.credits as unknown[] | null) ?? [],
    isAdmin: user.isAdmin,
    endorsementCount: 0,
  };
}

// GET /admin/users
router.get("/admin/users", requireAuth, async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { search, limit = "50", offset = "0" } = req.query as Record<string, string>;

  let query = db.select().from(usersTable);
  if (search) {
    query = query.where(
      ilike(usersTable.name, `%${search}%`)
    ) as typeof query;
  }

  const users = await query
    .orderBy(sql`${usersTable.createdAt} desc`)
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  const [countRow] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);

  const enriched = await Promise.all(users.map(buildAdminUserResponse));

  res.json({ users: enriched, total: countRow?.count ?? 0 });
});

// DELETE /admin/users/:userId
router.delete("/admin/users/:userId", requireAuth, async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const userId = parseInt(String(req.params.userId), 10);
  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }
  if (userId === admin.id) {
    res.status(400).json({ error: "Cannot delete yourself" });
    return;
  }

  await db.delete(usersTable).where(eq(usersTable.id, userId));
  res.json({ ok: true });
});

// PATCH /admin/videos/:videoId/featured
router.patch("/admin/videos/:videoId/featured", requireAuth, async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const videoId = parseInt(String(req.params.videoId), 10);
  if (isNaN(videoId)) {
    res.status(400).json({ error: "Invalid video id" });
    return;
  }

  const parsed = AdminToggleFeaturedBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [video] = await db
    .update(videosTable)
    .set({ isFeatured: parsed.data.featured })
    .where(eq(videosTable.id, videoId))
    .returning();

  if (!video) {
    res.status(404).json({ error: "Video not found" });
    return;
  }

  const [owner] = await db.select().from(usersTable).where(eq(usersTable.id, video.userId)).limit(1);
  const ownerSnippet = owner ? await buildAdminUserResponse(owner) : null;

  const { sharePasswordHash, shareToken: _t, ratingSum: _rs, ...rest } = video;
  res.json({
    ...rest,
    tags: video.tags ?? [],
    shareToken: null,
    hasSharePassword: !!sharePasswordHash,
    isLiked: false,
    ratingAvg: video.ratingCount > 0 ? video.ratingSum / video.ratingCount : 0,
    userRating: null,
    user: ownerSnippet,
  });
});

export default router;
