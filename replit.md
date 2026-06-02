# Chroma

A premium, cinematic professional filmmaker platform for video hosting, networking, crew discovery, and project collaboration.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/chroma run dev` — run the frontend (Vite, proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, shadcn/ui, Wouter (routing), TanStack Query
- Auth: Clerk (`@clerk/react` + `@clerk/express`)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml`)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/chroma/src/` — React frontend
  - `pages/` — all page components (home, feed, explore, crew, profile, videos, projects, messages)
  - `components/` — shared UI components (layout, navbar, shadcn/ui)
  - `lib/queryClient.ts` — TanStack Query client singleton
  - `index.css` — cinematic dark theme, Tailwind layers, Clerk integration
- `artifacts/api-server/src/` — Express backend
  - `routes/` — users, videos, follows, feed, messages, projects, stats, health
  - `lib/auth.ts` — Clerk auth helper
- `lib/api-spec/openapi.yaml` — source-of-truth OpenAPI spec
- `lib/api-client-react/` — generated TanStack Query hooks (do not hand-edit)
- `lib/db/src/schema/` — Drizzle ORM schemas (users, videos, follows, messages, projects)

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → typed hooks used in frontend and Zod schemas in backend
- Clerk handles all auth (JWT verification server-side via `@clerk/express`); users synced to DB on first profile load
- All routes registered in `artifacts/api-server/src/routes/index.ts`
- Frontend uses Wouter for routing (lightweight, no React Router peer dep conflicts with Clerk)
- Cinematic dark theme: background `#0B0B0B`, card `#181818`, accent `#6B5BFF`, font Inter

## Product

- **Home** — landing page with hero and feature overview
- **Feed** — personalized video feed from followed filmmakers
- **Explore** — browse and search all public videos with sorting
- **Crew** — discover and follow professional filmmakers by profession
- **Projects** — post and apply to crew opportunity listings
- **Profile** — filmmaker profiles with cover image, portfolio videos, and follow system
- **Messages** — direct messaging between filmmakers
- **Video Detail** — embed player, likes, comments

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Clerk dev key warning in browser console is expected; use production keys when deploying
- `pnpm run typecheck` is the canonical check; don't rely on editor/LSP alone
- After adding new routes, always import them in `artifacts/api-server/src/routes/index.ts`
- `lib/api-client-react/` is auto-generated — run codegen after any OpenAPI spec changes
- Tailwind must use `optimize: false` in `vite.config.ts` for Clerk prod builds

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `clerk-auth` skill for Clerk configuration and customization
