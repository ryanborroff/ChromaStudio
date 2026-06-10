---
name: Gated file downloads for shared/public resources
description: How to privately serve files behind an optional password without exposing object storage paths.
---

When a public token-shared resource (e.g. Client Delivery `/deliver/:token`) must let a recipient download files, but downloads should be gated by an optional password:

- Store the storage `objectPath` (`/objects/...`) server-side only; never return it in any public payload. Public payloads expose file metadata (id, name, size, contentType) only.
- Unlock endpoint verifies the bcrypt password, then issues a **stateless signed key**: `${expiry}.${HMAC-SHA256(SESSION_SECRET, token + "." + expiry)}` with a TTL (24h used). Verify with `timingSafeEqual` and reject expired keys. The key is bound to the share token, so it can't be replayed across deliveries.
- Download endpoint streams via `objectStorageService.getObjectEntityFile(objectPath)` + `downloadObject`, forcing `Content-Disposition: attachment` (with RFC5987 `filename*`) and `X-Content-Type-Options: nosniff`. For password-protected resources it requires a valid `?k=` key; no-password resources serve directly.

**Why:** mirrors the existing video-share pattern (return media only after unlock) but is safer for files — a public `/api/storage/objects/*` URL has no ACL, so handing it out would bypass the password. The HMAC gate keeps the password meaningful without needing server-side session state for anonymous visitors.

**Tradeoff:** stateless keys are not revocable before TTL if the password changes after an unlock. To make them revocable, add a per-row nonce/version to the signed payload and rotate it on password change.

**How to apply:** reuse for any future token-shared, optionally-password-protected file delivery. `SESSION_SECRET` is guaranteed set (app.ts throws if missing), so it's safe to use as the HMAC secret.
