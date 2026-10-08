import { Router, type IRouter, type Request, type Response } from "express";
import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq, and, desc, count } from "drizzle-orm";
import { db, deliveriesTable, deliveryFilesTable } from "@workspace/db";
import {
  CreateDeliveryBody,
  UpdateDeliveryBody,
  AddDeliveryFileBody,
  UnlockSharedDeliveryBody,
  ListDeliveriesResponse,
  GetDeliveryResponse,
  GetSharedDeliveryResponse,
} from "@workspace/api-zod";
import { requireAuth, getCurrentUser } from "../lib/auth";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { ObjectPermission } from "../lib/objectAcl";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const DOWNLOAD_KEY_TTL_MS = 24 * 60 * 60 * 1000; // 24h

type DeliveryRow = typeof deliveriesTable.$inferSelect;
type DeliveryFileRow = typeof deliveryFilesTable.$inferSelect;

// ── Signed download keys ──────────────────────────────────────────────────────
// Stateless gate for password-protected deliveries: the unlock endpoint issues a
// short-lived HMAC bound to the share token; downloads must present it.
function signDownloadKey(token: string): string {
  const secret = process.env.SESSION_SECRET as string;
  const expiry = Date.now() + DOWNLOAD_KEY_TTL_MS;
  const mac = createHmac("sha256", secret).update(`${token}.${expiry}`).digest("hex");
  return `${expiry}.${mac}`;
}

function verifyDownloadKey(token: string, key: string): boolean {
  const secret = process.env.SESSION_SECRET as string;
  const dot = key.indexOf(".");
  if (dot < 0) return false;
  const expiryStr = key.slice(0, dot);
  const mac = key.slice(dot + 1);
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false;
  const expected = createHmac("sha256", secret).update(`${token}.${expiry}`).digest("hex");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ── Serializers ───────────────────────────────────────────────────────────────
function fileResponse(f: DeliveryFileRow) {
  return {
    id: f.id,
    name: f.name,
    contentType: f.contentType ?? null,
    size: f.size ?? null,
    createdAt: f.createdAt.toISOString(),
  };
}

function detailResponse(d: DeliveryRow, files: DeliveryFileRow[]) {
  return {
    id: d.id,
    token: d.token,
    title: d.title,
    message: d.message ?? null,
    hasPassword: !!d.passwordHash,
    createdAt: d.createdAt.toISOString(),
    files: files.map(fileResponse),
  };
}

function summaryResponse(d: DeliveryRow, fileCount: number) {
  return {
    id: d.id,
    token: d.token,
    title: d.title,
    message: d.message ?? null,
    hasPassword: !!d.passwordHash,
    fileCount,
    createdAt: d.createdAt.toISOString(),
  };
}

async function loadFiles(deliveryId: number): Promise<DeliveryFileRow[]> {
  return db
    .select()
    .from(deliveryFilesTable)
    .where(eq(deliveryFilesTable.deliveryId, deliveryId))
    .orderBy(deliveryFilesTable.createdAt);
}

// ── Owner routes (auth required) ──────────────────────────────────────────────

// GET /deliveries — list the current user's deliveries with file counts
router.get("/deliveries", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = await getCurrentUser(req);
  const rows = await db
    .select()
    .from(deliveriesTable)
    .where(eq(deliveriesTable.userId, user.id))
    .orderBy(desc(deliveriesTable.createdAt));

  const counts = await db
    .select({ deliveryId: deliveryFilesTable.deliveryId, c: count() })
    .from(deliveryFilesTable)
    .groupBy(deliveryFilesTable.deliveryId);
  const countMap = new Map(counts.map((r) => [r.deliveryId, Number(r.c)]));

  res.json(
    ListDeliveriesResponse.parse({
      deliveries: rows.map((d) => summaryResponse(d, countMap.get(d.id) ?? 0)),
    }),
  );
});

// POST /deliveries — create a delivery
router.post("/deliveries", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateDeliveryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await getCurrentUser(req);

  const passwordHash =
    parsed.data.password && parsed.data.password.length > 0
      ? await bcrypt.hash(parsed.data.password, 12)
      : null;

  const [created] = await db
    .insert(deliveriesTable)
    .values({
      userId: user.id,
      token: randomBytes(16).toString("hex"),
      title: parsed.data.title,
      message: parsed.data.message ?? null,
      passwordHash,
    })
    .returning();

  res.status(201).json(GetDeliveryResponse.parse(detailResponse(created, [])));
});

