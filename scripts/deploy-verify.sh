#!/bin/bash
# deploy-verify.sh — Verify a Vizora deployment is working correctly.
# Run after every deploy. Exit 0 = all good, exit 1 = issues found.
#
# Usage:
#   ./scripts/deploy-verify.sh                         # defaults to https://vizora.cloud
#   VIZORA_URL=http://localhost:3000 ./scripts/deploy-verify.sh  # local
#   ./scripts/deploy-verify.sh --local                 # shortcut for localhost

set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

if [[ "${1:-}" == "--local" ]]; then
  BASE_URL="http://localhost:3000"
  WEB_URL="http://localhost:3001"
else
  BASE_URL="${VIZORA_URL:-https://vizora.cloud}"
  WEB_URL="${VIZORA_WEB_URL:-$BASE_URL}"
fi

ERRORS=0
WARNINGS=0
TOTAL=0

# Use a function to avoid quoting issues with curl options
http_status() {
  curl -s -o /dev/null -w '%{http_code}' --max-time 10 --connect-timeout 5 "$1" 2>/dev/null || echo "000"
}

# Colors (skip if not a terminal)
if [[ -t 1 ]]; then
  GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; NC='\033[0m'
else
  GREEN=''; YELLOW=''; RED=''; NC=''
fi

pass()    { echo -e "  ${GREEN}PASS${NC}  $1"; }
fail()    { echo -e "  ${RED}FAIL${NC}  $1"; ERRORS=$((ERRORS+1)); }
warn()    { echo -e "  ${YELLOW}WARN${NC}  $1"; WARNINGS=$((WARNINGS+1)); }
check()   { TOTAL=$((TOTAL+1)); }

echo "========================================="
echo "  VIZORA DEPLOYMENT VERIFICATION"
echo "  Server: $BASE_URL"
echo "  Time:   $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "========================================="
echo ""

# ---------------------------------------------------------------------------
# 1. Health endpoints
# ---------------------------------------------------------------------------
echo "--- Health Endpoints ---"

check
STATUS=$(http_status "$BASE_URL/api/v1/health")
if [[ "$STATUS" == "200" ]]; then pass "GET /api/v1/health -> $STATUS"; else fail "GET /api/v1/health -> $STATUS (expected 200)"; fi

check
STATUS=$(http_status "$BASE_URL/api/v1/health/ready")
if [[ "$STATUS" == "200" ]]; then pass "GET /api/v1/health/ready -> $STATUS"; else fail "GET /api/v1/health/ready -> $STATUS (expected 200)"; fi

check
STATUS=$(http_status "$BASE_URL/api/v1/health/live")
if [[ "$STATUS" == "200" ]]; then pass "GET /api/v1/health/live -> $STATUS"; else fail "GET /api/v1/health/live -> $STATUS (expected 200)"; fi

echo ""

# ---------------------------------------------------------------------------
# 2. Protected API routes (should be 401 without auth, NEVER 400/404/500)
# ---------------------------------------------------------------------------
echo "--- Protected API Routes (expect 401) ---"

PROTECTED_ROUTES=(
  "templates"
  "devices"
  "playlists"
  "content"
  "content/widgets"
  "content/layouts"
  "notifications"
  "support/requests"
  "schedules"
  "display-groups"
  "folders"
)

for ROUTE in "${PROTECTED_ROUTES[@]}"; do
  check
  STATUS=$(http_status "$BASE_URL/api/v1/$ROUTE")
  if [[ "$STATUS" == "401" ]]; then
    pass "GET /api/v1/$ROUTE -> 401"
  elif [[ "$STATUS" == "400" ]]; then
    fail "GET /api/v1/$ROUTE -> 400 (DTO/validation bug — route broken before auth)"
  elif [[ "$STATUS" == "404" ]]; then
    fail "GET /api/v1/$ROUTE -> 404 (route missing or not registered)"
  elif [[ "$STATUS" == "500" ]]; then
    fail "GET /api/v1/$ROUTE -> 500 (server error)"
  else
    warn "GET /api/v1/$ROUTE -> $STATUS (unexpected, expected 401)"
  fi
done

echo ""

