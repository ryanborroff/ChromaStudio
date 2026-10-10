# Stage B: Media Warehouse

## Objective

Create one private, owner-scoped catalogue of source media that can be reused by Production (review and delivery) and Distribution (publishing and embeds) without duplicating the original file.

## Architectural boundaries

- **Media asset:** durable identity for one uploaded source object, owner, original filename, content type, byte size, checksum, verification status, and lifecycle.
- **Video:** an existing presentation/review/publishing record. Do not replace `videos` or `review_group_id` in this stage.
- **Asset attachment:** explicit reference from a video to a media asset. Multiple video versions or publication contexts can reference one source asset.
- **Object storage:** bytes remain in the existing provider. Store keys, not publicly accessible URLs. Never trust an object key supplied by another user.
- **Ownership:** owner user ID on assets; every read and mutation must be scoped to the authenticated owner. Sharing and collaborators require explicit access grants, not inference from a public URL.

## Incremental implementation plan

1. Add a new `media_assets` table with owner, storage key, original metadata, checksum, upload state, timestamps and indexes. Keep existing `videos` untouched.
2. Add nullable `videos.media_asset_id` as a foreign key. No destructive migration or forced backfill.
3. Implement authenticated asset create/list/detail/attach endpoints, checking storage ACL ownership and uploaded-object existence before accepting an asset. Reject cross-user IDs and keys.
4. Wire the existing upload-complete path to asset creation, using idempotency to prevent duplicate records on retry.
5. Update review/delivery/publishing reads to prefer linked asset where present and preserve the legacy `storage_key` path as a compatibility fallback.
6. Add unit/integration tests: cross-account access, missing objects, retries, duplicate attachment, legacy video compatibility, and deleted-asset behaviour.
7. Add a read-only migration inventory and reconciliation report. No bulk deletion or automatic backfill until the data is inspected.
8. Implement a single Media Warehouse UI for browsing, filtering and attaching assets; reuse existing upload, review and distribution screens.

## Non-negotiable invariants

- No upload should be silently made public.
- A user cannot attach another user's asset.
- Deleting a video must not delete an original still referenced elsewhere.
- Storage usage must count each original object once, not each linked video.
- Preserve the existing review comments, versions, approvals, deliveries, sharing, embeds and streaming integrations.
- Schema migrations must be additive, reversible where feasible, and tested against a copy of the schema.
- Deployment to the existing Railway prototype was explicitly authorized on 10 October 2026. Preserve all existing application data and use additive migrations.

## Acceptance criteria

- Upload once, reuse the same asset in a review and a distribution context.
- Both workflows can retrieve the original through an authorised, short-lived URL.
- A second user cannot list, read, attach, delete or download that asset.
- Existing videos without `media_asset_id` continue to work.
- Removing a presentation does not remove the original media asset.
- Automated tests and security scanning pass before merging.

## Scope

This document establishes the Stage B architecture and implementation sequence. It does **not** claim the Media Warehouse is implemented. Stage A's pnpm trust-policy finding remains a tracked follow-up.

## Implementation checkpoint: B5

The attach endpoint now connects an existing verified original to an owned **private**
object-storage video, setting its storage key and internal playback URL. This is
not yet full review-to-release reuse: guest review pages and public distribution
must receive media through explicitly authorised access mechanisms, not through
the owner-only `/storage/objects/*` endpoint.

**Do not** change private originals to public ACLs to make review or embeds work.
Implement time-limited, review-token-scoped playback access and an explicit
publish/derivative flow first. The streaming-provider path must not be
overwritten by a warehouse attachment.

Open validation work:
- Test guest review playback, private owner playback, and public embed access separately.
- Verify owner-only original downloads and revoked ACL handling.
- Replace placeholder video MIME type / original filename with verified upload metadata.
- Ensure storage usage counts warehouse originals once and legacy uploads correctly.
- Check the video purge path for provider assets and shared originals.
- Add integration tests for cross-account attachment and retry behaviour.
- CI passed at commit 1adb134; Semgrep still failed on that commit. Check the
  latest commit's checks before review or merge.

## 10 October 2026 checkpoint

Stage B remains incomplete. Browser large-file hashing and queue submission now exist. See [checkpoint evidence](stage-b-checkpoint-2026-10-10.md) for local validation, database-copy rehearsal and outstanding live acceptance tests.
