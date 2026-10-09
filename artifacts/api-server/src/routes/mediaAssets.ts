import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { AbortMultipartUploadCommand, CompleteMultipartUploadCommand, CreateMultipartUploadCommand, ListPartsCommand, UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client, getR2Bucket } from "../lib/r2Client";
import { and, desc, eq, ilike, isNull, lt } from "drizzle-orm";
import { z } from "zod/v4";
import { db, mediaAssetsTable, mediaVerificationJobsTable, videosTable } from "@workspace/db";
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
const uploadRequestSchema = z.object({
  originalFilename: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(200).default("application/octet-stream"),
  // Single PUT is reserved for small uploads; large originals use multipart.
  sizeBytes: z.number().int().positive().max(32 * 1024 ** 2),
});

function ownerId(req: { user?: Express.User }): number {
  return (req.user as { id: number }).id;
}

/** Issue an owner-scoped signed PUT for any file type, independently of videos. */
router.post("/media-assets/upload-url", requireAuth, async (req, res) => {
  const parsed = uploadRequestSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid file metadata" }); return; }
  try {
    const uploadURL = await storage.getObjectEntityUploadURL(String(ownerId(req)), {
      originalFilename: parsed.data.originalFilename,
      contentType: parsed.data.contentType,
    });
    const objectPath = storage.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadURL, objectPath, uploadMethod: "PUT" });
  } catch (error) {
    req.log.error({ err: error }, "Media Warehouse upload URL failed");
    res.status(500).json({ error: "Failed to start upload" });
  }
});

// Multipart uploads use signed part URLs; originals remain private and unchanged.
const multipartSchema = z.object({
  originalFilename: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(200).default("application/octet-stream"),
  // R2 follows the S3 multipart object size ceiling (5 TiB).
  sizeBytes: z.number().int().positive().max(5 * 1024 ** 4),
});
const multipartSessionSchema = z.object({
  objectPath: registerSchema.shape.objectPath,
  uploadId: z.string().min(1).max(1000),
});
const multipartCompleteSchema = multipartSessionSchema.extend({
  parts: z.array(z.object({
    partNumber: z.number().int().min(1).max(10000),
    etag: z.string().min(1).max(200),
  })).min(1).max(10000),
});
async function ownedMultipart(req: { user?: Express.User }, objectPath: string) {
  const file = await storage.getObjectEntityFileForUpload(objectPath);
  const permitted = await storage.canAccessObjectEntity({
    userId: String(ownerId(req)), objectFile: file, requestedPermission: ObjectPermission.WRITE,
  });
  return permitted ? file : null;
}
router.post("/media-assets/multipart/start", requireAuth, async (req, res) => {
  const parsed = multipartSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid upload details" }); return; }
  try {
    const key = `private/uploads/${randomUUID()}`;
    await storage.setPrivateUploadOwner(key, String(ownerId(req)));
    const result = await getR2Client().send(new CreateMultipartUploadCommand({
      Bucket: getR2Bucket(), Key: key,
      ContentType: parsed.data.contentType,
      Metadata: { "original-filename": encodeURIComponent(parsed.data.originalFilename) },
    }));
    if (!result.UploadId) throw new Error("Missing multipart upload ID");
    res.json({ objectPath: `/objects/${key}`, uploadId: result.UploadId });
  } catch (error) {
    req.log.error({ err: error }, "Multipart start failed");
    res.status(500).json({ error: "Could not start multipart upload" });
  }
});
/** Return uploaded parts for an owner-authorised interrupted session. */
router.post("/media-assets/multipart/parts", requireAuth, async (req, res) => {
  const parsed = multipartSessionSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid upload session" }); return; }
  try {
    const file = await ownedMultipart(req, parsed.data.objectPath);
    if (!file) { res.status(403).json({ error: "Forbidden" }); return; }
    const parts: { partNumber: number; etag: string; size: number }[] = [];
    let marker: string | undefined;
    do {
      const result = await getR2Client().send(new ListPartsCommand({
        Bucket: getR2Bucket(), Key: file.key, UploadId: parsed.data.uploadId,
        PartNumberMarker: marker,
      }));
      for (const part of result.Parts ?? []) {
        if (part.PartNumber && part.ETag && part.Size != null) {
          parts.push({ partNumber: part.PartNumber, etag: part.ETag, size: part.Size });
        }
      }
      if (parts.length > 10000) throw new Error("Multipart session exceeds part limit");
      if (!result.IsTruncated) break;
      if (!result.NextPartNumberMarker || result.NextPartNumberMarker === marker) {
        throw new Error("Invalid part listing pagination");
      }
      marker = result.NextPartNumberMarker;
    } while (parts.length <= 10000);
    res.json({ parts });
  } catch (error) {
    req.log.error({ err: error }, "Multipart part listing failed");
    res.status(502).json({ error: "Could not recover upload session" });
  }
});

