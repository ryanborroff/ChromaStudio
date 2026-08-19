import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { eq, sql, desc, asc, ilike, or, and, inArray } from "drizzle-orm";
import {
  db,
  videosTable,
  usersTable,
  videoLikesTable,
  videoRatingsTable,
  commentsTable,
  streamUploadTicketsTable,
  collectionsTable,
  notDeleted,
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
  BulkMoveVideosBody,
  BulkSetVideoCategoryBody,
  BulkMoveVideosResponse,
  BulkSetVideoCategoryResponse,
  ListVideoVersionsParams,
  ListVideoVersionsResponse,
} from "@workspace/api-zod";
import { getStreamingProvider } from "../lib/streaming/index.js";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();

export async function buildVideoResponse(
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

  let streamPlaybackToken: string | undefined;
  let thumbnailUrl = video.thumbnailUrl;
  if (video.streamProvider === "mux" && video.streamPlaybackId) {
    const provider = getStreamingProvider();
    const tokens = await provider?.signPlaybackTokens?.(
      video.streamPlaybackId,
    );
    if (tokens) {
      streamPlaybackToken = tokens.video;
      if (thumbnailUrl?.startsWith("https://image.mux.com/")) {
        thumbnailUrl = `${thumbnailUrl}?token=${tokens.thumbnail}`;
      }
    }
  }

  return {
    ...rest,
    thumbnailUrl,
    ...(streamPlaybackToken ? { streamPlaybackToken } : {}),
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

  const conditions: any[] = [notDeleted()];

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
    .limit(Math.min(Math.max(parseInt(limit) || 20, 1), 100))
    .offset(Math.max(parseInt(offset) || 0, 0));

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

// GET /videos/group/:reviewGroupId
// Registered ahead of GET /videos/:id so the literal "group" path segment
// isn't swallowed by the :id param matcher.
router.get(
  "/videos/group/:reviewGroupId",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = ListVideoVersionsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid review group id" });
      return;
    }
    const user = await getCurrentUser(req);
    const versions = await db
      .select()
      .from(videosTable)
      .where(
        and(
          eq(videosTable.reviewGroupId, params.data.reviewGroupId),
          eq(videosTable.userId, user.id),
          notDeleted(),
        ),
      )
      .orderBy(asc(videosTable.versionNumber));

    res.json(
      ListVideoVersionsResponse.parse({
        versions: versions.map((v) => ({
          id: v.id,
          versionNumber: v.versionNumber,
          title: v.title,
          thumbnailUrl: v.thumbnailUrl ?? null,
          streamStatus: v.streamStatus,
          approvalStatus: v.approvalStatus,
          createdAt: v.createdAt,
        })),
      }),
    );
  },
);

// GET /videos/:id
router.get("/videos/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [video] = await db
    .select()
    .from(videosTable)
    .where(and(eq(videosTable.id, id), notDeleted()))
    .limit(1);
  if (!video) {
    res.status(404).json({ error: "Video not found" });
    return;
  }

  const viewer = (req.user as typeof usersTable.$inferSelect | undefined)?.id;

  // Non-public videos (private/password_protected) are only visible to their
  // owner here — everyone else gets the same 404 as a nonexistent video, so
  // guessing/incrementing an id can't be used to probe for or read another
  // user's unlisted video. Password-protected/shared access goes through the
  // dedicated /share/:token flow instead, not this endpoint.
  if (video.privacy !== "public" && viewer !== video.userId) {
    res.status(404).json({ error: "Video not found" });
    return;
  }

  // Increment view count
  await db
    .update(videosTable)
    .set({ viewCount: (video.viewCount ?? 0) + 1 })
    .where(eq(videosTable.id, id));
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
  // Only allow videoUrl/thumbnailUrl to point at our own object storage —
  // never an arbitrary external URL, which would let an owner turn a public
  // video/share/review page into a trusted-domain redirect to phishing or
  // malicious content. Mirrors the attachmentUrl check in routes/messages.ts.
  for (const field of ["videoUrl", "thumbnailUrl"] as const) {
    const value = parsed.data[field];
    if (value && !/^\/api\/storage\/objects\//.test(value)) {
      res.status(400).json({ error: `Invalid ${field}` });
      return;
    }
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
  // Strip fields that must only be set by internal processes (webhook
  // handlers, the trusted /confirm-upload endpoint, or the upload-progress
  // pipeline) — never by direct client input. videoUrl/thumbnailUrl are
  // client-settable but were already validated above.
  const {
    streamStatus: _streamStatus,
    uploadProgressPercent: _uploadProgressPercent,
    uploadError: _uploadError,
    retryCount: _retryCount,
    ...clientFields
  } = parsed.data;
  const [video] = await db
    .update(videosTable)
    .set(clientFields as Partial<typeof videosTable.$inferInsert>)
    .where(
      sql`${videosTable.id} = ${id} AND ${videosTable.userId} = ${user.id} AND ${videosTable.deletedAt} IS NULL`,
    )
    .returning();
  if (!video) {
    res.status(404).json({ error: "Video not found" });
    return;
  }
  const full = await buildVideoResponse(video, user.id);
  res.json(UpdateVideoResponse.parse(full));
});

