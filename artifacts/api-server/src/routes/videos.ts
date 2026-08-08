import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { eq, sql, desc, asc, ilike, or, and } from "drizzle-orm";
import {
  db,
  videosTable,
  usersTable,
  videoLikesTable,
  videoRatingsTable,
  commentsTable,
  streamUploadTicketsTable,
  collectionsTable,
} from "@workspace/db";
import { requireAuth, getCurrentUser } from "../lib/auth";
import {
  CreateVideoBody,
  UpdateVideoBody,
  UpdateVideoParams,
  GetVideoParams,
  DeleteVideoParams,
  LikeVideoParams,
  ListCommentsParams,
  CreateCommentParams,
  CreateCommentBody,
  ListVideosResponse,
  GetVideoResponse,
  UpdateVideoResponse,
  LikeVideoResponse,
  RateVideoParams,
  RateVideoBody,
  RateVideoResponse,
  ListCommentsResponse,
  CreateVideoUploadUrlResponse,
} from "@workspace/api-zod";
import { getStreamingProvider } from "../lib/streaming/index.js";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();

async function buildVideoResponse(
  video: typeof videosTable.$inferSelect,
  currentUserId?: number,
) {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, video.userId))
    .limit(1);

  let isLiked = false;
  let userRating: number | null = null;
  if (currentUserId) {
    const likeRow = await db
      .select()
      .from(videoLikesTable)
      .where(
        sql`${videoLikesTable.userId} = ${currentUserId} AND ${videoLikesTable.videoId} = ${video.id}`,
      )
      .limit(1);
    isLiked = likeRow.length > 0;

    const [ratingRow] = await db
      .select({ rating: videoRatingsTable.rating })
      .from(videoRatingsTable)
      .where(
        sql`${videoRatingsTable.userId} = ${currentUserId} AND ${videoRatingsTable.videoId} = ${video.id}`,
      )
      .limit(1);
    userRating = ratingRow?.rating ?? null;
  }

  const { sharePasswordHash, shareToken, ratingSum, ...rest } = video;
  return {
    ...rest,
    tags: video.tags ?? [],
    shareToken: currentUserId === video.userId ? (shareToken ?? null) : null,
    hasSharePassword: !!sharePasswordHash,
    isLiked,
    ratingAvg: video.ratingCount > 0 ? ratingSum / video.ratingCount : 0,
    userRating,
    user: user
      ? (() => {
          const {
            googleId: _g,
            appleId: _a,
            email: _e,
            passwordHash: _p,
            ...safeUser
          } = user;
          return {
            ...safeUser,
            skills: user.skills ?? [],
            socialLinks: user.socialLinks ?? null,
            followerCount: 0,
            followingCount: 0,
            videoCount: 0,
            isFollowing: false,
          };
        })()
      : null,
  };
}

// GET /videos
router.get("/videos", async (req, res): Promise<void> => {
  const {
    userId,
    mine,
    collectionId,
    category,
    search,
    tags,
    genre,
    sort = "newest",
    featured,
    limit = "20",
    offset = "0",
  } = req.query as Record<string, string>;

  const conditions: any[] = [];

  // "mine" returns the authenticated user's own library (incl. private videos);
  // otherwise only public videos are listed.
  let ownerId: number | undefined;
  if (mine === "true" && req.isAuthenticated?.()) {
    const user = await getCurrentUser(req);
    ownerId = user.id;
    conditions.push(eq(videosTable.userId, ownerId));
  } else {
    conditions.push(eq(videosTable.privacy, "public"));
    if (userId) conditions.push(eq(videosTable.userId, parseInt(userId)));
  }

  if (collectionId === "none") {
    conditions.push(sql`${videosTable.collectionId} IS NULL`);
  } else if (collectionId) {
    conditions.push(eq(videosTable.collectionId, parseInt(collectionId)));
  }
  if (category) conditions.push(eq(videosTable.category, category));
  if (genre) conditions.push(sql`${genre.toLowerCase()} = ANY(${videosTable.tags})`);
  if (featured === "true") conditions.push(eq(videosTable.isFeatured, true));
  if (search) {
    conditions.push(
      or(
        ilike(videosTable.title, `%${search}%`),
        ilike(videosTable.description, `%${search}%`),
      )!,
    );
  }

  const whereClause = and(...conditions);

  const videos = await db
    .select()
    .from(videosTable)
    .where(whereClause)
    .orderBy(
      sort === "most_viewed"
        ? desc(videosTable.viewCount)
        : sort === "community_rated"
          ? desc(videosTable.likeCount)
          : sort === "community_rated_asc"
            ? asc(videosTable.likeCount)
            : sort === "featured"
              ? desc(videosTable.isFeatured)
              : desc(videosTable.createdAt),
    )
    .limit(Math.min(parseInt(limit) || 20, 100))
    .offset(parseInt(offset));

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(videosTable)
    .where(whereClause);

  const enriched = await Promise.all(
    videos.map((v) => buildVideoResponse(v, ownerId)),
  );
  res.json(
    ListVideosResponse.parse({ videos: enriched, total: countRow?.count ?? 0 }),
  );
});

