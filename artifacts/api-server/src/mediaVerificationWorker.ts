import { createHash, randomUUID } from "node:crypto";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { pool } from "@workspace/db";
import { getR2Bucket, getR2Client } from "./lib/r2Client";

/**
 * Single-job invocation for an external scheduler. The SQL claim is atomic
 * across concurrent processes; a crashed worker's lease can be reclaimed.
 * Run only after the Stage B verification migration is rehearsed/applied.
 */
export async function runVerificationJob(): Promise<boolean> {
  const workerId = randomUUID();
  const claimed = await pool.query<{
    id: number; asset_id: number; owner_id: number; expected_sha256: string;
    storage_key: string; size_bytes: string | number | null;
  }>(`
    WITH candidate AS (
      SELECT j.id FROM media_verification_jobs j
      JOIN media_assets a ON a.id = j.asset_id AND a.owner_id = j.owner_id
      WHERE a.deleted_at IS NULL AND a.checksum_sha256 IS NULL
        AND (j.status = 'queued' OR
          (j.status = 'running' AND j.lease_expires_at < now()))
        AND j.attempts < 3
      ORDER BY j.created_at ASC
      FOR UPDATE OF j SKIP LOCKED LIMIT 1
    )
    UPDATE media_verification_jobs j SET
      status = 'running', attempts = j.attempts + 1,
      lease_owner = $1, lease_expires_at = now() + interval '30 minutes',
      started_at = now(), updated_at = now(), last_error_code = NULL
    FROM candidate c, media_assets a
    WHERE j.id = c.id AND a.id = j.asset_id
    RETURNING j.id, j.asset_id, j.owner_id, j.expected_sha256,
      a.storage_key, a.size_bytes
  `, [workerId]);
  const job = claimed.rows[0];
  if (!job) return false;

  const key = job.storage_key;
  const expectedSize = Number(job.size_bytes);
  try {
    if (!Number.isSafeInteger(expectedSize) || expectedSize < 0) throw new Error("invalid_size");
    const client = getR2Client();
    const bucket = getR2Bucket();
    const before = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    if (before.ContentLength !== expectedSize) throw new Error("size_changed");
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key, IfMatch: before.ETag }));
    if (!object.Body) throw new Error("missing_body");
    if (!before.ETag || object.ETag !== before.ETag) throw new Error("object_changed");
    const hash = createHash("sha256");
    let processed = 0;
    let lastHeartbeat = Date.now();
    for await (const chunk of object.Body as AsyncIterable<Uint8Array>) {
      processed += chunk.byteLength;
      if (processed > expectedSize) throw new Error("size_changed");
      hash.update(chunk);
      if (Date.now() - lastHeartbeat > 15_000) {
        const heartbeat = await pool.query(`
          UPDATE media_verification_jobs SET bytes_processed = $3,
            lease_expires_at = now() + interval '30 minutes', updated_at = now()
          WHERE id = $1 AND lease_owner = $2 AND status = 'running'
          RETURNING id
        `, [job.id, workerId, processed]);
        if (!heartbeat.rowCount) throw new Error("lease_lost");
        lastHeartbeat = Date.now();
      }
    }
    if (processed !== expectedSize) throw new Error("size_changed");
    const after = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    if (after.ETag !== before.ETag || after.ContentLength !== before.ContentLength || after.LastModified?.getTime() !== before.LastModified?.getTime()) {
      throw new Error("object_changed");
    }
    const digest = hash.digest("hex");
    const status = digest === job.expected_sha256 ? "verified" : "mismatch";
    const connection = await pool.connect();
    try {
      await connection.query("BEGIN");
      const finished = await connection.query(`
        UPDATE media_verification_jobs SET status = $3, bytes_processed = $4,
          lease_owner = NULL, lease_expires_at = NULL, completed_at = now(),
          updated_at = now()
        WHERE id = $1 AND lease_owner = $2 AND status = 'running'
        RETURNING asset_id, owner_id
      `, [job.id, workerId, status, processed]);
      if (!finished.rowCount) throw new Error("lease_lost");
      if (status === "verified") {
        const assetUpdate = await connection.query(`
          UPDATE media_assets SET checksum_sha256 = $3, updated_at = now()
          WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL
            AND checksum_sha256 IS NULL AND storage_key = $4
          RETURNING id
        `, [job.asset_id, job.owner_id, digest, key]);
        // Never mark a job verified unless the corresponding asset was updated
        // in the same transaction. Deletion or concurrent mutation rolls back.
        if (!assetUpdate.rowCount) throw new Error("asset_changed");
      }
      await connection.query("COMMIT");
    } catch (error) {
      await connection.query("ROLLBACK");
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : "unknown";
    const safeCode = ["invalid_size", "size_changed", "missing_body", "object_changed", "lease_lost", "asset_changed"].includes(code)
      ? code : "storage_error";
    await pool.query(`
      UPDATE media_verification_jobs SET
        status = CASE WHEN attempts >= 3 THEN 'failed' ELSE 'queued' END,
        lease_owner = NULL, lease_expires_at = NULL, last_error_code = $3,
        updated_at = now()
      WHERE id = $1 AND lease_owner = $2 AND status = 'running'
    `, [job.id, workerId, safeCode]);
  }
  return true;
}

if (process.env.CHROMA_VERIFICATION_WORKER === "1") {
  runVerificationJob()
    .then(async (processed) => {
      console.log(processed ? "Verification job processed" : "No verification job queued");
      await pool.end();
    })
    .catch(async (error) => {
      console.error("Verification worker failed", error);
      await pool.end();
      process.exitCode = 1;
    });
}
