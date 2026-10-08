import { describe, expect, it, vi } from "vitest";
import { canAccessObject, ObjectPermission } from "./objectAcl";

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("./r2Client", () => ({
  getR2Client: () => ({ send }),
  getR2Bucket: () => "test-bucket",
}));

function policy(owner: string, visibility: "public" | "private" = "private") {
  send.mockResolvedValueOnce({
    Body: { transformToString: async () => JSON.stringify({ owner, visibility }) },
  });
}

describe("private object ACL", () => {
  it("allows the owner to read and write", async () => {
    policy("1");
    expect(await canAccessObject({
      userId: "1", objectRef: { key: "private/uploads/a" },
      requestedPermission: ObjectPermission.WRITE,
    })).toBe(true);
  });

  it("rejects another user's read and write", async () => {
    policy("1");
    expect(await canAccessObject({
      userId: "2", objectRef: { key: "private/uploads/a" },
      requestedPermission: ObjectPermission.READ,
    })).toBe(false);
    policy("1");
    expect(await canAccessObject({
      userId: "2", objectRef: { key: "private/uploads/a" },
      requestedPermission: ObjectPermission.WRITE,
    })).toBe(false);
  });

  it("fails closed without ACL metadata", async () => {
    send.mockRejectedValueOnce(new Error("NoSuchKey"));
    expect(await canAccessObject({
      userId: "1", objectRef: { key: "private/uploads/legacy" },
      requestedPermission: ObjectPermission.WRITE,
    })).toBe(false);
  });

  it("does not allow an anonymous user to write a public object", async () => {
    policy("1", "public");
    expect(await canAccessObject({
      objectRef: { key: "public/example" },
      requestedPermission: ObjectPermission.WRITE,
    })).toBe(false);
  });
});