# ---------------------------------------------------------------------------
# 3. Public API routes
# ---------------------------------------------------------------------------
echo "--- Public API Routes ---"

check
STATUS=$(http_status "$BASE_URL/api/v1/template-library")
if [[ "$STATUS" == "200" ]]; then pass "GET /api/v1/template-library -> $STATUS"; else fail "GET /api/v1/template-library -> $STATUS (expected 200)"; fi

check
STATUS=$(http_status "$BASE_URL/api/v1/billing/plans")
if [[ "$STATUS" == "200" ]]; then pass "GET /api/v1/billing/plans -> $STATUS"; else fail "GET /api/v1/billing/plans -> $STATUS (expected 200)"; fi

echo ""

# ---------------------------------------------------------------------------
# 4. Template library populated
# ---------------------------------------------------------------------------
echo "--- Template Library ---"

check
TEMPLATE_BODY=$(curl -s --max-time 10 "$BASE_URL/api/v1/template-library" 2>/dev/null || echo "{}")
if echo "$TEMPLATE_BODY" | grep -q '"total"'; then
  TEMPLATE_COUNT=$(echo "$TEMPLATE_BODY" | grep -o '"total":[0-9]*' | grep -o '[0-9]*' || echo "0")
  if [[ "$TEMPLATE_COUNT" -gt 50 ]]; then
    pass "Templates seeded: $TEMPLATE_COUNT templates"
  elif [[ "$TEMPLATE_COUNT" -gt 0 ]]; then
    warn "Templates seeded: only $TEMPLATE_COUNT (expected 75+)"
  else
    fail "Templates seeded: 0 (run seed script)"
  fi
else
  warn "Could not verify template count from response"
fi

echo ""

# ---------------------------------------------------------------------------
# 5. Public web pages (if web URL is accessible)
# ---------------------------------------------------------------------------
echo "--- Web Pages ---"

WEB_PAGES=("" "login" "register" "pricing")

for PAGE in "${WEB_PAGES[@]}"; do
  check
  DISPLAY_PATH="/${PAGE}"
  [[ -z "$PAGE" ]] && DISPLAY_PATH="/"
  STATUS=$(http_status "$WEB_URL/$PAGE")
  if [[ "$STATUS" == "200" ]]; then
    pass "GET $DISPLAY_PATH -> $STATUS"
  elif [[ "$STATUS" == "000" ]]; then
    warn "GET $DISPLAY_PATH -> connection failed (web server may not be at $WEB_URL)"
  else
    warn "GET $DISPLAY_PATH -> $STATUS (expected 200)"
  fi
done

echo ""

# ---------------------------------------------------------------------------
# 6. WebSocket endpoint (Socket.IO polling transport)
# ---------------------------------------------------------------------------
echo "--- WebSocket ---"

check
WS_URL="${VIZORA_WS_URL:-${BASE_URL/3000/3002}}"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 --connect-timeout 3 "$WS_URL/socket.io/?transport=polling&EIO=4" 2>/dev/null || echo "000")
if [[ "$STATUS" == "200" ]]; then
  pass "WebSocket (polling) -> $STATUS"
elif [[ "$STATUS" == "000" ]]; then
  warn "WebSocket endpoint unreachable at $WS_URL"
else
  warn "WebSocket (polling) -> $STATUS"
fi

echo ""

# ---------------------------------------------------------------------------
# 7. SSL certificate (only for HTTPS URLs)
# ---------------------------------------------------------------------------
echo "--- SSL Certificate ---"

