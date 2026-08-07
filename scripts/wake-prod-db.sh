#!/bin/bash
# scripts/wake-prod-db.sh
#
# Forces the production Neon database endpoint out of a disabled/suspended
# state via the Neon REST API, then waits for it to become active.
#
# Usage:
#   NEON_API_KEY=<key> bash scripts/wake-prod-db.sh
#
# How to get your API key:
#   console.neon.tech → Account Settings → API Keys → Create key
#
# Then add it to Replit Secrets as NEON_API_KEY and run:
#   bash scripts/wake-prod-db.sh

set -e

NEON_API_KEY="${NEON_API_KEY:?Missing NEON_API_KEY — add it via Replit Secrets (console.neon.tech → Account Settings → API Keys)}"

BASE="https://console.neon.tech/api/v2"
AUTH="Authorization: Bearer $NEON_API_KEY"

echo "→ Fetching Neon projects..."
PROJECTS=$(curl -sf -H "$AUTH" "$BASE/projects" | grep -o '"id":"[^"]*"' | grep -o '[^"]*"$' | tr -d '"')

if [ -z "$PROJECTS" ]; then
  echo "✗ No projects found. Check your API key."
  exit 1
fi

WOKE=0

for PROJECT_ID in $PROJECTS; do
  echo "  Project: $PROJECT_ID"
  ENDPOINTS_JSON=$(curl -sf -H "$AUTH" "$BASE/projects/$PROJECT_ID/endpoints")
  ENDPOINT_IDS=$(echo "$ENDPOINTS_JSON" | grep -o '"id":"ep-[^"]*"' | grep -o 'ep-[^"]*')

  for ENDPOINT_ID in $ENDPOINT_IDS; do
    STATE=$(echo "$ENDPOINTS_JSON" | grep -A5 "\"id\":\"$ENDPOINT_ID\"" | grep '"current_state"' | grep -o '"[^"]*"$' | tr -d '"')
    DISABLED=$(echo "$ENDPOINTS_JSON" | grep -A10 "\"id\":\"$ENDPOINT_ID\"" | grep '"disabled"' | grep -o 'true\|false' | head -1)

    echo "    Endpoint $ENDPOINT_ID — state: $STATE, disabled: $DISABLED"

    # Un-disable if flagged disabled
    if [ "$DISABLED" = "true" ]; then
      echo "    ↳ Enabling (was explicitly disabled)..."
      curl -sf -X PATCH \
        -H "$AUTH" \
        -H "Content-Type: application/json" \
        -d '{"endpoint":{"disabled":false}}' \
        "$BASE/projects/$PROJECT_ID/endpoints/$ENDPOINT_ID" > /dev/null
      echo "    ✓ Endpoint enabled."
      WOKE=$((WOKE + 1))
    fi

    # Start if idle/suspended
    if [ "$STATE" = "idle" ] || [ "$STATE" = "stopped" ] || [ "$STATE" = "suspended" ]; then
      echo "    ↳ Starting endpoint..."
      curl -sf -X POST \
        -H "$AUTH" \
        "$BASE/projects/$PROJECT_ID/endpoints/$ENDPOINT_ID/start" > /dev/null
      echo "    ✓ Start request sent."
      WOKE=$((WOKE + 1))
    fi
  done
done

if [ "$WOKE" -gt 0 ]; then
  echo ""
  echo "Waiting 8 seconds for endpoints to become active..."
  sleep 8
  echo "✓ Done. Retry publishing now."
else
  echo ""
  echo "✓ All endpoints already active — no action needed."
  echo "  If the publish still fails, the production DB may be in a"
  echo "  Replit-managed Neon account. Contact Replit support."
fi