// POST /videos
router.post("/videos", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateVideoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await getCurrentUser(req);

  // If a Stream upload UID is supplied, verify it was issued to this user and
  // has not already been consumed. This prevents clients from attaching
  // arbitrary or forged media to their account.
  const streamUid = parsed.data.streamUid;
  const requestedGroupId = parsed.data.reviewGroupId;
  let reviewGroupId = requestedGroupId ?? `edit-${randomUUID()}`;
  let versionNumber = 1;
  if (requestedGroupId) {
    const [latestVersion] = await db
      .select({ versionNumber: videosTable.versionNumber })
      .from(videosTable)
      .where(
        and(
          eq(videosTable.reviewGroupId, requestedGroupId),
          eq(videosTable.userId, user.id),
        ),
      )
      .orderBy(desc(videosTable.versionNumber))
      .limit(1);
    if (latestVersion) versionNumber = latestVersion.versionNumber + 1;
  }
  let ticketProvider: string | null = null;
  if (streamUid) {
    const [ticket] = await db
      .select()
      .from(streamUploadTicketsTable)
      .where(
        and(
          eq(streamUploadTicketsTable.uid, streamUid),
          eq(streamUploadTicketsTable.userId, user.id),
          eq(streamUploadTicketsTable.consumed, false),
        ),
      )
      .limit(1);
    if (!ticket) {
      res
        .status(403)
        .json({ error: "Invalid or already-used upload reference" });
      return;
    }
    ticketProvider = ticket.provider;
  }

  // Determine stream provider and initial playback ID from the ticket.
  // For Mux: playbackId is null until the video.asset.ready webhook fires.
  // For Cloudflare: the uid doubles as the playback ID (no separate ID needed).
  const streamProvider =
    ticketProvider === "mux" || ticketProvider === "cloudflare"
      ? ticketProvider
      : null;
  const streamPlaybackId =
    streamProvider === "cloudflare" ? streamUid : undefined;

  const streamStatus =
    parsed.data.videoUrl || streamUid ? "uploading" : undefined;

  let video: typeof videosTable.$inferSelect;
  try {
    [video] = await db
      .insert(videosTable)
      .values({
        ...parsed.data,
        userId: user.id,
        privacy: parsed.data.privacy ?? "public",
        tags: parsed.data.tags ?? [],
        downloadFormats: parsed.data.downloadFormats ?? [],
        ...(streamStatus ? { streamStatus } : {}),
        ...(streamProvider ? { streamProvider } : {}),
        ...(streamPlaybackId ? { streamPlaybackId } : {}),
        reviewGroupId,
        versionNumber,
      })
      .returning();
  } catch (err) {
    // Persisting the record failed after the asset was uploaded — clean up the
    // orphaned stream asset so we don't pay to store unreferenced media.
    if (streamUid) {
      const activeProvider = getStreamingProvider();
      if (activeProvider) await activeProvider.deleteAsset(streamUid);
    }
    req.log.error({ err }, "Failed to persist video record");
    res.status(500).json({ error: "Could not save video" });
    return;
  }

  if (streamUid) {
    await db
      .update(streamUploadTicketsTable)
      .set({ consumed: true })
      .where(eq(streamUploadTicketsTable.uid, streamUid));
  }

  const full = await buildVideoResponse(video, user.id);
  res.status(201).json(full);
});

