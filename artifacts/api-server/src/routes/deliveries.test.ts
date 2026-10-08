import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

// deliveries.ts imports these at module load time; mock them so the test
// never touches a real database or R2 bucket.
const limitMock = vi.fn();
const whereMock = vi.fn(() => ({ limit: limitMock }));
const fromMock = vi.fn(() => ({ where: whereMock }));
const selectMock = vi.fn(() => ({ from: fromMock }));

vi.mock("@workspace/db", () => ({
  db: { select: selectMock },
  deliveriesTable: { token: "token", id: "id" },
  deliveryFilesTable: { id: "id", deliveryId: "deliveryId" },
}));

const getObjectEntityFile = vi.fn();
const getObjectEntityDownloadURL = vi.fn();
const canAccessObjectEntity = vi.fn();

vi.mock("../lib/objectStorage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/objectStorage")>();
  return {
    ...actual,
    ObjectStorageService: vi.fn(function MockObjectStorageService(this: Record<string, unknown>) {
      this.getObjectEntityFile = getObjectEntityFile;
      this.getObjectEntityDownloadURL = getObjectEntityDownloadURL;
      this.canAccessObjectEntity = canAccessObjectEntity;
    }),
  };
});

function buildApp(): Express {
  return express();
}

const baseFile = {
  id: 1,
  deliveryId: 42,
  name: "final_cut.mp4",
  contentType: "video/mp4",
  objectPath: "/objects/private/uploads/abc",
};

const baseDelivery = { id: 42, userId: 7, token: "tok123", passwordHash: null };

describe("GET /deliveries/shared/:token/files/:fileId/download", () => {
  beforeAll(() => {
    process.env.SESSION_SECRET = "test-secret";
  });

  beforeEach(() => {
    vi.clearAllMocks();
    canAccessObjectEntity.mockResolvedValue(true);
  });

  it("returns 404 when the delivery token does not exist", async () => {
    limitMock.mockResolvedValueOnce([]); // delivery lookup

    const { default: deliveriesRouter } = await import("./deliveries");
    const app = buildApp();
    app.use(deliveriesRouter);

    const res = await request(app).get("/deliveries/shared/unknown-token/files/1/download");

    expect(res.status).toBe(404);
    expect(getObjectEntityDownloadURL).not.toHaveBeenCalled();
  });

  it("returns 403 when the delivery is password-protected and no valid key is provided", async () => {
    limitMock.mockResolvedValueOnce([{ ...baseDelivery, passwordHash: "hashed" }]); // delivery lookup

    const { default: deliveriesRouter } = await import("./deliveries");
    const app = buildApp();
    app.use(deliveriesRouter);

    const res = await request(app).get("/deliveries/shared/tok123/files/1/download");

    expect(res.status).toBe(403);
    expect(getObjectEntityFile).not.toHaveBeenCalled();
    expect(getObjectEntityDownloadURL).not.toHaveBeenCalled();
  });

  it("returns 404 when the delivery exists but the file does not", async () => {
    limitMock
      .mockResolvedValueOnce([baseDelivery]) // delivery lookup
      .mockResolvedValueOnce([]); // file lookup

    const { default: deliveriesRouter } = await import("./deliveries");
    const app = buildApp();
    app.use(deliveriesRouter);

    const res = await request(app).get("/deliveries/shared/tok123/files/999/download");

    expect(res.status).toBe(404);
    expect(getObjectEntityDownloadURL).not.toHaveBeenCalled();
  });

  it("redirects to a signed download URL for an unlocked delivery and existing file", async () => {
    limitMock
      .mockResolvedValueOnce([baseDelivery]) // delivery lookup
      .mockResolvedValueOnce([baseFile]); // file lookup
    getObjectEntityFile.mockResolvedValue({ key: "private/uploads/abc" });
    getObjectEntityDownloadURL.mockResolvedValue("https://r2.example.com/signed?sig=1");

    const { default: deliveriesRouter } = await import("./deliveries");
    const app = buildApp();
    app.use(deliveriesRouter);

    const res = await request(app).get("/deliveries/shared/tok123/files/1/download");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("https://r2.example.com/signed?sig=1");
    expect(getObjectEntityDownloadURL).toHaveBeenCalledWith(
      { key: "private/uploads/abc" },
      expect.objectContaining({
        responseContentType: "video/mp4",
        responseContentDisposition: expect.stringContaining("final_cut.mp4"),
      }),
    );
  });
});
