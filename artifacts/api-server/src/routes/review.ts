import { Router, type IRouter, type Request } from "express";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  db,
  reviewCommentsTable,
  reviewLinksTable,
  reviewNotificationsTable,
  projectsTable,
  videosTable,
} from "@workspace/db";
import {
  CreateReviewLinkBody,
  CreateReviewLinkParams,
  GetReviewLinkParams,
  GetReviewLinkResponse,
  ListReviewCommentsParams,
  ListReviewCommentsResponse,
  PostGuestReviewCommentBody,
  PostGuestReviewCommentParams,
  PostOwnerReviewCommentBody,
  PostOwnerReviewCommentParams,
  ResolveReviewCommentParams,
  ResolveReviewCommentResponse,
  SetOwnerApprovalStatusBody,
  SetOwnerApprovalStatusParams,
  SetOwnerApprovalStatusResponse,
  SetGuestApprovalStatusBody,
  SetGuestApprovalStatusParams,
  SetGuestApprovalStatusResponse,
  UnlockReviewLinkBody,
  UnlockReviewLinkParams,
  UnlockReviewLinkResponse,
} from "@workspace/api-zod";
import { getCurrentUser, requireAuth } from "../lib/auth";

const router: IRouter = Router();
const guestAttempts = new Map<string, { count: number; resetAt: number }>();

type ReviewVideo = typeof videosTable.$inferSelect;

function getGroupId(video: ReviewVideo): string {
  return video.reviewGroupId ?? `video-${video.id}`;
}

function linkUrl(req: Request, token: string): string {
  const configuredOrigin = process.env.PUBLIC_APP_URL?.replace(/\/$/, "");
  const origin = configuredOrigin || `${req.protocol}://${req.get("host")}`;
  return `${origin}/review/${token}`;
}

async function getLink(token: string) {
  const [link] = await db
    .select()
    .from(reviewLinksTable)
    .where(eq(reviewLinksTable.token, token))
    .limit(1);
  if (
    !link ||
    link.revoked ||
    (link.expiresAt && link.expiresAt.getTime() <= Date.now())
  )
    return null;
  return link;
}

async function getLatestVideo(groupId: string) {
  const [video] = await db
    .select()
    .from(videosTable)
    .where(
      and(
        eq(videosTable.reviewGroupId, groupId),
        eq(videosTable.streamStatus, "ready"),
      ),
    )
    .orderBy(desc(videosTable.versionNumber), desc(videosTable.createdAt))
    .limit(1);

  if (video) return video;

  const fallbackId = groupId.startsWith("video-")
    ? Number(groupId.slice(6))
    : NaN;
  if (!Number.isInteger(fallbackId)) return null;
  const [fallback] = await db
    .select()
    .from(videosTable)
    .where(
      and(eq(videosTable.id, fallbackId), isNull(videosTable.reviewGroupId)),
    )
    .limit(1);
  return fallback?.streamStatus === "ready" || fallback?.videoUrl
    ? fallback
    : null;
}

async function listComments(videoId: number, groupId: string) {
  return db
    .select({
      id: reviewCommentsTable.id,
      videoId: reviewCommentsTable.videoId,
      groupId: reviewCommentsTable.groupId,
      timecodeSeconds: reviewCommentsTable.timecodeSeconds,
      body: reviewCommentsTable.body,
      authorType: reviewCommentsTable.authorType,
      authorName: reviewCommentsTable.authorName,
      parentCommentId: reviewCommentsTable.parentCommentId,
      resolved: reviewCommentsTable.resolved,
      createdAt: reviewCommentsTable.createdAt,
    })
    .from(reviewCommentsTable)
    .where(
      and(
        eq(reviewCommentsTable.videoId, videoId),
        eq(reviewCommentsTable.groupId, groupId),
      ),
    )
    .orderBy(
      reviewCommentsTable.timecodeSeconds,
      reviewCommentsTable.createdAt,
    );
}

async function buildSession(
  link: typeof reviewLinksTable.$inferSelect,
  video: ReviewVideo,
  includeMedia: boolean,
) {
  const groupId = getGroupId(video);
  const comments = await listComments(video.id, groupId);
  return {
    title: video.title,
    description: video.description ?? null,
    thumbnailUrl: video.thumbnailUrl ?? null,
    requiresPassword: !includeMedia && !!link.passwordHash,
    allowDownload: link.allowDownload,
    allowComments: link.allowComments,
    approvalStatus:
      (video.approvalStatus as "pending" | "approved" | "changes_requested") ??
      "pending",
    streamProvider: includeMedia ? (video.streamProvider ?? null) : null,
    streamPlaybackId: includeMedia ? (video.streamPlaybackId ?? null) : null,
    streamUid: includeMedia ? (video.streamUid ?? null) : null,
    videoUrl: includeMedia ? (video.videoUrl ?? null) : null,
    downloadFormats:
      includeMedia && link.allowDownload ? (video.downloadFormats ?? []) : [],
    comments: includeMedia ? comments : [],
  };
}

