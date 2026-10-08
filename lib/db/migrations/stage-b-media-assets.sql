-- Stage B, additive-only schema migration.
-- Review and run against a non-production copy first.
-- No existing video, review, delivery or storage data is modified.
BEGIN;

CREATE TABLE IF NOT EXISTS media_assets (
  id serial PRIMARY KEY,
  owner_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_key text NOT NULL,
  original_filename text NOT NULL,
  content_type text NOT NULL,
  size_bytes bigint,
  checksum_sha256 text,
  status text NOT NULL DEFAULT 'pending',
  verified_at timestamp,
  deleted_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS media_assets_owner_storage_key_unique
  ON media_assets (owner_id, storage_key);
CREATE INDEX IF NOT EXISTS media_assets_owner_created_idx
  ON media_assets (owner_id, created_at);
CREATE INDEX IF NOT EXISTS media_assets_owner_status_idx
  ON media_assets (owner_id, status);

ALTER TABLE videos ADD COLUMN IF NOT EXISTS media_asset_id integer;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'videos_media_asset_id_media_assets_id_fk') THEN
    ALTER TABLE videos ADD CONSTRAINT videos_media_asset_id_media_assets_id_fk
      FOREIGN KEY (media_asset_id) REFERENCES media_assets(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;
