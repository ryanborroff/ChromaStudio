-- Stage B large-original verification job infrastructure.
-- ADDITIVE ONLY. Do not apply until non-production migration rehearsal,
-- backup and recovery validation have passed.
BEGIN;

CREATE TABLE IF NOT EXISTS media_verification_jobs (
  id serial PRIMARY KEY,
  asset_id integer NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  owner_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expected_sha256 text NOT NULL CHECK (expected_sha256 ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'verified', 'mismatch', 'failed', 'cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  bytes_processed bigint NOT NULL DEFAULT 0 CHECK (bytes_processed >= 0),
  lease_owner text,
  lease_expires_at timestamp,
  last_error_code text,
  started_at timestamp,
  completed_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT media_verification_jobs_asset_unique UNIQUE (asset_id)
);

CREATE INDEX IF NOT EXISTS media_verification_jobs_owner_status_idx
  ON media_verification_jobs (owner_id, status);
CREATE INDEX IF NOT EXISTS media_verification_jobs_status_lease_idx
  ON media_verification_jobs (status, lease_expires_at);

COMMIT;
