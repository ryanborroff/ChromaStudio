import { beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Request } from "express";
import request from "supertest";

const canAccessObjectEntity = vi.fn();
const getObjectEntityFileForUpload = vi.fn();
const send = vi.fn();
const signedUrl = vi.fn();
const getObjectEntityFile = vi.fn();
const verifyObjectUpload = vi.fn();
const calculateObjectSha256 = vi.fn();
const dbInsert = vi.fn();
const dbSelect = vi.fn();

vi.mock("@workspace/db", () => ({
  db: { insert: dbInsert, select: dbSelect }, mediaAssetsTable: { ownerId: "ownerId", storageKey: "storageKey" }, videosTable: {},
}));
vi.mock("../lib/objectStorage", () => ({
  ObjectNotFoundError: class ObjectNotFoundError extends Error {},
  ObjectStorageService: class {
    getObjectEntityFileForUpload = getObjectEntityFileForUpload;
    getObjectEntityFile = getObjectEntityFile;
    verifyObjectUpload = verifyObjectUpload;
    calculateObjectSha256 = calculateObjectSha256;
    canAccessObjectEntity = canAccessObjectEntity;
  },
}));
vi.mock("../lib/r2Client", () => ({
  getR2Client: () => ({ send }),
  getR2Bucket: () => "test-bucket",
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: signedUrl,
}));

const objectPath = "/objects/private/uploads/11111111-1111-4111-8111-111111111111";
const session = { objectPath, uploadId: "upload-session" };

async function buildApp(userId: number | null) {
  const { default: router } = await import("./mediaAssets");
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.isAuthenticated = (() => userId !== null) as Request["isAuthenticated"];
    if (userId !== null) req.user = { id: userId } as Express.User;
    req.log = { error: vi.fn() } as unknown as typeof req.log;
    next();
  });
  app.use(router);
  return app;
}