function allowGuestAttempt(token: string) {
  const now = Date.now();
  const current = guestAttempts.get(token);
  if (!current || current.resetAt <= now) {
    guestAttempts.set(token, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (current.count >= 30) return false;
  current.count += 1;
  return true;
}

async function authorizeGuest(token: string, password?: string) {
  const link = await getLink(token);
  if (!link || !allowGuestAttempt(token)) return null;
  if (link.passwordHash) {
    if (!password || !(await bcrypt.compare(password, link.passwordHash)))
      return null;
  }
  const video = await getLatestVideo(link.videoGroupId);
  if (!video) return null;
  return { link, video, groupId: getGroupId(video) };
}

router.post(
  "/videos/:id/review-link",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = CreateReviewLinkParams.safeParse(req.params);
    const body = CreateReviewLinkBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid review link settings" });
      return;
    }

    const user = await getCurrentUser(req);
    if (body.data.projectId) {
      const [project] = await db
        .select({ id: projectsTable.id })
        .from(projectsTable)
        .where(
          and(
            eq(projectsTable.id, body.data.projectId),
            eq(projectsTable.userId, user.id),
          ),
        )
        .limit(1);
      if (!project) {
        res.status(403).json({ error: "Project not found" });
        return;
      }
    }
    const [video] = await db
      .select()
      .from(videosTable)
      .where(
        and(
          eq(videosTable.id, params.data.id),
          eq(videosTable.userId, user.id),
        ),
      )
      .limit(1);
    if (!video) {
      res.status(404).json({ error: "Video not found" });
      return;
    }

    const groupId = getGroupId(video);
    if (!video.reviewGroupId) {
      await db
        .update(videosTable)
        .set({ reviewGroupId: groupId })
        .where(eq(videosTable.id, video.id));
    }

    const token = randomBytes(24).toString("base64url");
    const expiresAt = body.data.expiresInDays
      ? new Date(Date.now() + body.data.expiresInDays * 24 * 60 * 60 * 1000)
      : null;
    const passwordHash = body.data.password
      ? await bcrypt.hash(body.data.password, 12)
      : null;

    const [link] = await db
      .insert(reviewLinksTable)
      .values({
        token,
        videoGroupId: groupId,
        projectId: body.data.projectId ?? null,
        createdBy: user.id,
        expiresAt,
        passwordHash,
        allowDownload: body.data.allowDownload,
        allowComments: body.data.allowComments,
      })
      .returning();

    res.status(201).json({
      token: link.token,
      url: linkUrl(req, link.token),
      allowDownload: link.allowDownload,
      allowComments: link.allowComments,
      hasPassword: !!link.passwordHash,
      expiresAt: link.expiresAt?.toISOString() ?? null,
    });
  },
);

router.get(
  "/videos/:id/review-comments",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = ListReviewCommentsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid video id" });
      return;
    }
    const user = await getCurrentUser(req);
    const [video] = await db
      .select()
      .from(videosTable)
      .where(
        and(
          eq(videosTable.id, params.data.id),
          eq(videosTable.userId, user.id),
        ),
      )
      .limit(1);
    if (!video) {
      res.status(404).json({ error: "Video not found" });
      return;
    }
    res.json(
      ListReviewCommentsResponse.parse({
        comments: await listComments(video.id, getGroupId(video)),
      }),
    );
  },
);

router.post(
  "/videos/:id/review-comments",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = PostOwnerReviewCommentParams.safeParse(req.params);
    const body = PostOwnerReviewCommentBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid review comment" });
      return;
    }
    const user = await getCurrentUser(req);
    const [video] = await db
      .select()
      .from(videosTable)
      .where(
        and(
          eq(videosTable.id, params.data.id),
          eq(videosTable.userId, user.id),
        ),
      )
      .limit(1);
    if (!video) {
      res.status(404).json({ error: "Video not found" });
      return;
    }
    const [comment] = await db
      .insert(reviewCommentsTable)
      .values({
        videoId: video.id,
        groupId: getGroupId(video),
        timecodeSeconds: body.data.timecodeSeconds,
        body: body.data.body,
        authorType: "owner",
        authorName: user.name,
        authorUid: user.id,
        parentCommentId: body.data.parentCommentId ?? null,
      })
      .returning();
    res.status(201).json(comment);
  },
);

