---
name: Video serializer sensitive-field policy
description: How sensitive Video fields must be stripped across ALL video serializers, not just the canonical one
---

# Video response serialization — sensitive fields

`buildVideoResponse` in `routes/videos.ts` is the canonical sanitizer, but it is NOT the only place raw `videosTable` rows are turned into API responses. These routes serialize videos independently by spreading `...v`:
- `routes/feed.ts`
- `routes/stats.ts` (featured content)
- `routes/users.ts` (profile by username)
- `routes/collections.ts` (collection detail)

**Rule:** any sensitive column added to `videosTable` (e.g. `sharePasswordHash`, `shareToken`) must be stripped/overridden in EVERY one of these serializers in lockstep — not just `buildVideoResponse`.

**Why:** `shareToken` was added to the `Video` OpenAPI schema as an owner-only field. Because the other serializers spread the raw row and Zod passes through known schema keys, the token leaked to the public via feed/stats/profile responses (broken access control). `sharePasswordHash` is not in the schema so Zod strips it, but relying on that is fragile.

**How to apply:** for non-owner contexts set `shareToken: null` and derive `hasSharePassword: !!sharePasswordHash`, and destructure both raw fields out of the spread. Owner-only contexts (the user's own collection detail) may expose `shareToken`.

## Rating denormalization

Ratings are stored per-user in `video_ratings` (unique `user_id`+`video_id`) and denormalized onto `videos.rating_sum` / `videos.rating_count`. The API never exposes `ratingSum` — every serializer must strip it and instead expose `ratingAvg = ratingCount > 0 ? ratingSum/ratingCount : 0`.

- `userRating` (the current viewer's own rating) is only resolvable when a current user id is passed. Public list/feed/collection/stats serializers set `userRating: null` (mirrors the existing `isLiked: false` pattern there). Only `buildVideoResponse` resolves it — so any route that should show the viewer's own rating (e.g. `GET /videos/:id`) must pass the current user id into `buildVideoResponse`.
- The rate write path must run in a DB transaction (update join-table row + adjust `rating_sum`/`rating_count` deltas together) to keep the denormalized counters consistent.

**Why:** the denormalized sum/count drift if updated non-atomically, and a leaked `ratingSum` lets clients reverse-engineer individual votes.
