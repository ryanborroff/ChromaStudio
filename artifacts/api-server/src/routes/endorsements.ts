import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, endorsementsTable, usersTable, followsTable, videosTable } from "@workspace/db";
import { requireAuth, getCurrentUser } from "../lib/auth";
import {
  ListEndorsementsResponse,
  CreateEndorsementBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function buildUserSnippet(user: typeof usersTable.$inferSelect) {
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
  const { googleId: _g, appleId: _a, email: _e, passwordHash: _p, ...safe } = user;
  return {
    ...safe,
    followerCount: followerCountRow?.count ?? 0,
    followingCount: followingCountRow?.count ?? 0,
    videoCount: videoCountRow?.count ?? 0,
    isFollowing: false,
    skills: user.skills ?? [],
    socialLinks: user.socialLinks ?? null,
    credits: (user.credits as unknown[] | null) ?? [],
    isAdmin: user.isAdmin,
    endorsementCount: 0,
  };
}

// GET /users/:userId/endorsements
router.get("/users/:userId/endorsements", async (req, res): Promise<void> => {
  const toUserId = parseInt(String(req.params.userId), 10);
  if (isNaN(toUserId)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const currentUserId = (req as any).session?.userId as number | undefined;

  const rows = await db
    .select()
    .from(endorsementsTable)
    .where(eq(endorsementsTable.toUserId, toUserId))
    .orderBy(sql`${endorsementsTable.createdAt} desc`);

  const fromUserIds = [...new Set(rows.map(r => r.fromUserId))];
  const fromUsers = fromUserIds.length
    ? await db.select().from(usersTable).where(sql`${usersTable.id} = ANY(${fromUserIds})`)
    : [];
  const userMap = new Map(fromUsers.map(u => [u.id, u]));

  const enriched = await Promise.all(
    rows.map(async (r) => {
      const fromUser = userMap.get(r.fromUserId);
      if (!fromUser) return null;
      return { ...r, fromUser: await buildUserSnippet(fromUser) };
    })
  );

  const valid = enriched.filter(Boolean);

  let myEndorsement = null;
  if (currentUserId) {
    myEndorsement = valid.find((e) => e!.fromUserId === currentUserId) ?? null;
  }

  res.json(
    ListEndorsementsResponse.parse({
      endorsements: valid,
      total: valid.length,
      myEndorsement,
    })
  );
});

// POST /users/:userId/endorsements
router.post("/users/:userId/endorsements", requireAuth, async (req, res): Promise<void> => {
  const toUserId = parseInt(String(req.params.userId), 10);
  if (isNaN(toUserId)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const parsed = CreateEndorsementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const currentUser = await getCurrentUser(req);
  if (currentUser.id === toUserId) {
    res.status(400).json({ error: "You cannot endorse yourself" });
    return;
  }

  const [existing] = await db
    .select()
    .from(endorsementsTable)
    .where(and(eq(endorsementsTable.fromUserId, currentUser.id), eq(endorsementsTable.toUserId, toUserId)))
    .limit(1);

  let endorsement;
  if (existing) {
    [endorsement] = await db
      .update(endorsementsTable)
      .set({ text: parsed.data.text })
      .where(eq(endorsementsTable.id, existing.id))
      .returning();
  } else {
    [endorsement] = await db
      .insert(endorsementsTable)
      .values({ fromUserId: currentUser.id, toUserId, text: parsed.data.text })
      .returning();
  }

  const snippet = await buildUserSnippet(currentUser);
  res.status(existing ? 200 : 201).json({ ...endorsement, fromUser: snippet });
});

// DELETE /users/:userId/endorsements
router.delete("/users/:userId/endorsements", requireAuth, async (req, res): Promise<void> => {
  const toUserId = parseInt(String(req.params.userId), 10);
  if (isNaN(toUserId)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const currentUser = await getCurrentUser(req);
  await db
    .delete(endorsementsTable)
    .where(and(eq(endorsementsTable.fromUserId, currentUser.id), eq(endorsementsTable.toUserId, toUserId)));

  res.json({ ok: true });
});

export default router;
