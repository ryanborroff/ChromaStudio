import { Router, type IRouter } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod/v4";
import { db, mediaAssetsTable, videosTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { ObjectPermission } from "../lib/objectAcl";

const router: IRouter = Router();
const storage = new ObjectStorageService();
const assetIdSchema = z.coerce.number().int().positive();
const registerSchema = z.object({
  objectPath: z.string().regex(/^\/objects\/private\/uploads\/[a-f0-9-]{36}$/i),
  originalFilename: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(200),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
});
const attachSchema = z.object({ videoId: z.number().int().positive() });

function ownerId(req: { user?: Express.User }): number {
  return (req.user as { id: number }).id;
}

router.get("/media-assets", requireAuth, async (req, res) => {
  const rows = await db.select().from(mediaAssetsTable)
    .where(and(eq(mediaAssetsTable.ownerId, ownerId(req)), isNull(mediaAssetsTable.deletedAt)))
    .orderBy(desc(mediaAssetsTable.createdAt)).limit(100);
  res.json({ assets: rows });
});

router.get("/media-assets/:id", requireAuth, async (req, res) => {
  const parsed = assetIdSchema.safeParse(req.params.id);
  if (!parsed.success) { res.status(400).json({ error: "Invalid asset ID" }); return; }
  const [asset] = await db.select().from(mediaAssetsTable)
    .where(and(eq(mediaAssetsTable.id, parsed.data), eq(mediaAssetsTable.ownerId, ownerId(req)), isNull(mediaAssetsTable.deletedAt))).limit(1);
  if (!asset) { res.status(404).json({ error: "Asset not found" }); return; }
  res.json({ asset });
});

/** Download the original through a short-lived URL, after rechecking ownership. */
router.get("/media-assets/:id/download", requireAuth, async (req, res) => {
  const parsed = assetIdSchema.safeParse(req.params.id);
  if (!parsed.success) { res.status(400).json({ error: "Invalid asset ID" }); return; }
  const userId = ownerId(req);
  const [asset] = await db.select().from(mediaAssetsTable).where(and(
    eq(mediaAssetsTable.id, parsed.data),
    eq(mediaAssetsTable.ownerId, userId),
    eq(mediaAssetsTable.status, "verified"),
    isNull(mediaAssetsTable.deletedAt),
  )).limit(1);
  if (!asset) { res.status(404).json({ error: "Asset not found" }); return; }
  try {
    const objectFile = await storage.getObjectEntityFile("/objects/" + asset.storageKey);
    const permitted = await storage.canAccessObjectEntity({
      userId: String(userId), objectFile, requestedPermission: ObjectPermission.READ,
    });
    if (!permitted) { res.status(403).json({ error: "Forbidden" }); return; }
    const downloadUrl = await storage.getObjectEntityDownloadURL(objectFile, {
      responseContentDisposition: "attachment",
    });
    res.setHeader("Cache-Control", "no-store");
    res.redirect(302, downloadUrl);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) { res.status(404).json({ error: "Source object missing" }); return; }
    req.log.error({ err: error }, "Media asset download failed");
    res.status(500).json({ error: "Failed to download asset" });
  }
});

/** Register an existing, completed private upload. Never accept an arbitrary R2 key. */
router.post("/media-assets", requireAuth, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid asset metadata" }); return; }
  const userId = ownerId(req);
  try {
    const file = await storage.getObjectEntityFile(parsed.data.objectPath);
    const permitted = await storage.canAccessObjectEntity({
      userId: String(userId), objectFile: file, requestedPermission: ObjectPermission.WRITE,
    });
    if (!permitted) { res.status(403).json({ error: "Forbidden" }); return; }
    const verified = await storage.verifyObjectUpload(parsed.data.objectPath);
    const [asset] = await db.insert(mediaAssetsTable).values({
      ownerId: userId,
      storageKey: verified.key,
      originalFilename: parsed.data.originalFilename,
      contentType: parsed.data.contentType,
      sizeBytes: verified.sizeBytes,
      checksumSha256: parsed.data.checksumSha256,
      status: "verified",
      verifiedAt: new Date(),
    }).onConflictDoNothing({ target: [mediaAssetsTable.ownerId, mediaAssetsTable.storageKey] }).returning();
    if (asset) { res.status(201).json({ asset }); return; }
    const [existing] = await db.select().from(mediaAssetsTable).where(and(
      eq(mediaAssetsTable.ownerId, userId), eq(mediaAssetsTable.storageKey, verified.key),
    )).limit(1);
    if (!existing || existing.deletedAt) { res.status(409).json({ error: "Asset is unavailable" }); return; }
    res.json({ asset: existing });
  } catch (error) {
    if (error instanceof ObjectNotFoundError) { res.status(404).json({ error: "Uploaded file not found" }); return; }
    req.log.error({ err: error }, "Media asset registration failed");
    res.status(500).json({ error: "Failed to register asset" });
  }
});

/** Attach an original to an owned video without changing legacy storage behaviour. */
router.post("/media-assets/:id/attach", requireAuth, async (req, res) => {
  const id = assetIdSchema.safeParse(req.params.id);
  const body = attachSchema.safeParse(req.body);
  if (!id.success || !body.success) { res.status(400).json({ error: "Invalid attachment" }); return; }
  const userId = ownerId(req);
  const [asset] = await db.select().from(mediaAssetsTable).where(and(
    eq(mediaAssetsTable.id, id.data), eq(mediaAssetsTable.ownerId, userId),
    eq(mediaAssetsTable.status, "verified"), isNull(mediaAssetsTable.deletedAt),
  )).limit(1);
  if (!asset) { res.status(404).json({ error: "Asset not found" }); return; }
  // Revalidate storage ownership at attachment time, including revoked ACLs.
  try {
    const objectFile = await storage.getObjectEntityFile(`/objects/${asset.storageKey}`);
    const permitted = await storage.canAccessObjectEntity({
      userId: String(userId), objectFile, requestedPermission: ObjectPermission.WRITE,
    });
    if (!permitted) { res.status(403).json({ error: "Forbidden" }); return; }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) { res.status(404).json({ error: "Source object missing" }); return; }
    req.log.error({ err: error }, "Media asset ownership check failed");
    res.status(500).json({ error: "Failed to attach asset" }); return;
  }
  // Only attach to a private, object-storage presentation. Never overwrite
  // provider-managed streaming assets or silently publish a private original.
  const [video] = await db.update(videosTable).set({
    mediaAssetId: asset.id,
    storageKey: asset.storageKey,
    videoUrl: "/api/storage/objects/" + asset.storageKey,
    fileSizeBytes: asset.sizeBytes,
    streamStatus: "ready",
    originalVerifiedAt: asset.verifiedAt,
  }).where(and(
    eq(videosTable.id, body.data.videoId), eq(videosTable.userId, userId),
    eq(videosTable.privacy, "private"),
    isNull(videosTable.deletedAt),
    isNull(videosTable.streamProvider),
    isNull(videosTable.mediaAssetId),
    isNull(videosTable.storageKey),
    isNull(videosTable.videoUrl),
  )).returning({ id: videosTable.id, mediaAssetId: videosTable.mediaAssetId });
  if (!video) { res.status(409).json({ error: "Only owned, private object-storage videos can attach an original" }); return; }
  res.json({ video });
});

export default router;
