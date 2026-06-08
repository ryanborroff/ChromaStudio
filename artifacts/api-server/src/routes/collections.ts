import { Router, type IRouter } from "express";
import { eq, and, sql, desc } from "drizzle-orm";
import { db, collectionsTable, videosTable } from "@workspace/db";
import { requireAuth, getCurrentUser } from "../lib/auth";
import {
  CreateCollectionBody,
  UpdateCollectionBody,
  ListCollectionsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function withVideoCount(collection: typeof collectionsTable.$inferSelect) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(videosTable)
    .where(eq(videosTable.collectionId, collection.id));
  return { ...collection, videoCount: row?.count ?? 0 };
}

// GET /collections — current user's collections
router.get("/collections", requireAuth, async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  const collections = await db
    .select()
    .from(collectionsTable)
    .where(eq(collectionsTable.userId, user.id))
    .orderBy(desc(collectionsTable.createdAt));
  const enriched = await Promise.all(collections.map(withVideoCount));
  res.json(ListCollectionsResponse.parse({ collections: enriched }));
});

// POST /collections
router.post("/collections", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateCollectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await getCurrentUser(req);
  const [collection] = await db
    .insert(collectionsTable)
    .values({ userId: user.id, name: parsed.data.name, description: parsed.data.description ?? null })
    .returning();
  res.status(201).json(await withVideoCount(collection));
});

// GET /collections/:id — collection + its videos (owner only)
router.get("/collections/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getCurrentUser(req);
  const [collection] = await db
    .select()
    .from(collectionsTable)
    .where(and(eq(collectionsTable.id, id), eq(collectionsTable.userId, user.id)))
    .limit(1);
  if (!collection) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }
  const videos = await db
    .select()
    .from(videosTable)
    .where(and(eq(videosTable.collectionId, id), eq(videosTable.userId, user.id)))
    .orderBy(desc(videosTable.createdAt));
  res.json({
    collection: { ...collection, videoCount: videos.length },
    videos: videos.map((v) => {
      const { sharePasswordHash, ...rest } = v;
      return { ...rest, tags: v.tags ?? [], hasSharePassword: !!sharePasswordHash, isLiked: false, user: null };
    }),
  });
});

// PATCH /collections/:id
router.patch("/collections/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const parsed = UpdateCollectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await getCurrentUser(req);
  const [collection] = await db
    .update(collectionsTable)
    .set(parsed.data)
    .where(and(eq(collectionsTable.id, id), eq(collectionsTable.userId, user.id)))
    .returning();
  if (!collection) {
    res.status(404).json({ error: "Collection not found" });
    return;
  }
  res.json(await withVideoCount(collection));
});

// DELETE /collections/:id (videos' collectionId is set to null by the FK)
router.delete("/collections/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getCurrentUser(req);
  await db
    .delete(collectionsTable)
    .where(and(eq(collectionsTable.id, id), eq(collectionsTable.userId, user.id)));
  res.sendStatus(204);
});

export default router;
