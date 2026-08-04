import { S3Client } from "@aws-sdk/client-s3";

let _client: S3Client | null = null;
let _bucket: string | null = null;

/**
 * Returns the R2 S3 client, initialised lazily on first use.
 * Throws a clear error if the required env vars are absent (e.g. in dev without R2).
 */
export function getR2Client(): S3Client {
  if (_client) return _client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 credentials not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.",
    );
  }

  _client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return _client;
}

/**
 * Returns the R2 bucket name, throwing if not configured.
 */
export function getR2Bucket(): string {
  if (_bucket) return _bucket;
  const name = process.env.R2_BUCKET_NAME;
  if (!name) throw new Error("R2_BUCKET_NAME not set.");
  _bucket = name;
  return _bucket;
}