describe("Media Warehouse multipart access and completion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getObjectEntityFileForUpload.mockResolvedValue({ key: objectPath.slice("/objects/".length) });
    canAccessObjectEntity.mockResolvedValue(true);
    signedUrl.mockResolvedValue("https://example.invalid/signed");
    getObjectEntityFile.mockResolvedValue({ key: objectPath.slice("/objects/".length) });
    verifyObjectUpload.mockResolvedValue({ key: objectPath.slice("/objects/".length), sizeBytes: 8, contentType: "application/octet-stream", originalFilename: "camera-original.braw" });
    calculateObjectSha256.mockResolvedValue("b".repeat(64));
  });

  it("rejects registration retries when stored object metadata differs", async () => {
    const existing = {
      id: 15, ownerId: 1, storageKey: objectPath.slice("/objects/".length),
      sizeBytes: 7, contentType: "application/octet-stream",
      checksumSha256: null, deletedAt: null,
    };
    dbInsert.mockReturnValue({
      values: () => ({
        onConflictDoNothing: () => ({ returning: async () => [] }),
      }),
    });
    dbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: async () => [existing] }) }),
    });
    const app = await buildApp(1);
    const result = await request(app).post("/media-assets").send({
      objectPath, originalFilename: "camera-original.braw",
      contentType: "application/octet-stream",
    });
    expect(result.status).toBe(409);
    expect(result.body.error).toMatch(/metadata changed/);
  });

  it("allows an idempotent retry when registered object metadata is unchanged", async () => {
    const existing = {
      id: 15, ownerId: 1, storageKey: objectPath.slice("/objects/".length),
      sizeBytes: 8, contentType: "application/octet-stream",
      checksumSha256: null, deletedAt: null,
    };
    dbInsert.mockReturnValue({
      values: () => ({
        onConflictDoNothing: () => ({ returning: async () => [] }),
      }),
    });
    dbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: async () => [existing] }) }),
    });
    const app = await buildApp(1);
    const result = await request(app).post("/media-assets").send({
      objectPath, originalFilename: "camera-original.braw",
      contentType: "application/octet-stream",
    });
    expect(result.status).toBe(200);
    expect(result.body.asset.id).toBe(15);
  });

  it("rejects an integrity claim that conflicts with an existing unverified record", async () => {
    const existing = {
      id: 15, ownerId: 1, storageKey: objectPath.slice("/objects/".length),
      sizeBytes: 8, contentType: "application/octet-stream",
      checksumSha256: null, deletedAt: null,
    };
    dbInsert.mockReturnValue({
      values: () => ({ onConflictDoNothing: () => ({ returning: async () => [] }) }),
    });
    dbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: async () => [existing] }) }),
    });
    const app = await buildApp(1);
    const result = await request(app).post("/media-assets").send({
      objectPath, originalFilename: "camera-original.braw",
      contentType: "application/octet-stream", checksumSha256: "b".repeat(64),
    });
    expect(result.status).toBe(409);
    expect(result.body.error).toMatch(/checksum differs/);
    expect(calculateObjectSha256).toHaveBeenCalledWith(objectPath, 8);
  });

  it("accepts an idempotent retry of a previously verified checksum", async () => {
    const existing = {
      id: 15, ownerId: 1, storageKey: objectPath.slice("/objects/".length),
      sizeBytes: 8, contentType: "application/octet-stream",
      checksumSha256: "b".repeat(64), deletedAt: null,
    };
    dbInsert.mockReturnValue({
      values: () => ({ onConflictDoNothing: () => ({ returning: async () => [] }) }),
    });
    dbSelect.mockReturnValue({
      from: () => ({ where: () => ({ limit: async () => [existing] }) }),
    });
    const app = await buildApp(1);
    const result = await request(app).post("/media-assets").send({
      objectPath, originalFilename: "camera-original.braw",
      contentType: "application/octet-stream", checksumSha256: "b".repeat(64),
    });
    expect(result.status).toBe(200);
    expect(result.body.asset.checksumSha256).toBe("b".repeat(64));
  });

  it("rejects a checksum that does not match independently hashed stored bytes", async () => {
    const app = await buildApp(1);
    const result = await request(app).post("/media-assets").send({
      objectPath,
      originalFilename: "camera-original.braw",
      contentType: "application/octet-stream",
      checksumSha256: "a".repeat(64),
    });
    expect(result.status).toBe(422);
    expect(result.body.error).toMatch(/checksum does not match/);
    expect(calculateObjectSha256).toHaveBeenCalledWith(objectPath, 8);
  });

  it("does not read R2 bytes for a checksum when storage access is denied", async () => {
    canAccessObjectEntity.mockResolvedValue(false);
    const app = await buildApp(99);
    const result = await request(app).post("/media-assets").send({
      objectPath, originalFilename: "original.braw",
      contentType: "application/octet-stream", checksumSha256: "a".repeat(64),
    });
    expect(result.status).toBe(403);
    expect(verifyObjectUpload).not.toHaveBeenCalled();
    expect(calculateObjectSha256).not.toHaveBeenCalled();
  });

  it("rejects expensive synchronous hashing for large originals", async () => {
    verifyObjectUpload.mockResolvedValue({
      key: objectPath.slice("/objects/".length),
      sizeBytes: 33 * 1024 * 1024,
      contentType: "application/octet-stream",
      originalFilename: "original.braw",
    });
    const app = await buildApp(1);
    const result = await request(app).post("/media-assets").send({
      objectPath, originalFilename: "original.braw",
      contentType: "application/octet-stream", checksumSha256: "a".repeat(64),
    });
    expect(result.status).toBe(422);
    expect(calculateObjectSha256).not.toHaveBeenCalled();
  });

  it("rejects multipart files exceeding the object storage size ceiling", async () => {
    const app = await buildApp(1);
    const result = await request(app).post("/media-assets/multipart/start").send({
      originalFilename: "oversized.braw",
      contentType: "application/octet-stream",
      sizeBytes: 5 * 1024 ** 4 + 1,
    });
    expect(result.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects nonpositive and oversized direct upload requests", async () => {
    const app = await buildApp(1);
    for (const sizeBytes of [0, 32 * 1024 ** 2 + 1, 5 * 1024 ** 4 + 1]) {
      const result = await request(app).post("/media-assets/upload-url").send({
        originalFilename: "invalid.braw",
        contentType: "application/octet-stream", sizeBytes,
      });
      expect(result.status).toBe(400);
    }
    expect(signedUrl).not.toHaveBeenCalled();
  });

  it("requires authentication before listing uploaded parts", async () => {
    const app = await buildApp(null);
    const result = await request(app).post("/media-assets/multipart/parts").send(session);
    expect(result.status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  it("does not sign parts when a different account lacks storage permission", async () => {
    canAccessObjectEntity.mockResolvedValue(false);
    const app = await buildApp(99);
    const result = await request(app).post("/media-assets/multipart/part-url")
      .send({ ...session, partNumber: 1 });
    expect(result.status).toBe(403);
    expect(signedUrl).not.toHaveBeenCalled();
    expect(canAccessObjectEntity).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "99", requestedPermission: "write" }),
    );
  });

  it("rejects completion when storage ownership has been revoked", async () => {
    canAccessObjectEntity.mockResolvedValue(false);
    const app = await buildApp(1);
    const result = await request(app).post("/media-assets/multipart/complete")
      .send({ ...session, parts: [{ partNumber: 1, etag: '"etag-1"' }] });
    expect(result.status).toBe(403);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects duplicate part numbers before completing an upload", async () => {
    const app = await buildApp(1);
    const result = await request(app).post("/media-assets/multipart/complete").send({
      ...session, parts: [
        { partNumber: 1, etag: '"etag-1"' },
        { partNumber: 1, etag: '"etag-1"' },
      ],
    });
    expect(result.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects mismatched ETags returned by R2", async () => {
    send.mockResolvedValueOnce({
      Parts: [{ PartNumber: 1, ETag: '"correct"', Size: 100 }],
      IsTruncated: false,
    });
    const app = await buildApp(1);
    const result = await request(app).post("/media-assets/multipart/complete")
      .send({ ...session, parts: [{ partNumber: 1, etag: '"incorrect"' }] });
    expect(result.status).toBe(409);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("lists existing parts for an authorised interrupted session", async () => {
    send.mockResolvedValueOnce({
      Parts: [{ PartNumber: 1, ETag: '"etag-1"', Size: 33554432 }],
      IsTruncated: false,
    });
    const app = await buildApp(1);
    const result = await request(app).post("/media-assets/multipart/parts").send(session);
    expect(result.status).toBe(200);
    expect(result.body.parts).toEqual([
      { partNumber: 1, etag: '"etag-1"', size: 33554432 },
    ]);
  });
});
