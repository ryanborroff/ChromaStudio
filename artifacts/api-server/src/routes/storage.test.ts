import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import request from "supertest";

// storage.ts imports these at module load time; mock them so the test never
// touches a real database or R2 bucket.
vi.mock("@workspace/db", () => ({
  db: { select: vi.fn() },
  videosTable: {},
}));

const getObjectEntityFile = vi.fn();
const canAccessObjectEntity = vi.fn();
const getObjectEntityDownloadURL = vi.fn();

vi.mock("../lib/objectStorage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/objectStorage")>();
  return {
    ...actual,
    ObjectStorageService: vi.fn(function MockObjectStorageService(this: Record<string, unknown>) {
      this.getObjectEntityFile = getObjectEntityFile;
      this.canAccessObjectEntity = canAccessObjectEntity;
      this.getObjectEntityDownloadURL = getObjectEntityDownloadURL;
    }),
  };
});

// storage.test's fake auth layer: /me toggles whether requests look
// authenticated, matching the shape requireAuth checks for (req.isAuthenticated()
// + req.user), without wiring up real passport/session middleware.
function buildApp(user: { id: number } | null): Express {
  const app = express();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (user) {
      req.isAuthenticated = (() => true) as Request["isAuthenticated"];
      req.user = user as Express.User;
    } else {
      req.isAuthenticated = (() => false) as Request["isAuthenticated"];
    }
    next();
  });
  // Import after mocks are registered so the router picks up the mocked deps.
  return app;
}

describe("GET /storage/objects/*path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when the request is not authenticated", async () => {
    const { default: storageRouter } = await import("./storage");
    const app = buildApp(null);
    app.use(storageRouter);

    const res = await request(app).get("/storage/objects/private/uploads/abc");

    expect(res.status).toBe(401);
    expect(getObjectEntityFile).not.toHaveBeenCalled();
    expect(getObjectEntityDownloadURL).not.toHaveBeenCalled();
  });

  it("returns 403 when the authenticated user fails the ACL check", async () => {
    getObjectEntityFile.mockResolvedValue({ key: "private/uploads/abc" });
    canAccessObjectEntity.mockResolvedValue(false);

    const { default: storageRouter } = await import("./storage");
    const app = buildApp({ id: 999 });
    app.use(storageRouter);

    const res = await request(app).get("/storage/objects/private/uploads/abc");

    expect(res.status).toBe(403);
    expect(canAccessObjectEntity).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "999", requestedPermission: "read" }),
    );
    expect(getObjectEntityDownloadURL).not.toHaveBeenCalled();
  });

  it("redirects to a signed download URL when the ACL check passes", async () => {
    getObjectEntityFile.mockResolvedValue({ key: "private/uploads/abc" });
    canAccessObjectEntity.mockResolvedValue(true);
    getObjectEntityDownloadURL.mockResolvedValue("https://r2.example.com/signed?sig=1");

    const { default: storageRouter } = await import("./storage");
    const app = buildApp({ id: 1 });
    app.use(storageRouter);

    const res = await request(app).get("/storage/objects/private/uploads/abc");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("https://r2.example.com/signed?sig=1");
    // Never streams bytes through this server — only a redirect.
    expect(res.headers["content-disposition"]).toBeUndefined();
  });
});
