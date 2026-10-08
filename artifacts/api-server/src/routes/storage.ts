import { Router, type IRouter, type Request, type Response } from "express";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
  GetStorageUsageResponse,
} from "@workspace/api-zod";
import { and, eq, sql } from "drizzle-orm";
import { db, videosTable } from "@workspace/db";
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
  const [usage] = await db
    .select({
      totalBytesUsed: sql<number>`coalesce(sum(${videosTable.fileSizeBytes}), 0)::bigint`,
      videoCount: sql<number>`count(*)::int`,
    })
    .from(videosTable)
    .where(
      and(
        eq(videosTable.userId, userId),
        eq(videosTable.streamStatus, "ready"),
      ),
    );

  const plan = (req.user as { plan?: string }).plan ?? "free";
  const planStorageLimitBytes = STORAGE_LIMITS[plan] ?? STORAGE_LIMITS.free;
  const totalBytesUsed = Number(usage?.totalBytesUsed ?? 0);
  const usagePercent =
    planStorageLimitBytes > 0
      ? Number(((totalBytesUsed / planStorageLimitBytes) * 100).toFixed(2))
      : 0;

  res.json(
    GetStorageUsageResponse.parse({
      totalBytesUsed,
      videoCount: usage?.videoCount ?? 0,
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
