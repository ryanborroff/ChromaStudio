import { Router, type IRouter } from "express";
import { eq, sql, desc, asc, ilike, or, and } from "drizzle-orm";
import { db, videosTable, usersTable, videoLikesTable, commentsTable, streamUploadTicketsTable } from "@workspace/db";
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
  ListCommentsResponse,
  CreateVideoUploadUrlResponse,
} from "@workspace/api-zod";
import { createDirectUpload, getStreamConfig, deleteStreamVideo } from "../lib/cloudflare";

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
  if (currentUserId) {
    const likeRow = await db
      .select()
      .from(videoLikesTable)
      .where(
        sql`${videoLikesTable.userId} = ${currentUserId} AND ${videoLikesTable.videoId} = ${video.id}`,
      )
      .limit(1);
    isLiked = likeRow.length > 0;
  }

  return {
    ...video,
    tags: video.tags ?? [],
    isLiked,
    user: user
      ? (() => {
          const { googleId: _g, email: _e, ...safeUser } = user;
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
  const { userId, search, tags, sort = "newest", limit = "20", offset = "0" } = req.query as Record<string, string>;

  const conditions: any[] = [eq(videosTable.privacy, "public")];
  if (userId) conditions.push(eq(videosTable.userId, parseInt(userId)));
  if (search) {
    conditions.push(
      or(ilike(videosTable.title, `%${search}%`), ilike(videosTable.description, `%${search}%`))!,
    );
  }

  const videos = await db
    .select()
    .from(videosTable)
    .where(sql`${conditions.map((c) => c).join(" AND ")}`)
    .orderBy(
      sort === "most_viewed"
        ? desc(videosTable.viewCount)
        : sort === "community_rated"
          ? desc(videosTable.likeCount)
          : sort === "community_rated_asc"
            ? asc(videosTable.likeCount)
            : desc(videosTable.createdAt),
    )
    .limit(parseInt(limit))
    .offset(parseInt(offset))
    .catch(() =>
      db
        .select()
        .from(videosTable)
        .where(eq(videosTable.privacy, "public"))
        .orderBy(desc(videosTable.createdAt))
        .limit(parseInt(limit))
        .offset(parseInt(offset)),
    );

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(videosTable)
    .where(eq(videosTable.privacy, "public"));

  const enriched = await Promise.all(videos.map((v) => buildVideoResponse(v)));
  res.json(ListVideosResponse.parse({ videos: enriched, total: countRow?.count ?? 0 }));
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
      res.status(403).json({ error: "Invalid or already-used upload reference" });
      return;
    }
  }

  let video: typeof videosTable.$inferSelect;
  try {
    [video] = await db
      .insert(videosTable)
      .values({ ...parsed.data, userId: user.id, privacy: parsed.data.privacy ?? "public", tags: parsed.data.tags ?? [] })
      .returning();
  } catch (err) {
    // Persisting the record failed after the asset was uploaded — clean up the
    // orphaned Stream video so we don't pay to store unreferenced media.
    if (streamUid) await deleteStreamVideo(streamUid);
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
router.post("/videos/upload-url", requireAuth, async (req, res): Promise<void> => {
  if (!getStreamConfig()) {
    res.status(503).json({ error: "Video uploads are not configured yet" });
    return;
  }
  try {
    const user = await getCurrentUser(req);
    const ticket = await createDirectUpload();
    await db
      .insert(streamUploadTicketsTable)
      .values({ uid: ticket.uid, userId: user.id });
    res.json(CreateVideoUploadUrlResponse.parse(ticket));
  } catch (err) {
    req.log.error({ err }, "Failed to create Cloudflare Stream upload URL");
    res.status(502).json({ error: "Could not start upload" });
  }
});

// GET /videos/:id
router.get("/videos/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  const [video] = await db.select().from(videosTable).where(eq(videosTable.id, id)).limit(1);
  if (!video) {
    res.status(404).json({ error: "Video not found" });
    return;
  }

  // Increment view count
  await db
    .update(videosTable)
    .set({ viewCount: (video.viewCount ?? 0) + 1 })
    .where(eq(videosTable.id, id));

  const full = await buildVideoResponse({ ...video, viewCount: (video.viewCount ?? 0) + 1 });
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
  const [video] = await db
    .update(videosTable)
    .set(parsed.data as Partial<typeof videosTable.$inferInsert>)
    .where(sql`${videosTable.id} = ${id} AND ${videosTable.userId} = ${user.id}`)
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
    .where(sql`${videosTable.id} = ${id} AND ${videosTable.userId} = ${user.id}`);
  res.sendStatus(204);
});

// POST /videos/:id/like
router.post("/videos/:id/like", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
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
      .where(sql`${videoLikesTable.userId} = ${user.id} AND ${videoLikesTable.videoId} = ${id}`);
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

  const [video] = await db.select().from(videosTable).where(eq(videosTable.id, id)).limit(1);
  res.json(LikeVideoResponse.parse({ liked, likeCount: video?.likeCount ?? 0 }));
});

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
              const { googleId: _g, email: _e, ...safeUser } = user;
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
router.post("/videos/:id/comments", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
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

  const { googleId: _g, email: _e, ...safeUser } = user;
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
});

export default router;
