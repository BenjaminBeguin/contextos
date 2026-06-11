#!/usr/bin/env bash
# End-to-end verification of the Cortex foundation slice.
set -euo pipefail
cd "$(dirname "$0")/.."

API_URL="http://localhost:3008"
TOKEN="ctxos_dev_fixed_token_for_local_testing"

echo "==> 1. Docker services"
docker compose up -d
echo "Waiting for Postgres…"
until docker exec contextos-postgres pg_isready -U contextos >/dev/null 2>&1; do sleep 1; done
echo "Postgres ready."

echo "==> 2. Install + generate + migrate + seed"
pnpm install
pnpm db:generate
pnpm prisma migrate deploy 2>/dev/null || pnpm prisma migrate dev --name init
SEED_OUT="$(pnpm db:seed)"
echo "$SEED_OUT"
ACME_REPO="$(echo "$SEED_OUT" | grep 'Acme repo:' | awk '{print $3}')"
GLOBEX_REPO="$(echo "$SEED_OUT" | grep 'Globex repo:' | awk '{print $3}')"
echo "Acme repo:   $ACME_REPO"
echo "Globex repo: $GLOBEX_REPO"

echo "==> 3. Build CLI"
pnpm --filter @cortex/shared build || true
pnpm --filter @cortex/cli build

echo "==> 4. Start API"
( pnpm --filter @cortex/api dev >/tmp/cortex-api.log 2>&1 & echo $! > /tmp/cortex-api.pid )
echo "Waiting for API…"
until curl -sf "$API_URL/health" >/dev/null 2>&1; do sleep 1; done
echo "API healthy."

echo "==> 5. API: search_memory (approved only) for Acme"
curl -s -X POST "$API_URL/mcp/search_memory" \
  -H "authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d "{\"repoId\":\"$ACME_REPO\",\"query\":\"billing\"}" | tee /tmp/acme.json
echo

echo "==> 6. Isolation: Acme token must NOT access Globex repo (expect 403)"
CODE="$(curl -s -o /tmp/globex.json -w '%{http_code}' -X POST "$API_URL/mcp/search_memory" \
  -H "authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d "{\"repoId\":\"$GLOBEX_REPO\",\"query\":\"secret\"}")"
echo "HTTP $CODE"; cat /tmp/globex.json; echo
if [ "$CODE" != "403" ]; then echo "FAIL: expected 403 for cross-org access"; exit 1; fi
echo "PASS: cross-org access denied."

echo "==> 7. MCP stdio smoke (writes local .cortex config first)"
mkdir -p "$HOME/.cortex"
echo "{\"apiBaseUrl\":\"$API_URL\",\"token\":\"$TOKEN\"}" > "$HOME/.cortex/credentials.json"
mkdir -p .cortex
echo "{\"apiBaseUrl\":\"$API_URL\",\"repoId\":\"$ACME_REPO\",\"repoFullName\":\"acme/billing-api\"}" > .cortex/config.json
node scripts/mcp-smoke.mjs

echo "==> Stopping API"
kill "$(cat /tmp/cortex-api.pid)" 2>/dev/null || true

echo "ALL CHECKS PASSED"
