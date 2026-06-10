---
name: Object storage (Replit Object Storage) for Chroma images
description: How avatar/cover/thumbnail uploads work, the public-media decision, and the serving-URL convention
---

# Image uploads via Replit Object Storage

Chroma uses **Replit Object Storage** (not Cloudflare R2) for avatars, cover images, and video thumbnails. Chosen for zero external setup.

## Public-media decision
- All uploads in this app are **public by design** (profile photos, covers, thumbnails are all publicly visible on the platform).
- `GET /storage/objects/*` serves files with the ACL check intentionally disabled — treat this endpoint as a **public-media endpoint**, not private storage.
- **Why:** there is no flow in this app that writes truly-private data to the object dir; the only writer is the authenticated signed-URL endpoint, which only ever holds public images.
- **How to apply:** if you ever store genuinely private files, do NOT reuse this endpoint — add a separate auth+ACL-gated serve route.

## Upload flow + serving-URL convention
- Client calls `POST /api/storage/uploads/request-url` (requires auth) → gets a presigned PUT URL + `objectPath` (`/objects/uploads/<uuid>`), uploads file directly.
- Store the **serving URL** `/api/storage{objectPath}` in DB fields (`users.avatarUrl/coverUrl`, `videos.thumbnailUrl`) and use it directly in `<img src>`.
- **Why:** chroma is same-origin and the API is mounted under `/api`, so the absolute `/api/...` path resolves through the shared proxy.
- **Caveat:** this couples persisted URLs to the `/api/storage` gateway path; moving media to a CDN later would require a migration of stored URLs.

## Server-side upload policy
- Image endpoint (`request-url`): `contentType` starts with `image/`, `size <= 10 MB`. General-file endpoint (`request-file-url`, used for DM attachments): any type, `size <= 50 MB`. Both enforced server-side (client checks alone are bypassable).

## Arbitrary-file attachments → two non-obvious security requirements
- **Validate any client-supplied serving URL server-side before persisting/rendering.** DM attachment URLs come from the client and end up in `<a href>` / `<img src>`; a `javascript:` or external URL is a stored-XSS/phishing vector. Reject anything not matching `^/api/storage/objects/`.
- **The shared `/storage/objects/*` serve route must neutralize active content** once non-image uploads are allowed: set `X-Content-Type-Options: nosniff` and force `Content-Disposition: attachment` for scriptable types (text/html, application/xhtml+xml, image/svg+xml, application/javascript, text/javascript, application/xml). Cannot blanket-force download because the same route serves avatars/covers/thumbnails inline.
- **Why:** files are served same-origin under `/api`, so an executable upload (HTML/SVG-with-script) would run in the app origin. **How to apply:** any feature that lets users upload non-image files through this storage must keep both guards.

## Gotchas hit during setup
- The copied `objectStorage.ts` template needs a cast on `response.json()` (TS sees it as `unknown`) for the signed-url response.
- A new client lib under `lib/` must have `composite: true` + `declarationMap` + `emitDeclarationOnly` in its tsconfig and be added to root `tsconfig.json` references, or `tsc --build` fails with TS6306.
