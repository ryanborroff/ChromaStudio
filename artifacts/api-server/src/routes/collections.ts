import { Router, type IRouter } from "express";
import { eq, and, sql, desc, inArray, like } from "drizzle-orm";
import { db, collectionsTable, videosTable } from "@workspace/db";
import { requireAuth, getCurrentUser } from "../lib/auth";
import { buildVideoResponse } from "./videos";
import {
  CreateCollectionBody,
  UpdateCollectionBody,
  ListCollectionsResponse,
  GetCollectionResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function withVideoCount(collection: typeof collectionsTable.$inferSelect) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(videosTable)
    .where(eq(videosTable.collectionId, collection.id));
  return { ...collection, videoCount: row?.count ?? 0 };
}

function buildPath(parentPath: string | null, id: number) {
  return parentPath ? `${parentPath}${id}/` : `/${id}/`;
}

function parsePathIds(path: string) {
  return path
    .split("/")
    .filter((s) => s.length > 0)
    .map((s) => parseInt(s, 10))
    .filter((n) => !Number.isNaN(n));
}

// GET /collections — current user's collections
router.get("/collections", requireAuth, async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  const collections = await db
    .select()
    .from(collectionsTable)
    .where(eq(collectionsTable.userId, user.id))
    .orderBy(collectionsTable.path);
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

  let parentPath: string | null = null;
  if (parsed.data.parentId != null) {
    const [parent] = await db
      .select()
      .from(collectionsTable)
      .where(
        and(
          eq(collectionsTable.id, parsed.data.parentId),
          eq(collectionsTable.userId, user.id),
        ),
      )
      .limit(1);
    if (!parent) {
      res.status(400).json({ error: "Parent folder not found" });
      return;
    }
    parentPath = parent.path;
  }

  const inserted = await db.transaction(async (tx) => {
    const [collection] = await tx
      .insert(collectionsTable)
      .values({
        userId: user.id,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        parentId: parsed.data.parentId ?? null,
      })
      .returning();
    const path = buildPath(parentPath, collection.id);
    const [updated] = await tx
      .update(collectionsTable)
      .set({ path })
      .where(eq(collectionsTable.id, collection.id))
      .returning();
    return updated;
  });

  res.status(201).json(await withVideoCount(inserted));
});

// GET /collections/:id — folder + its subfolders + videos (owner only)
router.get("/collections/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(
    Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
    10,
  );
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

  const [subCollections, videos, breadcrumbRows] = await Promise.all([
    db
      .select()
      .from(collectionsTable)
      .where(
        and(
          eq(collectionsTable.parentId, id),
          eq(collectionsTable.userId, user.id),
        ),
      )
      .orderBy(collectionsTable.name),
    db
      .select()
      .from(videosTable)
      .where(
        and(eq(videosTable.collectionId, id), eq(videosTable.userId, user.id)),
      )
      .orderBy(desc(videosTable.createdAt)),
    (async () => {
      const ids = parsePathIds(collection.path);
      if (ids.length === 0) return [];
      return db
        .select()
        .from(collectionsTable)
        .where(
          and(
            inArray(collectionsTable.id, ids),
            eq(collectionsTable.userId, user.id),
          ),
        );
    })(),
  ]);

  const enrichedSubs = await Promise.all(subCollections.map(withVideoCount));

  const idOrder = new Map(parsePathIds(collection.path).map((id, i) => [id, i]));
  const breadcrumbs = breadcrumbRows
    .filter((c) => idOrder.has(c.id))
    .sort((a, b) => idOrder.get(a.id)! - idOrder.get(b.id)!) as (
    | (typeof collectionsTable.$inferSelect & { videoCount: number })
    | typeof collectionsTable.$inferSelect
  )[];
  const enrichedCrumbs = await Promise.all(
    (breadcrumbs as typeof collectionsTable.$inferSelect[]).map(withVideoCount),
  );

  const enrichedVideos = await Promise.all(
    videos.map((v) => buildVideoResponse(v, user.id)),
  );

  res.json(
    GetCollectionResponse.parse({
      collection: await withVideoCount(collection),
      subCollections: enrichedSubs,
      breadcrumbs: enrichedCrumbs,
      videos: enrichedVideos,
    }),
  );
});

// PATCH /collections/:id
router.patch("/collections/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(
    Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
    10,
  );
  const parsed = UpdateCollectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
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

  const setData: {
    name?: string;
    description?: string | null;
    parentId?: number | null;
    path?: string;
  } = {};

  if (parsed.data.name != null) setData.name = parsed.data.name;
  if (parsed.data.description !== undefined) {
    setData.description = parsed.data.description ?? null;
  }

  if (parsed.data.parentId !== undefined) {
    const newParentId = parsed.data.parentId;

    if (newParentId === null) {
      setData.parentId = null;
      setData.path = buildPath(null, id);
    } else {
      if (newParentId === id) {
        res.status(400).json({ error: "A folder cannot be moved into itself" });
        return;
      }
      const [parent] = await db
        .select()
        .from(collectionsTable)
        .where(
          and(
            eq(collectionsTable.id, newParentId),
            eq(collectionsTable.userId, user.id),
          ),
        )
        .limit(1);
      if (!parent) {
        res.status(400).json({ error: "Parent folder not found" });
        return;
      }
      // Prevent cycles: the target must not be this folder or any descendant.
      if (parent.path.startsWith(collection.path)) {
        res.status(400).json({ error: "Cannot move a folder into its own subtree" });
        return;
      }
      setData.parentId = newParentId;
      setData.path = buildPath(parent.path, id);
    }

    if (setData.path && setData.path !== collection.path) {
      await db.transaction(async (tx) => {
        await tx
          .update(collectionsTable)
          .set({ parentId: setData.parentId, path: setData.path })
          .where(
            and(
              eq(collectionsTable.id, id),
              eq(collectionsTable.userId, user.id),
            ),
          );
        await tx.execute(
          sql`UPDATE collections SET path = REPLACE(path, ${collection.path}, ${setData.path}) WHERE user_id = ${user.id} AND path LIKE ${collection.path + "%"}`,
        );
      });
    } else {
      // only name/description changed
      await db
        .update(collectionsTable)
        .set(setData)
        .where(
          and(eq(collectionsTable.id, id), eq(collectionsTable.userId, user.id)),
        );
    }
  } else {
    await db
      .update(collectionsTable)
      .set(setData)
      .where(
        and(eq(collectionsTable.id, id), eq(collectionsTable.userId, user.id)),
      );
  }

  const [updated] = await db
    .select()
    .from(collectionsTable)
    .where(and(eq(collectionsTable.id, id), eq(collectionsTable.userId, user.id)))
    .limit(1);
  res.json(await withVideoCount(updated));
});

// DELETE /collections/:id (subfolders are removed by FK cascade; videos are uncategorised)
router.delete("/collections/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(
    Array.isArray(req.params.id) ? req.params.id[0] : req.params.id,
    10,
  );
  const user = await getCurrentUser(req);
  await db
    .delete(collectionsTable)
    .where(and(eq(collectionsTable.id, id), eq(collectionsTable.userId, user.id)));
  res.sendStatus(204);
});

export default router;
