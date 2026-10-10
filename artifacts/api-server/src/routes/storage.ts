import { Router, type IRouter, type Request, type Response } from "express";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
  GetStorageUsageResponse,
} from "@workspace/api-zod";
import { and, eq, sql } from "drizzle-orm";
import { db, videosTable, mediaAssetsTable } from "@workspace/db";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "../lib/objectStorage";
import { ObjectPermission } from "../lib/objectAcl";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const STORAGE_LIMITS: Record<string, number> = {
  free: 100 * 1024 * 1024 * 1024,
  creator: 1 * 1024 * 1024 * 1024 * 1024,
  studio: 5 * 1024 * 1024 * 1024 * 1024,
};

router.get("/storage/usage", requireAuth, async (req, res): Promise<void> => {
  const userId = (req.user as { id: number }).id;
  // Warehouse originals are billed once, even when reused by multiple videos.
  const [warehouse] = await db.select({
    bytes: sql<string>`coalesce(sum(${mediaAssetsTable.sizeBytes}), 0)::text`,
  }).from(mediaAssetsTable).where(and(
    eq(mediaAssetsTable.ownerId, userId),
    eq(mediaAssetsTable.status, "verified"),
    sql`${mediaAssetsTable.deletedAt} IS NULL`,
  ));
  // Deduplicate legacy objects and avoid charging for originals already
  // registered in the warehouse. This remains a compatibility fallback.
  const legacy = await db.execute(sql`
    SELECT coalesce(sum(bytes), 0)::text AS bytes FROM (
      SELECT DISTINCT ON (v.storage_key) v.storage_key, v.file_size_bytes AS bytes
      FROM videos v
      WHERE v.user_id = ${userId} AND v.deleted_at IS NULL
        AND v.stream_status = 'ready' AND v.media_asset_id IS NULL
        AND v.storage_key IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM media_assets a
          WHERE a.owner_id = ${userId} AND a.storage_key = v.storage_key
            AND a.deleted_at IS NULL
        )
      ORDER BY v.storage_key, v.id DESC
    ) distinct_legacy
  `);
  const [videoUsage] = await db.select({
    videoCount: sql<number>`count(*)::int`,
  }).from(videosTable).where(and(
    eq(videosTable.userId, userId),
    eq(videosTable.streamStatus, "ready"),
    sql`${videosTable.deletedAt} IS NULL`,
  ));
  const totalBytesUsed = Number(warehouse?.bytes ?? 0)
    + Number(legacy.rows[0]?.bytes ?? 0);

  const plan = (req.user as { plan?: string }).plan ?? "free";
  const planStorageLimitBytes = STORAGE_LIMITS[plan] ?? STORAGE_LIMITS.free;
  const usagePercent =
    planStorageLimitBytes > 0
      ? Number(((totalBytesUsed / planStorageLimitBytes) * 100).toFixed(2))
      : 0;

  res.json(
    GetStorageUsageResponse.parse({
      totalBytesUsed,
      videoCount: videoUsage?.videoCount ?? 0,
      planStorageLimitBytes,
      usagePercent,
      warning: usagePercent >= 80,
    }),
  );
});

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 */
router.post(
  "/storage/uploads/request-url",
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required fields" });
      return;
    }

    const { name, size, contentType } = parsed.data;

    const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
    if (!contentType.startsWith("image/")) {
      res.status(400).json({ error: "Only image uploads are allowed" });
      return;
    }
    if (size > MAX_UPLOAD_BYTES) {
      res.status(400).json({ error: "Image must be 10 MB or smaller" });
      return;
    }

    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL(
        String((req.user as { id: number }).id),
      );
      const objectPath =
        objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType },
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Error generating upload URL");
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  },
);

/**
 * POST /storage/uploads/request-file-url
 *
 * Like request-url but for general file attachments (any type, larger limit).
 * Used for direct-message file attachments.
 */
router.post(
  "/storage/uploads/request-file-url",
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required fields" });
      return;
    }

    const { name, size, contentType } = parsed.data;

    const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB
    if (size > MAX_FILE_BYTES) {
      res.status(400).json({ error: "File must be 50 MB or smaller" });
      return;
    }

    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL(
        String((req.user as { id: number }).id),
      );
      const objectPath =
        objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType },
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Error generating file upload URL");
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get(
  "/storage/public-objects/*filePath",
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.filePath;
      const filePath = Array.isArray(raw) ? raw.join("/") : raw;
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      const downloadUrl =
        await objectStorageService.getObjectEntityDownloadURL(file);
      res.redirect(302, downloadUrl);
    } catch (error) {
      req.log.error({ err: error }, "Error serving public object");
      res.status(500).json({ error: "Failed to serve public object" });
    }
  },
);

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get(
  "/storage/objects/*path",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.path;
      const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
      const objectPath = `/objects/${wildcardPath}`;
      const objectFile =
        await objectStorageService.getObjectEntityFile(objectPath);

      const userId = String((req.user as { id: number }).id);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        userId,
        objectFile,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      // Harden against active content served from the app origin: force
      // scriptable types to download rather than execute inline. We don't
      // know the content type without a HEAD call, so default to a safe
      // attachment disposition — this is a private-object download link,
      // not something meant to render inline in the browser.
      const downloadUrl = await objectStorageService.getObjectEntityDownloadURL(
        objectFile,
        { responseContentDisposition: "attachment" },
      );
      res.redirect(302, downloadUrl);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        req.log.warn({ err: error }, "Object not found");
        res.status(404).json({ error: "Object not found" });
        return;
      }
      req.log.error({ err: error }, "Error serving object");
      res.status(500).json({ error: "Failed to serve object" });
    }
  },
);

export default router;