if [[ "$BASE_URL" == https://* ]]; then
  check
  HOSTNAME=$(echo "$BASE_URL" | sed 's|https://||' | sed 's|/.*||' | sed 's|:.*||')
  EXPIRY_DATE=$(echo | openssl s_client -servername "$HOSTNAME" -connect "$HOSTNAME:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2 || echo "")
  if [[ -n "$EXPIRY_DATE" ]]; then
    # Calculate days until expiry
    EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y %Z" "$EXPIRY_DATE" +%s 2>/dev/null || echo "0")
    NOW_EPOCH=$(date +%s)
    if [[ "$EXPIRY_EPOCH" -gt 0 ]]; then
      DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
      if [[ "$DAYS_LEFT" -lt 7 ]]; then
        fail "SSL expires in $DAYS_LEFT days ($EXPIRY_DATE) — RENEW NOW"
      elif [[ "$DAYS_LEFT" -lt 30 ]]; then
        warn "SSL expires in $DAYS_LEFT days ($EXPIRY_DATE)"
      else
        pass "SSL certificate valid ($DAYS_LEFT days remaining)"
      fi
    else
      warn "Could not parse SSL expiry date: $EXPIRY_DATE"
    fi
  else
    warn "Could not check SSL certificate"
  fi
else
  echo "  SKIP  SSL check (not using HTTPS)"
fi

echo ""

# ---------------------------------------------------------------------------
# 8. API response time check
# ---------------------------------------------------------------------------
echo "--- Response Times ---"

check
TIME_MS=$(curl -s -o /dev/null -w "%{time_total}" --max-time 10 "$BASE_URL/api/v1/health" 2>/dev/null || echo "0")
TIME_MS_INT=$(echo "$TIME_MS * 1000" | bc 2>/dev/null | cut -d. -f1 || echo "0")
if [[ "$TIME_MS_INT" -lt 500 ]]; then
  pass "Health endpoint: ${TIME_MS_INT}ms"
elif [[ "$TIME_MS_INT" -lt 2000 ]]; then
  warn "Health endpoint: ${TIME_MS_INT}ms (slow)"
else
  fail "Health endpoint: ${TIME_MS_INT}ms (>2s — critical latency)"
fi

check
TIME_MS=$(curl -s -o /dev/null -w "%{time_total}" --max-time 10 "$BASE_URL/api/v1/template-library" 2>/dev/null || echo "0")
TIME_MS_INT=$(echo "$TIME_MS * 1000" | bc 2>/dev/null | cut -d. -f1 || echo "0")
if [[ "$TIME_MS_INT" -lt 1000 ]]; then
  pass "Template library: ${TIME_MS_INT}ms"
elif [[ "$TIME_MS_INT" -lt 3000 ]]; then
  warn "Template library: ${TIME_MS_INT}ms (slow)"
else
  fail "Template library: ${TIME_MS_INT}ms (>3s — critical latency)"
fi

echo ""

# ---------------------------------------------------------------------------
# 9. Git status (if on server with git repo)
# ---------------------------------------------------------------------------
echo "--- Git Status ---"

if [[ -d .git ]]; then
  check
  DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$DIRTY" == "0" ]]; then
    pass "Working directory clean"
  else
    warn "$DIRTY uncommitted files on server"
  fi

  BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
  COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
  echo "  INFO  Branch: $BRANCH, Commit: $COMMIT"
else
  echo "  SKIP  Not a git repo"
fi

echo ""

# ---------------------------------------------------------------------------
# 10. Recent error logs (if PM2 available)
# ---------------------------------------------------------------------------
echo "--- Recent Errors ---"

if command -v pm2 &> /dev/null; then
  check
  ERROR_COUNT=$(pm2 logs --nostream --lines 100 2>/dev/null | grep -c "ERROR\|CRITICAL\|FATAL" 2>/dev/null || echo "0")
  if [[ "$ERROR_COUNT" == "0" ]]; then
    pass "No errors in last 100 PM2 log lines"
  else
    warn "$ERROR_COUNT error(s) in last 100 PM2 log lines"
  fi
else
  echo "  SKIP  PM2 not available"
fi

echo ""

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo "========================================="
echo "  RESULTS: $TOTAL checks"
echo "    Passed:   $((TOTAL - ERRORS - WARNINGS))"
echo "    Warnings: $WARNINGS"
echo "    Failed:   $ERRORS"
echo "========================================="

if [[ "$ERRORS" -eq 0 ]]; then
  echo -e "  ${GREEN}DEPLOYMENT VERIFIED — ALL CHECKS PASSED${NC}"
  [[ "$WARNINGS" -gt 0 ]] && echo "  ($WARNINGS warning(s) — review above)"
  exit 0
else
  echo -e "  ${RED}DEPLOYMENT HAS ISSUES — $ERRORS CHECK(S) FAILED${NC}"
  exit 1
fi
