# Production deployment

Chroma is split into a static Vite frontend and an Express API:

- **Cloudflare Pages** serves `artifacts/chroma/dist/public`.
- **Railway** runs `@workspace/api-server` with Railway Postgres.
- **Cloudflare R2** stores uploaded objects.
- **Mux** stores and streams video assets.

## Cloudflare Pages

Create a Pages project from the repository with:

```text
Build command: pnpm install --frozen-lockfile && pnpm --filter @workspace/chroma run build
Output directory: artifacts/chroma/dist/public
Node version: 22.12+
```

Set:

```text
BASE_PATH=/
VITE_API_BASE_URL=https://<railway-api-domain>
```

The `public/_redirects` file keeps Wouter routes working on refresh.

## Railway API

Create a Railway service from the repository. The checked-in `railway.json`
builds and starts the API. Add a Railway PostgreSQL service and set:

```text
NODE_ENV=production
APP_URL=https://<cloudflare-pages-domain>
FRONTEND_URL=https://<cloudflare-pages-domain>
DATABASE_URL=${{Postgres.DATABASE_URL}}
SESSION_SECRET=<long-random-value>
SESSION_COOKIE_SAMESITE=none
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<r2-access-key>
R2_SECRET_ACCESS_KEY=<r2-secret>
R2_BUCKET_NAME=<r2-bucket>
MUX_TOKEN_ID=<mux-token-id>
MUX_TOKEN_SECRET=<mux-token-secret>
MUX_WEBHOOK_SECRET=<mux-webhook-secret>
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
APPLE_CLIENT_ID=<apple-client-id>
APPLE_TEAM_ID=<apple-team-id>
APPLE_KEY_ID=<apple-key-id>
APPLE_PRIVATE_KEY=<apple-private-key>
STRIPE_SECRET_KEY=<stripe-secret-key>
STRIPE_WEBHOOK_SECRET=<stripe-webhook-secret>
STRIPE_CREATOR_PRICE_ID=<stripe-price-id>
STRIPE_STUDIO_PRICE_ID=<stripe-price-id>
```

`PORT` must be supplied by Railway. Run the Drizzle schema push once against
the Railway database before accepting production traffic.

Update OAuth callback URLs to:

```text
https://<railway-api-domain>/api/auth/google/callback
https://<railway-api-domain>/api/auth/apple/callback
```

Configure Stripe's webhook URL as:

```text
https://<railway-api-domain>/api/webhooks/stripe
```

Do not commit `.env` files or real secret values.
