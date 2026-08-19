# Video Durability & Soft-Delete Implementation

## Context

Chroma is a video hosting/streaming platform (Vimeo competitor) currently being
migrated off Replit onto Railway (hosting + Postgres) + Cloudflare R2 (storage)
+ Passport.js (auth, not Clerk). Migration is mid-flight — two known remaining
edits replace `REPLIT_DOMAINS` references with `APP_URL` in `app.ts` and
`passport.ts`.

This initiative: implement durability/anti-data-loss patterns for
user-uploaded video assets, matching how platforms like Vimeo protect customer
uploads.

## Goals

1. **Schema changes to `videos` table (Postgres/Railway)**
   - `checksum_sha256`
   - `storage_key` (server-generated UUID-based, not filename-derived)
   - `status` enum (`uploading` | `processing` | `ready` | `failed` | `soft_deleted`)
   - `deleted_at`
   - `purge_after`
   - `original_verified_at`

2. **Upload flow rework**
   - Pre-signed R2 upload URLs (client uploads directly to R2, not proxied
     through Railway server)
   - DB row created before upload completes (status `uploading`)
   - Post-upload verification (size/checksum) before flipping to `processing`
   - Original file written once to `originals/{userId}/{videoId}` prefix —
     never overwritten or deleted by downstream jobs
   - Transcode/derivative renditions written to a separate `derivatives/`
     prefix, regenerable from the original at any time
   - Scoped R2 API tokens: read-only on `originals/`, write+delete only on
     `derivatives/`

3. **Soft-delete flow**
   - User-facing delete flips `status = 'soft_deleted'` + sets `purge_after`
     (30-day default) — no R2 call at delete time
   - All read queries filter out `soft_deleted` status
   - Scheduled job (Railway cron) purges expired soft-deletes: deletes R2
     objects + DB row after `purge_after` passes

4. **Integrity checks**
   - Periodic job comparing R2 object metadata (size, and ideally checksum)
     against DB records, flagging mismatches

5. **Open question to verify — RESOLVED**
   - Checked Cloudflare's current R2 docs (2026-08-18): R2 does **not**
     support S3-style object versioning — no `VersionId`, no delete markers,
     no ability to recover a prior version of an overwritten or deleted
     object. The closest feature is **Bucket Locks**
     (developers.cloudflare.com/r2/buckets/bucket-locks/): prefix-based,
     time-bound WORM retention rules that block deletion/overwrite of
     matching objects for a configured duration (up to indefinite), capped
     at 1,000 rules per bucket. This is a coarser, immutability-only
     mechanism — not a version history you can browse or restore from.
   - Implication: the DB-driven `deletedAt`/`purgeAfter` soft-delete +
     scheduled purge job (implemented — see below) is the correct approach
     for this initiative; there is no native R2 versioning to lean on
     instead or in addition. Bucket Locks could optionally be layered on
     `originals/` keys later as a belt-and-suspenders anti-accidental-delete
     guard (e.g. a 30-day lock matching the soft-delete grace period), but
     that's a separate, optional hardening step, not a substitute for the
     soft-delete flow.

## What to do first

- Read the current storage service file (likely `server/storage.ts` or
  `server/services/r2.ts`) and the `videos` table schema/migration to match
  existing conventions
- Read `app.ts` and `passport.ts` to understand current state of the
  `REPLIT_DOMAINS` → `APP_URL` migration, since this durability work will
  touch the same files/deploy surface
- Propose the migration file and updated storage service as a diff against
  the actual codebase, not from scratch