router.post(
  "/videos/:id/review-comments/:commentId/resolve",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = ResolveReviewCommentParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid review comment" });
      return;
    }
    const user = await getCurrentUser(req);
    const [comment] = await db
      .select({ comment: reviewCommentsTable, ownerId: videosTable.userId })
      .from(reviewCommentsTable)
      .innerJoin(videosTable, eq(videosTable.id, reviewCommentsTable.videoId))
      .where(
        and(
          eq(reviewCommentsTable.id, params.data.commentId),
          eq(videosTable.id, params.data.id),
          eq(videosTable.userId, user.id),
        ),
      )
      .limit(1);
    if (!comment) {
      res.status(404).json({ error: "Review comment not found" });
      return;
    }
    const [updated] = await db
      .update(reviewCommentsTable)
      .set({ resolved: true })
      .where(eq(reviewCommentsTable.id, params.data.commentId))
      .returning();
    res.json(ResolveReviewCommentResponse.parse(updated));
  },
);

router.post(
  "/videos/:id/approval",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = SetOwnerApprovalStatusParams.safeParse(req.params);
    const body = SetOwnerApprovalStatusBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "Invalid approval status" });
      return;
    }
    const user = await getCurrentUser(req);
    const [video] = await db
      .update(videosTable)
      .set({
        approvalStatus: body.data.status,
        approvalDecidedAt: new Date(),
        approvalDecidedBy: user.name,
      })
      .where(
        and(
          eq(videosTable.id, params.data.id),
          eq(videosTable.userId, user.id),
        ),
      )
      .returning();
    if (!video) {
      res.status(404).json({ error: "Video not found" });
      return;
    }
    res.json(
      SetOwnerApprovalStatusResponse.parse({
        approvalStatus: video.approvalStatus,
      }),
    );
  },
);

router.get("/review/:token", async (req, res): Promise<void> => {
  const params = GetReviewLinkParams.safeParse(req.params);
  if (!params.success) {
    res.status(404).json({ error: "Review link not found" });
    return;
  }
  const link = await getLink(params.data.token);
  if (!link) {
    res.status(410).json({ error: "This review link is no longer active" });
    return;
  }
  const video = await getLatestVideo(link.videoGroupId);
  if (!video) {
    res.status(409).json({ error: "The latest video is still processing" });
    return;
  }
  res.json(
    GetReviewLinkResponse.parse(
      await buildSession(link, video, !link.passwordHash),
    ),
  );
});

router.post("/review/:token", async (req, res): Promise<void> => {
  const params = UnlockReviewLinkParams.safeParse(req.params);
  const body = UnlockReviewLinkBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid password" });
    return;
  }
  const authorized = await authorizeGuest(
    params.data.token,
    body.data.password,
  );
  if (!authorized) {
    res.status(401).json({ error: "Invalid or expired review link" });
    return;
  }
  res.json(
    UnlockReviewLinkResponse.parse(
      await buildSession(authorized.link, authorized.video, true),
    ),
  );
});

router.post("/review/:token/comments", async (req, res): Promise<void> => {
  const params = PostGuestReviewCommentParams.safeParse(req.params);
  const body = PostGuestReviewCommentBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid review comment" });
    return;
  }
  const authorized = await authorizeGuest(
    params.data.token,
    body.data.password,
  );
  if (!authorized || !authorized.link.allowComments) {
    res
      .status(403)
      .json({ error: "Comments are not enabled for this review link" });
    return;
  }
  const [comment] = await db
    .insert(reviewCommentsTable)
    .values({
      videoId: authorized.video.id,
      groupId: authorized.groupId,
      timecodeSeconds: body.data.timecodeSeconds,
      body: body.data.body,
      authorType: "guest",
      authorName: body.data.authorName,
      parentCommentId: body.data.parentCommentId ?? null,
    })
    .returning();
  await db.insert(reviewNotificationsTable).values({
    recipientUid: authorized.video.userId,
    type: "new_comment",
    projectId: authorized.link.projectId,
    videoId: authorized.video.id,
  });
  res.status(201).json(comment);
});

router.post("/review/:token/approval", async (req, res): Promise<void> => {
  const params = SetGuestApprovalStatusParams.safeParse(req.params);
  const body = SetGuestApprovalStatusBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid approval decision" });
    return;
  }
  const authorized = await authorizeGuest(
    params.data.token,
    body.data.password,
  );
  if (!authorized) {
    res.status(401).json({ error: "Invalid or expired review link" });
    return;
  }
  const [video] = await db
    .update(videosTable)
    .set({
      approvalStatus: body.data.status,
      approvalDecidedAt: new Date(),
      approvalDecidedBy: body.data.authorName,
    })
    .where(eq(videosTable.id, authorized.video.id))
    .returning();
  await db.insert(reviewNotificationsTable).values({
    recipientUid: video.userId,
    type: "approval_decision",
    projectId: authorized.link.projectId,
    videoId: video.id,
  });
  res.json(
    SetGuestApprovalStatusResponse.parse({
      approvalStatus: video.approvalStatus,
    }),
  );
});

export default router;
