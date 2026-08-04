import { Router, type IRouter } from "express";
import { and, desc, eq, ne } from "drizzle-orm";
import {
  db,
  collectionsTable,
  portfoliosTable,
  usersTable,
  videosTable,
} from "@workspace/db";
import { requireAuth, getCurrentUser } from "../lib/auth";

const router: IRouter = Router();

const publicVideoWhere = (ownerId: number) =>
  and(
    eq(videosTable.userId, ownerId),
    eq(videosTable.isPortfolioPiece, true),
    eq(videosTable.privacy, "public"),
    eq(videosTable.streamStatus, "ready"),
  );

function safeVideo(video: typeof videosTable.$inferSelect) {
  const {
    sharePasswordHash,
    shareToken: _token,
    ratingSum: _sum,
    ...rest
  } = video;
  return {
    ...rest,
    title: video.portfolioTitle || video.title,
    description: video.portfolioDescription ?? video.description,
    tags: video.tags ?? [],
    shareToken: null,
    hasSharePassword: !!sharePasswordHash,
    isLiked: false,
    ratingAvg: video.ratingCount > 0 ? video.ratingSum / video.ratingCount : 0,
    userRating: null,
    user: null,
  };
}

router.get("/portfolio/:handle", async (req, res): Promise<void> => {
  const handle = String(req.params.handle).toLowerCase();
  const [portfolio] = await db
    .select()
    .from(portfoliosTable)
    .where(
      and(
        eq(portfoliosTable.handle, handle),
        eq(portfoliosTable.isPublished, true),
      ),
    )
    .limit(1);
  if (!portfolio) {
    res.status(404).json({ error: "Portfolio not found" });
    return;
  }

  const [videos, collections] = await Promise.all([
    db
      .select()
      .from(videosTable)
      .where(publicVideoWhere(portfolio.ownerId))
      .orderBy(desc(videosTable.publishedAt), desc(videosTable.createdAt)),
    db
      .select()
      .from(collectionsTable)
      .where(
        and(
          eq(collectionsTable.userId, portfolio.ownerId),
          eq(collectionsTable.isPublished, true),
        ),
      )
      .orderBy(desc(collectionsTable.createdAt)),
  ]);

  res.json({
    portfolio,
    videos: videos.map(safeVideo),
    collections,
  });
});

router.get("/portfolio/me", requireAuth, async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  let [portfolio] = await db
    .select()
    .from(portfoliosTable)
    .where(eq(portfoliosTable.ownerId, user.id))
    .limit(1);
  if (!portfolio) {
    [portfolio] = await db
      .insert(portfoliosTable)
      .values({
        ownerId: user.id,
        handle: user.username.toLowerCase(),
        displayName: user.name,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        bannerUrl: user.coverUrl,
      })
      .returning();
  }
  res.json(portfolio);
});

router.put("/portfolio/me", requireAuth, async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);
  const body = req.body as Record<string, unknown>;
  const handle =
    typeof body.handle === "string"
      ? body.handle.trim().toLowerCase()
      : user.username.toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,30}$/.test(handle)) {
    res.status(400).json({
      error: "Handle must use 2-31 lowercase letters, numbers, or hyphens",
    });
    return;
  }

  const [conflict] = await db
    .select({ id: portfoliosTable.id })
    .from(portfoliosTable)
    .where(
      and(
        eq(portfoliosTable.handle, handle),
        ne(portfoliosTable.ownerId, user.id),
      ),
    )
    .limit(1);
  if (conflict) {
    res.status(409).json({ error: "That handle is already claimed" });
    return;
  }

  const existing = await db
    .select({ id: portfoliosTable.id })
    .from(portfoliosTable)
    .where(eq(portfoliosTable.ownerId, user.id))
    .limit(1);
  const values = {
    handle,
    displayName:
      typeof body.displayName === "string" && body.displayName.trim()
        ? body.displayName.trim()
        : user.name,
    bio: typeof body.bio === "string" ? body.bio : null,
    avatarUrl: typeof body.avatarUrl === "string" ? body.avatarUrl : null,
    bannerUrl: typeof body.bannerUrl === "string" ? body.bannerUrl : null,
    isPublished: body.isPublished === true,
    accentColor:
      typeof body.accentColor === "string" ? body.accentColor : "#e8b4a0",
    layout:
      body.layout === "list" || body.layout === "cinematic"
        ? body.layout
        : "grid",
    updatedAt: new Date(),
  } as const;
  const [portfolio] = existing.length
    ? await db
        .update(portfoliosTable)
        .set(values)
        .where(eq(portfoliosTable.id, existing[0].id))
        .returning()
    : await db
        .insert(portfoliosTable)
        .values({ ownerId: user.id, ...values })
        .returning();
  res.json(portfolio);
});

router.get("/embeds/videos/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [video] = await db
    .select()
    .from(videosTable)
    .where(
      and(
        eq(videosTable.id, id),
        eq(videosTable.isPortfolioPiece, true),
        eq(videosTable.allowEmbedding, true),
        eq(videosTable.privacy, "public"),
        eq(videosTable.streamStatus, "ready"),
      ),
    )
    .limit(1);
  if (!video) {
    res.status(404).json({ error: "Embed unavailable" });
    return;
  }
  res.json({
    id: video.id,
    title: video.portfolioTitle || video.title,
    streamUid: video.streamUid,
    videoUrl: video.videoUrl,
    thumbnailUrl: video.thumbnailUrl,
    whiteLabel: video.whiteLabel,
    customLogoUrl: video.customLogoUrl,
  });
});

export default router;
