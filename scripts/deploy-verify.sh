#!/bin/bash
# deploy-verify.sh — Verify a Vizora deployment is working correctly.
# Run after every deploy. Exit 0 = all good, exit 1 = issues found.
#
# Usage:
#   ./scripts/deploy-verify.sh                         # defaults to https://vizora.cloud
#   VIZORA_URL=http://localhost:3000 ./scripts/deploy-verify.sh  # local
#   ./scripts/deploy-verify.sh --local                 # shortcut for localhost

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

parse_readiness_status() {
  if ! command -v node >/dev/null 2>&1; then
    echo "node_missing"
    return 0
  fi

  if [[ ! -f "$SCRIPT_DIR/ops/readiness-status-parser.mjs" ]]; then
    echo "parser_missing"
    return 0
  fi

  node "$SCRIPT_DIR/ops/readiness-status-parser.mjs" 2>/dev/null || echo "invalid"
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
# INFO is neither pass nor problem: a fact worth printing that this script cannot
# assert. Counts toward nothing, so it never inflates or masks a verdict.
info()    { echo -e "  INFO  $1"; }
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
READY_BODY_FILE=$(mktemp)
STATUS=$(curl -s -o "$READY_BODY_FILE" -w '%{http_code}' --max-time 10 --connect-timeout 5 "$BASE_URL/api/v1/health/ready" 2>/dev/null || echo "000")
if [[ ! "$STATUS" =~ ^[0-9]{3}$ ]]; then STATUS="000"; fi
READY_STATUS=$(parse_readiness_status < "$READY_BODY_FILE")
rm -f "$READY_BODY_FILE"
if [[ "$STATUS" == "200" && "$READY_STATUS" == "ok" ]]; then
  pass "GET /api/v1/health/ready -> $STATUS status=ok"
elif [[ "$STATUS" == "200" && "$READY_STATUS" == "degraded" ]]; then
  fail "GET /api/v1/health/ready -> $STATUS status=degraded (expected status=ok)"
else
  fail "GET /api/v1/health/ready -> $STATUS status=$READY_STATUS (expected 200 status=ok)"
fi

check
STATUS=$(http_status "$BASE_URL/api/v1/health/live")
if [[ "$STATUS" == "200" ]]; then pass "GET /api/v1/health/live -> $STATUS"; else fail "GET /api/v1/health/live -> $STATUS (expected 200)"; fi

echo ""

# ---------------------------------------------------------------------------
# 2. Protected API routes (should be 401 without auth, NEVER 400/404/500)
# ---------------------------------------------------------------------------
echo "--- Protected API Routes (expect 401) ---"

# Every entry MUST be a route that actually exists. Vizora#333: "templates" and
# "devices" were asserted here for months and neither is a registered controller —
# so this section reported two permanent FAILs that were oracle defects, not outages.
# A gate that is always red is a gate nobody reads.
#
# The real device self-service surface is rooted at devices/me (see devices/me/content
# below), not a /devices collection.
PROTECTED_ROUTES=(
  "playlists"
  "content"
  "content/widgets"
  "content/layouts"
  "notifications"
  "support/requests"
  "schedules"
  "display-groups"
  "folders"
  # The device path the TV client actually calls. 401 anonymous proves the route is
  # registered AND its guard is live — the two things that broke for four releases.
  "devices/me/content"
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
# Vizora#333: these two were asserted as PUBLIC (expect 200) and are not. Both
# controllers are guarded — template-library by RolesGuard, billing by
# JwtAuthGuard+RolesGuard — so an anonymous 401 is the CORRECT contract, and the old
# expectation produced two permanent false FAILs.
#
# Asserting 401 is also the more useful assertion: a guarded route drifting to 200 is
# the security-relevant regression worth catching, and "expect 200" could never see it.
echo "--- Guarded API Routes (expect 401 anonymous) ---"

check
STATUS=$(http_status "$BASE_URL/api/v1/template-library")
if [[ "$STATUS" == "401" ]]; then pass "GET /api/v1/template-library -> 401 (guard live)"
elif [[ "$STATUS" == "200" ]]; then fail "GET /api/v1/template-library -> 200 (GUARD MISSING — RolesGuard not applied)"
else fail "GET /api/v1/template-library -> $STATUS (expected 401)"; fi

check
STATUS=$(http_status "$BASE_URL/api/v1/billing/plans")
if [[ "$STATUS" == "401" ]]; then pass "GET /api/v1/billing/plans -> 401 (guard live)"
elif [[ "$STATUS" == "200" ]]; then fail "GET /api/v1/billing/plans -> 200 (GUARD MISSING — JwtAuthGuard not applied)"
else fail "GET /api/v1/billing/plans -> $STATUS (expected 401)"; fi

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
elif echo "$TEMPLATE_BODY" | grep -q '"statusCode":401'; then
  # Expected: template-library is guarded (Vizora#333). The seed count cannot be read
  # anonymously, so this is a genuine capability gap, not a deployment problem. Said
  # explicitly rather than left as a permanent WARN that trains readers to ignore WARNs.
  info "Template count not checkable anonymously (route is guarded) — needs an authenticated probe"
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
