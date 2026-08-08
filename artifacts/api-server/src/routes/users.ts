import { Router, type IRouter } from "express";
import { eq, ilike, or, sql } from "drizzle-orm";
import { db, usersTable, videosTable, followsTable, endorsementsTable } from "@workspace/db";
import { requireAuth, getCurrentUser } from "../lib/auth";
import {
  GetMeResponse,
  UpdateMeBody,
  UpdateMeResponse,
  ListUsersResponse,
  GetUserByUsernameResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function buildUserResponse(user: typeof usersTable.$inferSelect, currentUserId?: number) {
  const [followerCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(followsTable)
    .where(eq(followsTable.followingId, user.id));

  const [followingCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(followsTable)
    .where(eq(followsTable.followerId, user.id));

  const [videoCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(videosTable)
    .where(eq(videosTable.userId, user.id));

  const [endorsementCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(endorsementsTable)
    .where(eq(endorsementsTable.toUserId, user.id));

  let isFollowing = false;
  if (currentUserId && currentUserId !== user.id) {
    const followRow = await db
      .select()
      .from(followsTable)
      .where(eq(followsTable.followerId, currentUserId))
      .limit(1);
    isFollowing = followRow.length > 0;
  }

  const { googleId: _googleId, appleId: _appleId, email: _email, passwordHash: _passwordHash, ...safeUser } = user;

  return {
    ...safeUser,
    followerCount: followerCountRow?.count ?? 0,
    followingCount: followingCountRow?.count ?? 0,
    videoCount: videoCountRow?.count ?? 0,
    endorsementCount: endorsementCountRow?.count ?? 0,
    isFollowing,
    skills: user.skills ?? [],
    socialLinks: user.socialLinks ?? null,
    credits: (user.credits as unknown[] | null) ?? [],
    isAdmin: user.isAdmin,
  };
}

// GET /users/me
router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  const full = await buildUserResponse(user, user.id);
  res.json(GetMeResponse.parse(full));
});

// PATCH /users/me
router.patch("/users/me", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await getCurrentUser(req);
  const [updated] = await db
    .update(usersTable)
    .set(parsed.data as Partial<typeof usersTable.$inferInsert>)
    .where(eq(usersTable.id, user.id))
    .returning();
  const full = await buildUserResponse(updated, user.id);
  res.json(UpdateMeResponse.parse(full));
});

// GET /users
router.get("/users", async (req, res): Promise<void> => {
  const auth = req as any;
  const { profession, country, genre, skills, search, sort, limit = "20", offset = "0" } = req.query as Record<string, string>;

  let query = db.select().from(usersTable);
  const conditions = [];

  if (profession) conditions.push(eq(usersTable.profession, profession));
  if (country) conditions.push(ilike(usersTable.location, `%${country}%`));
  if (search) {
    conditions.push(
      or(
        ilike(usersTable.name, `%${search}%`),
        ilike(usersTable.username, `%${search}%`),
        ilike(usersTable.bio, `%${search}%`),
      )!,
    );
  }

  const users = await (conditions.length > 0
    ? query.where(conditions.length === 1 ? conditions[0] : sql`${conditions[0]}`)
    : query
  )
    .limit(Math.min(Math.max(parseInt(limit) || 20, 1), 100))
    .offset(Math.max(parseInt(offset) || 0, 0));

  const [countRow] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);

  const enriched = await Promise.all(users.map((u) => buildUserResponse(u)));

  res.json(ListUsersResponse.parse({ users: enriched, total: countRow?.count ?? 0 }));
});

// GET /users/:username
router.get("/users/:username", async (req, res): Promise<void> => {
  const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const userFull = await buildUserResponse(user);

  const videos = await db
    .select()
    .from(videosTable)
    .where(eq(videosTable.userId, user.id))
    .orderBy(sql`${videosTable.createdAt} desc`)
    .limit(20);

  res.json(
    GetUserByUsernameResponse.parse({
      user: userFull,
      videos: videos.map((v) => {
        const { sharePasswordHash, shareToken: _t, ratingSum: _rs, ...rest } = v;
        return {
          ...rest,
          tags: v.tags ?? [],
          shareToken: null,
          hasSharePassword: !!sharePasswordHash,
          isLiked: false,
          ratingAvg: v.ratingCount > 0 ? v.ratingSum / v.ratingCount : 0,
          userRating: null,
          user: userFull,
        };
      }),
      credits: [],
    }),
  );
});

export default router;