// POST /videos/upload-url
router.post(
  "/videos/upload-url",
  requireAuth,
  async (req, res): Promise<void> => {
    const provider = getStreamingProvider();

    if (!provider) {
      // No streaming provider configured — fall back to Replit Object Storage.
      // Returns a presigned PUT URL; the client should PUT the file (not FormData POST).
      try {
        const svc = new ObjectStorageService();
        const uploadURL = await svc.getObjectEntityUploadURL();
        const objectPath = svc.normalizeObjectEntityPath(uploadURL);
        res.json(
          CreateVideoUploadUrlResponse.parse({
            uploadURL,
            uid: objectPath,
            uploadMethod: "put",
            streamProvider: null,
          }),
        );
      } catch (err) {
        req.log.error(
          { err },
          "Failed to create Object Storage video upload URL",
        );
        res.status(502).json({ error: "Could not start upload" });
      }
      return;
    }

    try {
      const user = await getCurrentUser(req);
      const result = await provider.createDirectUpload();
      await db
        .insert(streamUploadTicketsTable)
        .values({ uid: result.uid, userId: user.id, provider: provider.name });
      res.json(
        CreateVideoUploadUrlResponse.parse({
          uploadURL: result.uploadUrl,
          uid: result.uid,
          uploadMethod: result.uploadMethod,
          streamProvider: provider.name,
        }),
      );
    } catch (err) {
      req.log.error({ err }, `Failed to create ${provider.name} upload URL`);
      res.status(502).json({ error: "Could not start upload" });
    }
  },
);

// GET /videos/:id
router.get("/videos/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [video] = await db
    .select()
    .from(videosTable)
    .where(eq(videosTable.id, id))
    .limit(1);
  if (!video) {
    res.status(404).json({ error: "Video not found" });
    return;
  }

  // Increment view count
  await db
    .update(videosTable)
    .set({ viewCount: (video.viewCount ?? 0) + 1 })
    .where(eq(videosTable.id, id));

  const viewer = (req.user as typeof usersTable.$inferSelect | undefined)?.id;
  const full = await buildVideoResponse(
    { ...video, viewCount: (video.viewCount ?? 0) + 1 },
    viewer,
  );
  res.json(GetVideoResponse.parse(full));
});

// PATCH /videos/:id
router.patch("/videos/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  const parsed = UpdateVideoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await getCurrentUser(req);
  if (typeof parsed.data.collectionId === "number") {
    const [owned] = await db
      .select({ id: collectionsTable.id })
      .from(collectionsTable)
      .where(
        and(
          eq(collectionsTable.id, parsed.data.collectionId),
          eq(collectionsTable.userId, user.id),
        ),
      )
      .limit(1);
    if (!owned) {
      res.status(400).json({ error: "Collection not found" });
      return;
    }
  }
  // Strip fields that are set exclusively by internal webhook processing and
  // must not be client-writable.
  const { streamStatus, uploadProgressPercent, uploadError, retryCount, ...clientFields } = parsed.data;
  const [video] = await db
    .update(videosTable)
    .set(clientFields as Partial<typeof videosTable.$inferInsert>)
    .where(
      sql`${videosTable.id} = ${id} AND ${videosTable.userId} = ${user.id}`,
    )
    .returning();
  if (!video) {
    res.status(404).json({ error: "Video not found" });
    return;
  }
  const full = await buildVideoResponse(video, user.id);
  res.json(UpdateVideoResponse.parse(full));
});

// DELETE /videos/:id
router.delete("/videos/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  const user = await getCurrentUser(req);
  await db
    .delete(videosTable)
    .where(
      sql`${videosTable.id} = ${id} AND ${videosTable.userId} = ${user.id}`,
    );
  res.sendStatus(204);
});

// POST /videos/:id/like
router.post(
  "/videos/:id/like",
  requireAuth,
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
    const id = parseInt(rawId, 10);
    const user = await getCurrentUser(req);

    const existing = await db
      .select()
      .from(videoLikesTable)
      .where(
        sql`${videoLikesTable.userId} = ${user.id} AND ${videoLikesTable.videoId} = ${id}`,
      )
      .limit(1);

    let liked: boolean;
    if (existing.length > 0) {
      await db
        .delete(videoLikesTable)
        .where(
          sql`${videoLikesTable.userId} = ${user.id} AND ${videoLikesTable.videoId} = ${id}`,
        );
      await db
        .update(videosTable)
        .set({ likeCount: sql`${videosTable.likeCount} - 1` })
        .where(eq(videosTable.id, id));
      liked = false;
    } else {
      await db.insert(videoLikesTable).values({ userId: user.id, videoId: id });
      await db
        .update(videosTable)
        .set({ likeCount: sql`${videosTable.likeCount} + 1` })
        .where(eq(videosTable.id, id));
      liked = true;
    }

    const [video] = await db
      .select()
      .from(videosTable)
      .where(eq(videosTable.id, id))
      .limit(1);
    res.json(
      LikeVideoResponse.parse({ liked, likeCount: video?.likeCount ?? 0 }),
    );
  },
);

