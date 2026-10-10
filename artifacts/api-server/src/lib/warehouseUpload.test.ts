import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sign: vi.fn().mockResolvedValue("signed"), acl: vi.fn() }));
vi.mock("./r2Client", () => ({ getR2Client: () => ({}), getR2Bucket: () => "test" }));
vi.mock("./objectAcl", () => ({ setObjectAclPolicy: mocks.acl }));
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: mocks.sign }));
import { ObjectStorageService } from "./objectStorage";

it("signs the write-once condition and establishes private ownership before issuing a URL", async () => {
  await new ObjectStorageService().getObjectEntityUploadURL("23", {
    originalFilename: "project.zip", contentType: "application/zip", writeOnce: true,
  });
  expect(mocks.acl.mock.calls[0][1]).toEqual({ owner: "23", visibility: "private" });
  expect(mocks.acl.mock.invocationCallOrder[0]).toBeLessThan(mocks.sign.mock.invocationCallOrder[0]);
  expect(mocks.sign.mock.calls[0][1].input.IfNoneMatch).toBe("*");
  expect(mocks.sign.mock.calls[0][2].signableHeaders.has("if-none-match")).toBe(true);
});