router.post("/media-assets/multipart/part-url", requireAuth, async (req, res) => {
  const parsed = multipartSessionSchema.extend({
    partNumber: z.number().int().min(1).max(10000),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid part request" }); return; }
  try {
    const file = await ownedMultipart(req, parsed.data.objectPath);
    if (!file) { res.status(403).json({ error: "Forbidden" }); return; }
    const uploadURL = await getSignedUrl(getR2Client(), new UploadPartCommand({
      Bucket: getR2Bucket(), Key: file.key, UploadId: parsed.data.uploadId,
      PartNumber: parsed.data.partNumber,
    }), { expiresIn: 900 });
    res.json({ uploadURL });
  } catch (error) {
    req.log.error({ err: error }, "Multipart part URL failed");
    res.status(500).json({ error: "Could not sign upload part" });
  }
});
router.post("/media-assets/multipart/complete", requireAuth, async (req, res) => {
  const parsed = multipartCompleteSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid completion request" }); return; }
  try {
    const file = await ownedMultipart(req, parsed.data.objectPath);
    if (!file) { res.status(403).json({ error: "Forbidden" }); return; }
    const parts = [...parsed.data.parts].sort((a, b) => a.partNumber - b.partNumber);
    if (new Set(parts.map((part) => part.partNumber)).size !== parts.length) {
      res.status(400).json({ error: "Duplicate part numbers" }); return;
    }
    // Never trust client-provided ETags alone: verify the R2 session's parts.
    const actualParts: { partNumber: number; etag: string }[] = [];
    let marker: string | undefined;
    do {
      const listed = await getR2Client().send(new ListPartsCommand({
        Bucket: getR2Bucket(), Key: file.key, UploadId: parsed.data.uploadId,
        PartNumberMarker: marker,
      }));
      for (const part of listed.Parts ?? []) {
        if (part.PartNumber && part.ETag) actualParts.push({ partNumber: part.PartNumber, etag: part.ETag });
      }
      if (actualParts.length > 10000) throw new Error("Multipart session exceeds part limit");
      if (!listed.IsTruncated) break;
      if (!listed.NextPartNumberMarker || listed.NextPartNumberMarker === marker) throw new Error("Invalid parts pagination");
      marker = listed.NextPartNumberMarker;
    } while (actualParts.length <= 10000);
    if (actualParts.length !== parts.length || parts.some((part, index) =>
      part.partNumber !== index + 1 ||
      !actualParts.some((actual) => actual.partNumber === part.partNumber && actual.etag === part.etag)
    )) {
      res.status(409).json({ error: "Uploaded parts do not match the completion request" }); return;
    }
    await getR2Client().send(new CompleteMultipartUploadCommand({
      Bucket: getR2Bucket(), Key: file.key, UploadId: parsed.data.uploadId,
      MultipartUpload: { Parts: parts.map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })) },
    }));
    res.json({ objectPath: parsed.data.objectPath });
  } catch (error) {
    req.log.error({ err: error }, "Multipart completion failed");
    res.status(502).json({ error: "Could not complete multipart upload" });
  }
});
router.post("/media-assets/multipart/abort", requireAuth, async (req, res) => {
  const parsed = multipartSessionSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid abort request" }); return; }
  try {
    const file = await ownedMultipart(req, parsed.data.objectPath);
    if (!file) { res.status(403).json({ error: "Forbidden" }); return; }
    await getR2Client().send(new AbortMultipartUploadCommand({
      Bucket: getR2Bucket(), Key: file.key, UploadId: parsed.data.uploadId,
    }));
    res.status(204).end();
  } catch (error) {
    req.log.error({ err: error }, "Multipart abort failed");
    res.status(502).json({ error: "Could not abort multipart upload" });
  }
});

router.get("/media-assets", requireAuth, async (req, res) => {
  const parsed = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    beforeId: z.coerce.number().int().positive().optional(),
    search: z.string().trim().max(200).optional(),
  }).safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Invalid search or pagination" }); return; }
  const { limit, beforeId, search } = parsed.data;
  const rows = await db.select().from(mediaAssetsTable)
    .where(and(
      eq(mediaAssetsTable.ownerId, ownerId(req)),
      isNull(mediaAssetsTable.deletedAt),
      beforeId ? lt(mediaAssetsTable.id, beforeId) : undefined,
      search ? ilike(mediaAssetsTable.originalFilename, `%${search.replace(/[\\%_]/g, (char) => "\\" + char)}%`) : undefined,
    ))
    .orderBy(desc(mediaAssetsTable.id)).limit(limit + 1);
  const hasMore = rows.length > limit;
  const assets = rows.slice(0, limit);
  res.json({ assets, nextBeforeId: hasMore ? assets[assets.length - 1]?.id ?? null : null });
});

