import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn(), send: vi.fn(), acl: vi.fn() }));
vi.mock("@workspace/db", () => ({ pool: { query: mocks.query, connect: mocks.connect } }));
vi.mock("./lib/r2Client", () => ({ getR2Client: () => ({ send: mocks.send }), getR2Bucket: () => "test" }));
vi.mock("./lib/objectAcl", () => ({ getObjectAclPolicy: mocks.acl }));
import { runVerificationJob } from "./mediaVerificationWorker";

const bytes = Buffer.from("original bytes");
const job = { id: 1, asset_id: 2, owner_id: 3, storage_key: "private/uploads/test", size_bytes: bytes.length, expected_sha256: createHash("sha256").update(bytes).digest("hex") };
let transaction: { query: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.query.mockResolvedValue({ rows: [], rowCount: 1 });
  mocks.query.mockResolvedValueOnce({ rows: [], rowCount: 0 }).mockResolvedValueOnce({ rows: [job], rowCount: 1 });
  mocks.acl.mockResolvedValue({ owner: "3", visibility: "private" });
  const head = { ContentLength: bytes.length, ETag: '"immutable"', LastModified: new Date(0) };
  mocks.send.mockResolvedValueOnce(head).mockResolvedValueOnce({ ETag: head.ETag, Body: (async function* () { yield bytes; })() }).mockResolvedValueOnce(head);
  transaction = { query: vi.fn().mockResolvedValue({ rowCount: 1 }), release: vi.fn() };
  mocks.connect.mockResolvedValue(transaction);
});

it("streams bytes and commits the checksum and job together", async () => {
  expect(await runVerificationJob()).toBe(true);
  expect(transaction.query.mock.calls[2][1]).toEqual([2, 3, job.expected_sha256, job.storage_key]);
  expect(transaction.query.mock.calls.at(-1)?.[0]).toBe("COMMIT");
  expect(transaction.release).toHaveBeenCalled();
});

it("refuses storage reads when ownership was revoked after queuing", async () => {
  mocks.acl.mockResolvedValue(null);
  await runVerificationJob();
  expect(mocks.send).not.toHaveBeenCalled();
  expect(mocks.query.mock.calls.at(-1)?.[1]?.[2]).toBe("ownership_changed");
});

it("refuses committing after ownership changes while streaming", async () => {
  mocks.acl.mockResolvedValueOnce({ owner: "3", visibility: "private" }).mockResolvedValueOnce({ owner: "4", visibility: "private" });
  await runVerificationJob();
  expect(mocks.connect).not.toHaveBeenCalled();
  expect(mocks.query.mock.calls.at(-1)?.[1]?.[2]).toBe("ownership_changed");
});

it("rejects a changed original without writing its checksum", async () => {
  mocks.send.mockReset().mockResolvedValueOnce({ ContentLength: bytes.length, ETag: '"old"' }).mockResolvedValueOnce({ ETag: '"new"', Body: {} });
  await runVerificationJob();
  expect(mocks.connect).not.toHaveBeenCalled();
  expect(mocks.query.mock.calls.at(-1)?.[1]?.[2]).toBe("object_changed");
});

it("rolls back a verification if the asset was concurrently removed", async () => {
  transaction.query.mockResolvedValueOnce({}).mockResolvedValueOnce({ rowCount: 1 }).mockResolvedValueOnce({ rowCount: 0 });
  await runVerificationJob();
  expect(transaction.query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
  expect(mocks.query.mock.calls.at(-1)?.[1]?.[2]).toBe("asset_changed");
});

it("expires exhausted leases even when there is no claimable job", async () => {
  mocks.query.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
  expect(await runVerificationJob()).toBe(false);
  expect(mocks.query.mock.calls[0][0]).toContain("attempts >= 3");
  expect(mocks.send).not.toHaveBeenCalled();
});

it("records a mismatch without granting a verified checksum", async () => {
  mocks.query.mockReset().mockResolvedValue({ rows: [], rowCount: 1 })
    .mockResolvedValueOnce({ rows: [], rowCount: 0 })
    .mockResolvedValueOnce({ rows: [{ ...job, expected_sha256: "0".repeat(64) }], rowCount: 1 });
  await runVerificationJob();
  expect(transaction.query.mock.calls[1][1]?.[2]).toBe("mismatch");
  expect(transaction.query.mock.calls).toHaveLength(3);
});

it("does not commit a truncated stream", async () => {
  mocks.send.mockReset().mockResolvedValueOnce({ ContentLength: bytes.length, ETag: '"same"' })
    .mockResolvedValueOnce({ ETag: '"same"', Body: (async function* () { yield bytes.subarray(1); })() });
  await runVerificationJob();
  expect(mocks.connect).not.toHaveBeenCalled();
  expect(mocks.query.mock.calls.at(-1)?.[1]?.[2]).toBe("size_changed");
});
