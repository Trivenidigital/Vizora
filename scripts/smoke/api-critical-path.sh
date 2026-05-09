#!/usr/bin/env bash
#
# api-critical-path.sh — operator-facing smoke test for the customer #1
# critical path. Probes the 12 REST endpoints that MUST work for a paying
# customer to onboard, plus health endpoints for all 3 services.
#
# Usage:
#   ./api-critical-path.sh                                  # default localhost
#   API_BASE=https://vizora.cloud ./api-critical-path.sh    # against prod
#
# Exit codes:
#   0 = all critical-path endpoints returned expected status
#   1 = one or more endpoints failed (operator must investigate)
#
# Designed to be re-runnable. Generates a unique test user per run; does
# not pollute the org pool because the test org is named with a timestamp
# and can be filtered out via `WHERE name LIKE 'smoke-test-%'`.
#
# History:
#   2026-05-09 — formalized from production-readiness sub-agent's manual probes
#                Substitute for the bit-rotted Playwright suite until refresh
#                lands; safe to run against prod (creates real user/org but
#                in disposable namespace).

set -uo pipefail

API_BASE="${API_BASE:-http://localhost:3000}"
WEB_BASE="${WEB_BASE:-http://localhost:3001}"
RT_BASE="${RT_BASE:-http://localhost:3002}"
RESULTS=()
FAILED=0

probe_status() {
  local name="$1" expected="$2" url="$3"
  local actual
  actual="$(curl -s -o /dev/null -w '%{http_code}' "$url" 2>/dev/null)"
  if [[ "$actual" == "$expected" ]]; then
    RESULTS+=("OK   $name -> $actual")
  else
    RESULTS+=("FAIL $name -> got '$actual'; expected '$expected'")
    FAILED=$((FAILED + 1))
  fi
}

probe_status_authed() {
  local name="$1" expected="$2" url="$3"
  local actual
  actual="$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIE_JAR" "$url" 2>/dev/null)"
  if [[ "$actual" == "$expected" ]]; then
    RESULTS+=("OK   $name -> $actual")
  else
    RESULTS+=("FAIL $name -> got '$actual'; expected '$expected'")
    FAILED=$((FAILED + 1))
  fi
}

echo "Vizora API Critical-Path Smoke Test"
echo "  API:      $API_BASE"
echo "  Web:      $WEB_BASE"
echo "  Realtime: $RT_BASE"
echo "  Started:  $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo

TIMESTAMP=$(date +%s)
EMAIL="smoke-test-${TIMESTAMP}@vizora.test"
PASSWORD='SmokeTest123!@#'
ORG_NAME="smoke-test-${TIMESTAMP}"
COOKIE_JAR="/tmp/smoke-cookie-$TIMESTAMP.txt"
trap "rm -f $COOKIE_JAR" EXIT

# ---------- Health ----------
probe_status "[1/12] Middleware health" "200" "$API_BASE/api/v1/health"
probe_status "[2/12] Web home" "200" "$WEB_BASE"
probe_status "[3/12] Realtime health" "200" "$RT_BASE/api/health"