router.get("/media-assets/:id", requireAuth, async (req, res) => {
  const parsed = assetIdSchema.safeParse(req.params.id);
  if (!parsed.success) { res.status(400).json({ error: "Invalid asset ID" }); return; }
  const [asset] = await db.select().from(mediaAssetsTable)
    .where(and(eq(mediaAssetsTable.id, parsed.data), eq(mediaAssetsTable.ownerId, ownerId(req)), isNull(mediaAssetsTable.deletedAt))).limit(1);
  if (!asset) { res.status(404).json({ error: "Asset not found" }); return; }
  res.json({ asset });
});

/**
 * Queue an independent checksum verification for a large stored original.
 * A separate durable worker must be deployed before jobs can progress.
 * Existing verified checksums cannot be overwritten through this endpoint.
 */
router.post("/media-assets/:id/verify", requireAuth, async (req, res) => {
  const id = assetIdSchema.safeParse(req.params.id);
  const body = z.object({ expectedSha256: z.string().regex(/^[a-f0-9]{64}$/i) }).safeParse(req.body);
  if (!id.success || !body.success) { res.status(400).json({ error: "Invalid verification request" }); return; }
  const userId = ownerId(req);
  try {
    const [asset] = await db.select().from(mediaAssetsTable).where(and(
      eq(mediaAssetsTable.id, id.data),
      eq(mediaAssetsTable.ownerId, userId),
      eq(mediaAssetsTable.status, "verified"),
      isNull(mediaAssetsTable.deletedAt),
    )).limit(1);
    if (!asset) { res.status(404).json({ error: "Asset not found" }); return; }
    if (asset.checksumSha256) {
      res.status(409).json({ error: "Asset checksum has already been verified" }); return;
    }
    const objectFile = await storage.getObjectEntityFile("/objects/" + asset.storageKey);
    const permitted = await storage.canAccessObjectEntity({
      userId: String(userId), objectFile, requestedPermission: ObjectPermission.READ,
    });
    if (!permitted) { res.status(403).json({ error: "Forbidden" }); return; }
    const digest = body.data.expectedSha256.toLowerCase();
    const [created] = await db.insert(mediaVerificationJobsTable).values({
      assetId: asset.id, ownerId: userId, expectedSha256: digest,
    }).onConflictDoNothing({ target: mediaVerificationJobsTable.assetId }).returning();
    if (created) { res.status(202).json({ job: created }); return; }
    const [existing] = await db.select().from(mediaVerificationJobsTable).where(and(
      eq(mediaVerificationJobsTable.assetId, asset.id),
      eq(mediaVerificationJobsTable.ownerId, userId),
    )).limit(1);
    if (!existing) { res.status(409).json({ error: "Verification request conflict" }); return; }
    if (existing.expectedSha256 !== digest) {
      res.status(409).json({ error: "Existing verification job has a different checksum" }); return;
    }
    res.status(202).json({ job: existing });
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Source object missing" }); return;
    }
    req.log.error({ err: error }, "Media verification queue failed");
    res.status(500).json({ error: "Could not queue verification" });
  }
});

