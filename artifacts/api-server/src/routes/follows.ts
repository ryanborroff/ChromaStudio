import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, followsTable, usersTable } from "@workspace/db";
import { requireAuth, getCurrentUser } from "../lib/auth";
import { FollowUserResponse, ListFollowersResponse, ListFollowingResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// POST /follows/:userId
router.post("/follows/:userId", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const targetId = parseInt(rawId, 10);
  const user = await getCurrentUser(req);

  if (user.id === targetId) {
    res.status(400).json({ error: "Cannot follow yourself" });
    return;
  }

  const existing = await db
    .select()
    .from(followsTable)
    .where(sql`${followsTable.followerId} = ${user.id} AND ${followsTable.followingId} = ${targetId}`)
    .limit(1);

  let following: boolean;
  if (existing.length > 0) {
    await db
      .delete(followsTable)
      .where(sql`${followsTable.followerId} = ${user.id} AND ${followsTable.followingId} = ${targetId}`);
    following = false;
  } else {
    await db.insert(followsTable).values({ followerId: user.id, followingId: targetId });
    following = true;
  }

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(followsTable)
    .where(eq(followsTable.followingId, targetId));

  res.json(FollowUserResponse.parse({ following, followerCount: countRow?.count ?? 0 }));
});

async function buildSimpleUser(user: typeof usersTable.$inferSelect) {
  const [followerCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(followsTable)
    .where(eq(followsTable.followingId, user.id));
  const [followingCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(followsTable)
    .where(eq(followsTable.followerId, user.id));
  return {
    ...user,
    skills: user.skills ?? [],
    socialLinks: user.socialLinks ?? null,
    followerCount: followerCountRow?.count ?? 0,
    followingCount: followingCountRow?.count ?? 0,
    videoCount: 0,
    isFollowing: false,
  };
}

// GET /follows/:userId/followers
router.get("/follows/:userId/followers", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const targetId = parseInt(rawId, 10);

  const rows = await db
    .select({ user: usersTable })
    .from(followsTable)
    .innerJoin(usersTable, eq(followsTable.followerId, usersTable.id))
    .where(eq(followsTable.followingId, targetId));

  const users = await Promise.all(rows.map((r) => buildSimpleUser(r.user)));
  res.json(ListFollowersResponse.parse({ users, total: users.length }));
});

// GET /follows/:userId/following
router.get("/follows/:userId/following", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const targetId = parseInt(rawId, 10);

  const rows = await db
    .select({ user: usersTable })
    .from(followsTable)
    .innerJoin(usersTable, eq(followsTable.followingId, usersTable.id))
    .where(eq(followsTable.followerId, targetId));

  const users = await Promise.all(rows.map((r) => buildSimpleUser(r.user)));
  res.json(ListFollowingResponse.parse({ users, total: users.length }));
});

export default router;
