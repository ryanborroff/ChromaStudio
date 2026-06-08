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
- The signed-URL endpoint enforces `contentType` starts with `image/` and `size <= 10 MB` server-side (client checks alone are bypassable).

## Gotchas hit during setup
- The copied `objectStorage.ts` template needs a cast on `response.json()` (TS sees it as `unknown`) for the signed-url response.
- A new client lib under `lib/` must have `composite: true` + `declarationMap` + `emitDeclarationOnly` in its tsconfig and be added to root `tsconfig.json` references, or `tsc --build` fails with TS6306.