router.get("/media-assets/:id/verification", requireAuth, async (req, res) => {
  const id = assetIdSchema.safeParse(req.params.id);
  if (!id.success) { res.status(400).json({ error: "Invalid asset ID" }); return; }
  const userId = ownerId(req);
  const [asset] = await db.select().from(mediaAssetsTable).where(and(
    eq(mediaAssetsTable.id, id.data), eq(mediaAssetsTable.ownerId, userId),
    isNull(mediaAssetsTable.deletedAt),
  )).limit(1);
  if (!asset) { res.status(404).json({ error: "Asset not found" }); return; }
  const [job] = await db.select().from(mediaVerificationJobsTable).where(and(
    eq(mediaVerificationJobsTable.assetId, asset.id),
    eq(mediaVerificationJobsTable.ownerId, userId),
  )).limit(1);
  res.setHeader("Cache-Control", "no-store");
  res.json({ job: job ?? null });
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
    // The checksum is authoritative only after independently streaming the
    // stored R2 object and comparing its bytes with the submitted digest.
    let verifiedSha256: string | null = null;
    if (parsed.data.checksumSha256) {
      // Avoid an unbounded R2 read in a synchronous HTTP request. Large
      // originals need a separately budgeted asynchronous verification job.
      if (verified.sizeBytes > 32 * 1024 * 1024) {
        res.status(422).json({ error: "Synchronous checksum verification is limited to 32 MiB" }); return;
      }
      verifiedSha256 = await storage.calculateObjectSha256(parsed.data.objectPath, verified.sizeBytes);
      if (verifiedSha256 !== parsed.data.checksumSha256.toLowerCase()) {
        res.status(422).json({ error: "Stored file checksum does not match" }); return;
      }
    }
    // A retried registration must not turn a missing or replaced object into
    // a fresh trusted catalogue entry. Storage metadata was checked above.
    const [asset] = await db.insert(mediaAssetsTable).values({
      ownerId: userId,
      storageKey: verified.key,
      originalFilename: verified.originalFilename || parsed.data.originalFilename,
      contentType: verified.contentType || "application/octet-stream",
      sizeBytes: verified.sizeBytes,
      checksumSha256: verifiedSha256,
      // "verified" currently means the object exists and its metadata was
      // checked. A cryptographic integrity claim is made only when a SHA-256
      // digest was independently compared with the stored bytes.
      status: "verified",
      verifiedAt: new Date(),
    }).onConflictDoNothing({ target: [mediaAssetsTable.ownerId, mediaAssetsTable.storageKey] }).returning();
    if (asset) { res.status(201).json({ asset }); return; }
    const [existing] = await db.select().from(mediaAssetsTable).where(and(
      eq(mediaAssetsTable.ownerId, userId), eq(mediaAssetsTable.storageKey, verified.key),
    )).limit(1);
    if (!existing || existing.deletedAt) { res.status(409).json({ error: "Asset is unavailable" }); return; }
    // An existing record must still describe the same stored object. A
    // changed size or content type is evidence of replacement, not a retry.
    if (existing.sizeBytes !== verified.sizeBytes || existing.contentType !== (verified.contentType || "application/octet-stream")) {
      res.status(409).json({ error: "Stored object metadata changed since registration" }); return;
    }
    // Idempotent retries must not silently claim integrity that the existing
    // record never verified, or discard a previously verified checksum.
    if (parsed.data.checksumSha256 && existing.checksumSha256 !== verifiedSha256) {
      res.status(409).json({ error: "Existing asset checksum differs from verified upload" }); return;
    }
    res.json({ asset: existing });
  } catch (error) {
    if (error instanceof ObjectNotFoundError) { res.status(404).json({ error: "Uploaded file not found" }); return; }
    req.log.error({ err: error }, "Media asset registration failed");
    res.status(500).json({ error: "Failed to register asset" });
  }
});

/** Create a new private video from an existing verified original, without a re-upload. */
router.post("/media-assets/:id/create-video", requireAuth, async (req, res) => {
  const id = assetIdSchema.safeParse(req.params.id);
  const body = z.object({
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().max(5000).optional(),
  }).safeParse(req.body);
  if (!id.success || !body.success) { res.status(400).json({ error: "Invalid video details" }); return; }
  const userId = ownerId(req);
  const [asset] = await db.select().from(mediaAssetsTable).where(and(
    eq(mediaAssetsTable.id, id.data), eq(mediaAssetsTable.ownerId, userId),
    eq(mediaAssetsTable.status, "verified"), isNull(mediaAssetsTable.deletedAt),
  )).limit(1);
  if (!asset) { res.status(404).json({ error: "Asset not found" }); return; }
  if (!asset.contentType.startsWith("video/")) {
    res.status(415).json({ error: "Only video files can be used as video sources" }); return;
  }
  try {
    const objectFile = await storage.getObjectEntityFile("/objects/" + asset.storageKey);
    const permitted = await storage.canAccessObjectEntity({
      userId: String(userId), objectFile, requestedPermission: ObjectPermission.READ,
    });
    if (!permitted) { res.status(403).json({ error: "Forbidden" }); return; }
    const [video] = await db.insert(videosTable).values({
      userId,
      title: body.data.title,
      description: body.data.description,
      privacy: "private",
      reviewGroupId: `edit-${randomUUID()}`,
      streamStatus: "ready",
      mediaAssetId: asset.id,
      storageKey: asset.storageKey,
      videoUrl: "/api/storage/objects/" + asset.storageKey,
      fileSizeBytes: asset.sizeBytes,
      originalVerifiedAt: asset.verifiedAt,
    }).returning({ id: videosTable.id, mediaAssetId: videosTable.mediaAssetId });
    res.status(201).json({ video });
  } catch (error) {
    if (error instanceof ObjectNotFoundError) { res.status(404).json({ error: "Source object missing" }); return; }
    req.log.error({ err: error }, "Creating video from original failed");
    res.status(500).json({ error: "Failed to create video" });
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
  if (!asset.contentType.startsWith("video/")) {
    res.status(415).json({ error: "Only video files can be used as video sources" }); return;
  }
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