// GET /deliveries/:id — owner detail with files
router.get("/deliveries/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getCurrentUser(req);
  const [delivery] = await db
    .select()
    .from(deliveriesTable)
    .where(and(eq(deliveriesTable.id, id), eq(deliveriesTable.userId, user.id)))
    .limit(1);
  if (!delivery) {
    res.status(404).json({ error: "Delivery not found" });
    return;
  }
  const files = await loadFiles(delivery.id);
  res.json(GetDeliveryResponse.parse(detailResponse(delivery, files)));
});

// PUT /deliveries/:id — update title/message/password
router.put("/deliveries/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const parsed = UpdateDeliveryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await getCurrentUser(req);
  const [delivery] = await db
    .select()
    .from(deliveriesTable)
    .where(and(eq(deliveriesTable.id, id), eq(deliveriesTable.userId, user.id)))
    .limit(1);
  if (!delivery) {
    res.status(404).json({ error: "Delivery not found" });
    return;
  }

  const update: Partial<typeof deliveriesTable.$inferInsert> = {};
  if (typeof parsed.data.title === "string") update.title = parsed.data.title;
  if (parsed.data.message !== undefined) update.message = parsed.data.message;
  // password: undefined = leave, null/empty = clear, string = set
  if (parsed.data.password === null || parsed.data.password === "") {
    update.passwordHash = null;
  } else if (typeof parsed.data.password === "string") {
    update.passwordHash = await bcrypt.hash(parsed.data.password, 12);
  }

  const [updated] = await db
    .update(deliveriesTable)
    .set(update)
    .where(and(eq(deliveriesTable.id, id), eq(deliveriesTable.userId, user.id)))
    .returning();

  const files = await loadFiles(updated.id);
  res.json(GetDeliveryResponse.parse(detailResponse(updated, files)));
});

// DELETE /deliveries/:id
router.delete("/deliveries/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const user = await getCurrentUser(req);
  const deleted = await db
    .delete(deliveriesTable)
    .where(and(eq(deliveriesTable.id, id), eq(deliveriesTable.userId, user.id)))
    .returning();
  if (deleted.length === 0) {
    res.status(404).json({ error: "Delivery not found" });
    return;
  }
  res.status(204).end();
});

// POST /deliveries/:id/files — attach an uploaded file
router.post("/deliveries/:id/files", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const parsed = AddDeliveryFileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // Only accept internal object-storage paths; never trust arbitrary URLs.
  if (!/^\/objects\//.test(parsed.data.objectPath)) {
    res.status(400).json({ error: "Invalid file path" });
    return;
  }
  const user = await getCurrentUser(req);
  const [delivery] = await db
    .select()
    .from(deliveriesTable)
    .where(and(eq(deliveriesTable.id, id), eq(deliveriesTable.userId, user.id)))
    .limit(1);
  if (!delivery) {
    res.status(404).json({ error: "Delivery not found" });
    return;
  }

  // A delivery owner must also own the underlying object. An internal path
  // alone is not proof of ownership, even when the delivery belongs to them.
  try {
    const objectFile = await objectStorageService.getObjectEntityFile(parsed.data.objectPath);
    const canAttach = await objectStorageService.canAccessObjectEntity({
      userId: String(user.id),
      objectFile,
      requestedPermission: ObjectPermission.WRITE,
    });
    if (!canAttach) {
      res.status(403).json({ error: "File is not owned by this account" });
      return;
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    throw error;
  }

  await db.insert(deliveryFilesTable).values({
    deliveryId: delivery.id,
    objectPath: parsed.data.objectPath,
    name: parsed.data.name,
    contentType: parsed.data.contentType ?? null,
    size: parsed.data.size ?? null,
  });

  const files = await loadFiles(delivery.id);
  res.status(201).json(GetDeliveryResponse.parse(detailResponse(delivery, files)));
});

// DELETE /deliveries/:id/files/:fileId
router.delete(
  "/deliveries/:id/files/:fileId",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    const fileId = parseInt(
      Array.isArray(req.params.fileId) ? req.params.fileId[0] : req.params.fileId,
      10,
    );
    const user = await getCurrentUser(req);
    const [delivery] = await db
      .select()
      .from(deliveriesTable)
      .where(and(eq(deliveriesTable.id, id), eq(deliveriesTable.userId, user.id)))
      .limit(1);
    if (!delivery) {
      res.status(404).json({ error: "Delivery not found" });
      return;
    }
    await db
      .delete(deliveryFilesTable)
      .where(and(eq(deliveryFilesTable.id, fileId), eq(deliveryFilesTable.deliveryId, delivery.id)));
    res.status(204).end();
  },
);