# ---------- Auth ----------
echo
echo "Registering smoke-test user: $EMAIL"
REGISTER_BODY=$(EMAIL="$EMAIL" PASSWORD="$PASSWORD" ORG_NAME="$ORG_NAME" python3 -c '
import json, os
print(json.dumps({
  "email": os.environ["EMAIL"],
  "password": os.environ["PASSWORD"],
  "firstName": "Smoke",
  "lastName": "Tester",
  "organizationName": os.environ["ORG_NAME"],
}))
')

REGISTER_STATUS=$(curl -s -o /tmp/smoke-register-$TIMESTAMP.json -w '%{http_code}' \
  -X POST -H "Content-Type: application/json" -d "$REGISTER_BODY" \
  "$API_BASE/api/v1/auth/register")

if [[ "$REGISTER_STATUS" == "201" ]]; then
  RESULTS+=("OK   [4/12] Register -> 201")
else
  RESULTS+=("FAIL [4/12] Register -> got $REGISTER_STATUS; expected 201")
  echo "Register response body:"
  head -10 /tmp/smoke-register-$TIMESTAMP.json
  FAILED=$((FAILED + 1))
fi
rm -f /tmp/smoke-register-$TIMESTAMP.json

LOGIN_BODY=$(EMAIL="$EMAIL" PASSWORD="$PASSWORD" python3 -c '
import json, os
print(json.dumps({"email": os.environ["EMAIL"], "password": os.environ["PASSWORD"]}))
')

LOGIN_STATUS=$(curl -s -o /dev/null -w '%{http_code}' -c "$COOKIE_JAR" \
  -X POST -H "Content-Type: application/json" -d "$LOGIN_BODY" \
  "$API_BASE/api/v1/auth/login")

if [[ "$LOGIN_STATUS" == "201" ]]; then
  RESULTS+=("OK   [5/12] Login -> 201 (cookie captured)")
else
  RESULTS+=("FAIL [5/12] Login -> got $LOGIN_STATUS; expected 201")
  FAILED=$((FAILED + 1))
fi

probe_status_authed "[6/12] /auth/me with cookie" "200" "$API_BASE/api/v1/auth/me"

# ---------- Pairing ----------
echo
DEVICE_ID="smoke-device-$TIMESTAMP"
PAIRING_BODY=$(DEVICE_ID="$DEVICE_ID" python3 -c '
import json, os
print(json.dumps({"deviceIdentifier": os.environ["DEVICE_ID"]}))
')

PAIRING_STATUS=$(curl -s -o /tmp/smoke-pairing-$TIMESTAMP.json -w '%{http_code}' \
  -X POST -b "$COOKIE_JAR" -H "Content-Type: application/json" -d "$PAIRING_BODY" \
  "$API_BASE/api/v1/devices/pairing/request")

if [[ "$PAIRING_STATUS" == "201" ]]; then
  CODE=$(python3 -c '
import json, sys
try:
  d = json.load(open(sys.argv[1]))
  data = d.get("data") if isinstance(d, dict) else None
  print((data or d).get("code", ""))
except Exception:
  print("")
' /tmp/smoke-pairing-$TIMESTAMP.json)
  if [[ -n "$CODE" && ${#CODE} -ge 4 ]]; then
    RESULTS+=("OK   [7/12] Pairing request -> 201 + code: $CODE")
  else
    RESULTS+=("WARN [7/12] Pairing 201 but no parseable code")
    FAILED=$((FAILED + 1))
  fi
else
  RESULTS+=("FAIL [7/12] Pairing request -> got $PAIRING_STATUS; expected 201")
  FAILED=$((FAILED + 1))
fi
rm -f /tmp/smoke-pairing-$TIMESTAMP.json

# ---------- List endpoints (read-only) ----------
echo
probe_status_authed "[8/12] List displays" "200" "$API_BASE/api/v1/displays"
probe_status_authed "[9/12] List content" "200" "$API_BASE/api/v1/content"
probe_status_authed "[10/12] List playlists" "200" "$API_BASE/api/v1/playlists"
probe_status_authed "[11/12] List schedules" "200" "$API_BASE/api/v1/schedules"
probe_status_authed "[12/12] List notifications" "200" "$API_BASE/api/v1/notifications"

# ---------- Report ----------
echo
echo "----------------------------------------------------"
for r in "${RESULTS[@]}"; do echo "  $r"; done
echo "----------------------------------------------------"
echo "  Test user: $EMAIL"
echo "  Test org:  $ORG_NAME"
echo "  Finished:  $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo

if [[ $FAILED -eq 0 ]]; then
  echo "ALL 12 CRITICAL-PATH ENDPOINTS PASSED"
  exit 0
else
  echo "$FAILED CHECK(S) FAILED -- investigate before promoting deploy"
  exit 1
fi