// POST /videos/:id/confirm-upload
// Trusted server-side path that marks an object-storage video as "ready".
// Unlike PATCH /:id, this validates that the video actually has an object-storage
// URL before flipping streamStatus, so clients cannot self-promote arbitrary status.
router.post(
  "/videos/:id/confirm-upload",
  requireAuth,
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(rawId, 10);
    const user = await getCurrentUser(req);

    const [video] = await db
      .select()
      .from(videosTable)
      .where(
        sql`${videosTable.id} = ${id} AND ${videosTable.userId} = ${user.id} AND ${videosTable.deletedAt} IS NULL`,
      )
      .limit(1);

    if (!video) {
      res.status(404).json({ error: "Video not found" });
      return;
    }

    // Only allow confirming videos that were uploaded via object storage
    // (no streaming provider, URL points to the internal storage path).
    const isObjectStorageVideo =
      !video.streamProvider && video.videoUrl?.startsWith("/api/storage");

    if (!isObjectStorageVideo) {
      res
        .status(400)
        .json({ error: "Video is not an object-storage upload" });
      return;
    }

    // Re-fetch the object's metadata from R2 to confirm it actually landed
    // before flipping status to "ready". A size mismatch doesn't block the
    // confirm (the client's reported size may simply be stale/wrong), but it
    // is surfaced by leaving originalVerifiedAt unset for later inspection.
    const objectPath = video.videoUrl!.replace(/^\/api\/storage/, "");
    let verification: { key: string; sizeBytes: number } | undefined;
    try {
      const svc = new ObjectStorageService();
      verification = await svc.verifyObjectUpload(objectPath);
    } catch (err) {
      req.log.error({ err, videoId: id }, "Failed to verify uploaded object");
      res.status(502).json({ error: "Could not verify uploaded file" });
      return;
    }

    const sizeVerified =
      video.fileSizeBytes == null ||
      video.fileSizeBytes === verification.sizeBytes;
    if (!sizeVerified) {
      req.log.warn(
        {
          videoId: id,
          expected: video.fileSizeBytes,
          actual: verification.sizeBytes,
        },
        "Uploaded video size mismatch",
      );
    }

    const [updated] = await db
      .update(videosTable)
      .set({
        streamStatus: "ready",
        storageKey: verification.key,
        fileSizeBytes: verification.sizeBytes,
        ...(sizeVerified ? { originalVerifiedAt: new Date() } : {}),
      })
      .where(eq(videosTable.id, id))
      .returning();

    const full = await buildVideoResponse(updated, user.id);
    res.json(full);
  },
);

// DELETE /videos/:id
const PURGE_GRACE_PERIOD_MS =
  (parseInt(process.env.VIDEO_PURGE_GRACE_DAYS ?? "30", 10) || 30) *
  24 *
  60 *
  60 *
  1000;

router.delete("/videos/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  const user = await getCurrentUser(req);
  const now = new Date();
  const [updated] = await db
    .update(videosTable)
    .set({
      deletedAt: now,
      purgeAfter: new Date(now.getTime() + PURGE_GRACE_PERIOD_MS),
    })
    .where(
      sql`${videosTable.id} = ${id} AND ${videosTable.userId} = ${user.id} AND ${videosTable.deletedAt} IS NULL`,
    )
    .returning({ id: videosTable.id });
  if (!updated) {
    res.status(404).json({ error: "Video not found" });
    return;
  }
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

// POST /videos/bulk/move
router.post(
  "/videos/bulk/move",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = BulkMoveVideosBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const user = await getCurrentUser(req);
    const { ids, collectionId } = parsed.data;

    if (collectionId != null) {
      const [collection] = await db
        .select()
        .from(collectionsTable)
        .where(
          and(
            eq(collectionsTable.id, collectionId),
            eq(collectionsTable.userId, user.id),
          ),
        )
        .limit(1);
      if (!collection) {
        res.status(400).json({ error: "Destination folder not found" });
        return;
      }
    }

    await db
      .update(videosTable)
      .set({ collectionId })
      .where(
        and(
          eq(videosTable.userId, user.id),
          inArray(videosTable.id, ids),
          notDeleted(),
        ),
      );

    const moved = await db
      .select()
      .from(videosTable)
      .where(
        and(
          eq(videosTable.userId, user.id),
          inArray(videosTable.id, ids),
          notDeleted(),
        ),
      )
      .orderBy(desc(videosTable.createdAt));
    const enriched = await Promise.all(
      moved.map((v) => buildVideoResponse(v, user.id)),
    );
    res.json(BulkMoveVideosResponse.parse({ videos: enriched }));
  },
);

// POST /videos/bulk/category
router.post(
  "/videos/bulk/category",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = BulkSetVideoCategoryBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const user = await getCurrentUser(req);
    const { ids, category } = parsed.data;

    await db
      .update(videosTable)
      .set({ category })
      .where(
        and(
          eq(videosTable.userId, user.id),
          inArray(videosTable.id, ids),
          notDeleted(),
        ),
      );

    const updated = await db
      .select()
      .from(videosTable)
      .where(
        and(
          eq(videosTable.userId, user.id),
          inArray(videosTable.id, ids),
          notDeleted(),
        ),
      )
      .orderBy(desc(videosTable.createdAt));
    const enriched = await Promise.all(
      updated.map((v) => buildVideoResponse(v, user.id)),
    );
    res.json(BulkSetVideoCategoryResponse.parse({ videos: enriched }));
  },
);

// GET /videos/:id/comments
router.get("/videos/:id/comments", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [video] = await db
    .select({ userId: videosTable.userId, privacy: videosTable.privacy })
    .from(videosTable)
    .where(and(eq(videosTable.id, id), notDeleted()))
    .limit(1);
  const viewer = (req.user as typeof usersTable.$inferSelect | undefined)?.id;
  if (!video || (video.privacy !== "public" && viewer !== video.userId)) {
    res.status(404).json({ error: "Video not found" });
    return;
  }

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

    const [video] = await db
      .select({ userId: videosTable.userId, privacy: videosTable.privacy })
      .from(videosTable)
      .where(and(eq(videosTable.id, id), notDeleted()))
      .limit(1);
    if (!video || (video.privacy !== "public" && video.userId !== user.id)) {
      res.status(404).json({ error: "Video not found" });
      return;
    }

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