// ── Public routes (no auth) ───────────────────────────────────────────────────

// GET /deliveries/shared/:token — public metadata; files omitted until unlocked
router.get("/deliveries/shared/:token", async (req: Request, res: Response): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const [delivery] = await db
    .select()
    .from(deliveriesTable)
    .where(eq(deliveriesTable.token, token))
    .limit(1);
  if (!delivery) {
    res.status(404).json({ error: "Delivery not found" });
    return;
  }
  const requiresPassword = !!delivery.passwordHash;
  const files = requiresPassword ? [] : await loadFiles(delivery.id);
  res.json(
    GetSharedDeliveryResponse.parse({
      title: delivery.title,
      message: delivery.message ?? null,
      requiresPassword,
      unlocked: !requiresPassword,
      downloadKey: null,
      files: files.map(fileResponse),
    }),
  );
});

// POST /deliveries/shared/:token/unlock — verify password, return files + key
router.post(
  "/deliveries/shared/:token/unlock",
  async (req: Request, res: Response): Promise<void> => {
    const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
    const parsed = UnlockSharedDeliveryBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [delivery] = await db
      .select()
      .from(deliveriesTable)
      .where(eq(deliveriesTable.token, token))
      .limit(1);
    if (!delivery) {
      res.status(404).json({ error: "Delivery not found" });
      return;
    }
    if (delivery.passwordHash) {
      const ok = await bcrypt.compare(parsed.data.password, delivery.passwordHash);
      if (!ok) {
        res.status(401).json({ error: "Incorrect password" });
        return;
      }
    }
    const files = await loadFiles(delivery.id);
    res.json(
      GetSharedDeliveryResponse.parse({
        title: delivery.title,
        message: delivery.message ?? null,
        requiresPassword: !!delivery.passwordHash,
        unlocked: true,
        downloadKey: delivery.passwordHash ? signDownloadKey(token) : null,
        files: files.map(fileResponse),
      }),
    );
  },
);

// GET /deliveries/shared/:token/files/:fileId/download — stream a file
router.get(
  "/deliveries/shared/:token/files/:fileId/download",
  async (req: Request, res: Response): Promise<void> => {
    const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
    const fileId = parseInt(
      Array.isArray(req.params.fileId) ? req.params.fileId[0] : req.params.fileId,
      10,
    );
    const [delivery] = await db
      .select()
      .from(deliveriesTable)
      .where(eq(deliveriesTable.token, token))
      .limit(1);
    if (!delivery) {
      res.status(404).json({ error: "Delivery not found" });
      return;
    }
    // Password-protected deliveries require a valid signed key from unlock.
    if (delivery.passwordHash) {
      const k = typeof req.query.k === "string" ? req.query.k : "";
      if (!k || !verifyDownloadKey(token, k)) {
        res.status(403).json({ error: "This delivery is locked" });
        return;
      }
    }
    const [file] = await db
      .select()
      .from(deliveryFilesTable)
      .where(and(eq(deliveryFilesTable.id, fileId), eq(deliveryFilesTable.deliveryId, delivery.id)))
      .limit(1);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    try {
      const objectFile = await objectStorageService.getObjectEntityFile(file.objectPath);
      // Recheck object ownership at download time: legacy delivery rows may
      // predate attachment checks, and permissions can change after sharing.
      const stillOwned = await objectStorageService.canAccessObjectEntity({
        userId: String(delivery.userId),
        objectFile,
        requestedPermission: ObjectPermission.WRITE,
      });
      if (!stillOwned) {
        res.status(403).json({ error: "File access revoked" });
        return;
      }

      const asciiName = file.name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
      const downloadUrl = await objectStorageService.getObjectEntityDownloadURL(objectFile, {
        responseContentDisposition: `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        responseContentType: file.contentType ?? undefined,
      });
      res.redirect(302, downloadUrl);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "File not found" });
        return;
      }
      req.log.error({ err: error }, "Error serving delivery file");
      res.status(500).json({ error: "Failed to download file" });
    }
  },
);

export default router;
