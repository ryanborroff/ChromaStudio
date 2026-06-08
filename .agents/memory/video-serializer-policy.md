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
