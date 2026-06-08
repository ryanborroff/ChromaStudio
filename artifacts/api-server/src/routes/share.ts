import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { db, videosTable } from "@workspace/db";
import { requireAuth, getCurrentUser } from "../lib/auth";
import {
  UpdateVideoShareBody,
  UpdateVideoShareResponse,
  GetSharedVideoResponse,
  UnlockSharedVideoBody,
  UnlockSharedVideoResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function publicPayload(video: typeof videosTable.$inferSelect, includeMedia: boolean) {
  return {
    title: video.title,
    description: video.description ?? null,
    thumbnailUrl: video.thumbnailUrl ?? null,
    requiresPassword: !!video.sharePasswordHash,
    streamUid: includeMedia ? video.streamUid ?? null : null,
    videoUrl: includeMedia ? video.videoUrl ?? null : null,
  };
}

// PUT /videos/:id/share — owner enables/disables/password-protects the share link
router.put("/videos/:id/share", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const parsed = UpdateVideoShareBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await getCurrentUser(req);

  const [video] = await db
    .select()
    .from(videosTable)
    .where(and(eq(videosTable.id, id), eq(videosTable.userId, user.id)))
    .limit(1);
  if (!video) {
    res.status(404).json({ error: "Video not found" });
    return;
  }

  const update: Partial<typeof videosTable.$inferInsert> = {
    shareEnabled: parsed.data.enabled,
  };

  // Ensure a token exists when sharing is on.
  let shareToken = video.shareToken;
  if (parsed.data.enabled && !shareToken) {
    shareToken = randomBytes(16).toString("hex");
    update.shareToken = shareToken;
  }

  // password: undefined = leave as-is, null/empty = clear, string = set
  if (parsed.data.password === null || parsed.data.password === "") {
    update.sharePasswordHash = null;
  } else if (typeof parsed.data.password === "string") {
    update.sharePasswordHash = await bcrypt.hash(parsed.data.password, 12);
  }

  const [updated] = await db
    .update(videosTable)
    .set(update)
    .where(and(eq(videosTable.id, id), eq(videosTable.userId, user.id)))
    .returning();

  res.json(
    UpdateVideoShareResponse.parse({
      shareEnabled: updated.shareEnabled,
      shareToken: updated.shareToken ?? null,
      hasSharePassword: !!updated.sharePasswordHash,
    }),
  );
});

// GET /share/:token — public metadata; media omitted when a password is required
router.get("/share/:token", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const [video] = await db
    .select()
    .from(videosTable)
    .where(and(eq(videosTable.shareToken, token), eq(videosTable.shareEnabled, true)))
    .limit(1);
  if (!video) {
    res.status(404).json({ error: "Shared video not found" });
    return;
  }
  res.json(GetSharedVideoResponse.parse(publicPayload(video, !video.sharePasswordHash)));
});

// POST /share/:token/unlock — verify password, return playback details
router.post("/share/:token/unlock", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const parsed = UnlockSharedVideoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [video] = await db
    .select()
    .from(videosTable)
    .where(and(eq(videosTable.shareToken, token), eq(videosTable.shareEnabled, true)))
    .limit(1);
  if (!video) {
    res.status(404).json({ error: "Shared video not found" });
    return;
  }
  if (video.sharePasswordHash) {
    const ok = await bcrypt.compare(parsed.data.password, video.sharePasswordHash);
    if (!ok) {
      res.status(401).json({ error: "Incorrect password" });
      return;
    }
  }
  res.json(UnlockSharedVideoResponse.parse(publicPayload(video, true)));
});

export default router;