// POST /videos/:id/rate
router.post(
  "/videos/:id/rate",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = RateVideoParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = RateVideoBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    const id = params.data.id;
    const rating = body.data.rating;
    const user = await getCurrentUser(req);

    const [exists] = await db
      .select({ id: videosTable.id })
      .from(videosTable)
      .where(eq(videosTable.id, id))
      .limit(1);
    if (!exists) {
      res.status(404).json({ error: "Video not found" });
      return;
    }

    await db.transaction(async (tx) => {
      const [previous] = await tx
        .select()
        .from(videoRatingsTable)
        .where(
          sql`${videoRatingsTable.userId} = ${user.id} AND ${videoRatingsTable.videoId} = ${id}`,
        )
        .limit(1);

      if (previous) {
        const delta = rating - previous.rating;
        if (delta !== 0) {
          await tx
            .update(videoRatingsTable)
            .set({ rating })
            .where(eq(videoRatingsTable.id, previous.id));
          await tx
            .update(videosTable)
            .set({ ratingSum: sql`${videosTable.ratingSum} + ${delta}` })
            .where(eq(videosTable.id, id));
        }
      } else {
        await tx
          .insert(videoRatingsTable)
          .values({ userId: user.id, videoId: id, rating })
          .onConflictDoUpdate({
            target: [videoRatingsTable.userId, videoRatingsTable.videoId],
            set: { rating },
          });
        await tx
          .update(videosTable)
          .set({
            ratingSum: sql`${videosTable.ratingSum} + ${rating}`,
            ratingCount: sql`${videosTable.ratingCount} + 1`,
          })
          .where(eq(videosTable.id, id));
      }
    });

    const [video] = await db
      .select()
      .from(videosTable)
      .where(eq(videosTable.id, id))
      .limit(1);
    const count = video?.ratingCount ?? 0;
    const avg = count > 0 ? (video?.ratingSum ?? 0) / count : 0;
    res.json(
      RateVideoResponse.parse({
        ratingAvg: avg,
        ratingCount: count,
        userRating: rating,
      }),
    );
  },
);

// GET /videos/:id/comments
router.get("/videos/:id/comments", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const comments = await db
    .select()
    .from(commentsTable)
    .where(eq(commentsTable.videoId, id))
    .orderBy(desc(commentsTable.createdAt));

  const enriched = await Promise.all(
    comments.map(async (c) => {
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, c.userId))
        .limit(1);
      return {
        ...c,
        user: user
          ? (() => {
              const {
                googleId: _g,
                appleId: _a,
                email: _e,
                passwordHash: _p,
                ...safeUser
              } = user;
              return {
                ...safeUser,
                skills: user.skills ?? [],
                socialLinks: user.socialLinks ?? null,
                followerCount: 0,
                followingCount: 0,
                videoCount: 0,
                isFollowing: false,
              };
            })()
          : null,
      };
    }),
  );

  res.json(ListCommentsResponse.parse({ comments: enriched }));
});

// POST /videos/:id/comments
router.post(
  "/videos/:id/comments",
  requireAuth,
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
    const id = parseInt(rawId, 10);
    const parsed = CreateCommentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const user = await getCurrentUser(req);
    const [comment] = await db
      .insert(commentsTable)
      .values({ videoId: id, userId: user.id, body: parsed.data.body })
      .returning();

    const {
      googleId: _g,
      appleId: _a,
      email: _e,
      passwordHash: _p,
      ...safeUser
    } = user;
    res.status(201).json({
      ...comment,
      user: {
        ...safeUser,
        skills: user.skills ?? [],
        socialLinks: user.socialLinks ?? null,
        followerCount: 0,
        followingCount: 0,
        videoCount: 0,
        isFollowing: false,
      },
    });
  },
);

export default router;
