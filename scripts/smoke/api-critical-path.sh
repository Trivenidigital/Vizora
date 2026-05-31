#!/usr/bin/env bash
#
# api-critical-path.sh - operator-facing smoke test for the customer-1
# critical path. It proves the minimum onboarding path:
# health -> register -> login -> pair display -> create content ->
# upload content -> stream uploaded content -> create playlist ->
# schedule playlist -> device reads active schedule.
#
# Usage:
#   bash scripts/smoke/api-critical-path.sh
#   API_BASE=https://vizora.cloud WEB_BASE=https://vizora.cloud \
#     bash scripts/smoke/api-critical-path.sh
#
# Designed to be re-runnable. It creates a unique smoke-test user,
# organization, display, content item, playlist, and schedule per run.
# These rows are intentionally timestamped with "smoke-test-" so operators
# can filter or clean them up later.

set -uo pipefail

API_BASE="${API_BASE:-http://localhost:3000}"
WEB_BASE="${WEB_BASE:-http://localhost:3001}"
RT_BASE="${RT_BASE:-http://localhost:3002}"
CURL_CONNECT_TIMEOUT="${CURL_CONNECT_TIMEOUT:-5}"
CURL_MAX_TIME="${CURL_MAX_TIME:-20}"
SMOKE_CLEANUP_UPLOAD="${SMOKE_CLEANUP_UPLOAD:-true}"
umask 077

RESULTS=()
FAILED=0
CHECK_NUM=0
TIMESTAMP=$(date +%s)
RUN_SUFFIX="${TIMESTAMP}-${RANDOM}-$$"
EMAIL="smoke-test-${RUN_SUFFIX}@vizora.test"
PASSWORD='SmokeTest123!@#'
ORG_NAME="smoke-test-${RUN_SUFFIX}"
DEVICE_ID="smoke-device-${RUN_SUFFIX}"
TMP_PARENT="${TMPDIR:-/tmp}"
TMP_DIR="$(mktemp -d "${TMP_PARENT%/}/vizora-smoke-${TIMESTAMP}.XXXXXX")"
if [[ -z "$TMP_DIR" || ! -d "$TMP_DIR" ]]; then
  echo "Failed to create private temp directory under $TMP_PARENT" >&2
  exit 1
fi
COOKIE_JAR="$TMP_DIR/cookie.txt"
TMP_FILES=()
CSRF_TOKEN=""
CHECK_LABEL=""
UPLOAD_CONTENT_ID=""
UPLOAD_CONTENT_DELETED=0
CLEANED_UP=0

tmp_json() {
  local name="$1"
  local path="$TMP_DIR/${name}.json"
  TMP_FILES+=("$path")
  printf '%s' "$path"
}

tmp_headers() {
  local name="$1"
  local path="$TMP_DIR/${name}.headers"
  TMP_FILES+=("$path")
  printf '%s' "$path"
}

tmp_file() {
  local name="$1"
  local path="$TMP_DIR/$name"
  TMP_FILES+=("$path")
  printf '%s' "$path"
}

cleanup() {
  if [[ "${CLEANED_UP:-0}" == "1" ]]; then
    return
  fi
  CLEANED_UP=1

  if [[
    "${SMOKE_CLEANUP_UPLOAD:-true}" != "false" &&
    "${SMOKE_CLEANUP_UPLOAD:-true}" != "0" &&
    -n "${UPLOAD_CONTENT_ID:-}" &&
    "${UPLOAD_CONTENT_DELETED:-0}" != "1" &&
    -n "${COOKIE_JAR:-}" &&
    -f "${COOKIE_JAR:-}"
  ]]; then
    local cleanup_headers=(-b "$COOKIE_JAR")
    if [[ -n "${CSRF_TOKEN:-}" ]]; then
      cleanup_headers+=(-H "X-CSRF-Token: $CSRF_TOKEN")
    fi
    curl "${curl_common[@]}" -X DELETE "${cleanup_headers[@]}" \
      "$API_BASE/api/v1/content/$UPLOAD_CONTENT_ID" >/dev/null 2>&1 || true
  fi

  if [[ -n "${TMP_DIR:-}" && -d "$TMP_DIR" && "$TMP_DIR" == *vizora-smoke-* ]]; then
    rm -rf "$TMP_DIR" 2>/dev/null || true
  fi
}
trap cleanup EXIT
trap 'cleanup; exit 130' HUP INT TERM

make_label() {
  CHECK_NUM=$((CHECK_NUM + 1))
  CHECK_LABEL="$(printf '[%02d] %s' "$CHECK_NUM" "$1")"
}

record_ok() {
  local label="$1" detail="$2"
  RESULTS+=("OK   $label -> $detail")
}

record_fail() {
  local label="$1" detail="$2"
  RESULTS+=("FAIL $label -> $detail")
  FAILED=$((FAILED + 1))
}

print_response_preview() {
  local file="$1"
  if [[ -s "$file" ]]; then
    head -20 "$file" || true
  fi
}

json_get() {
  local file="$1" path="$2"
  python3 - "$file" "$path" <<'PY'
import json
import sys

file_path = sys.argv[1]
parts = [p for p in sys.argv[2].split(".") if p]

try:
    with open(file_path, "r", encoding="utf-8") as handle:
        cur = json.load(handle)
    for part in parts:
        if isinstance(cur, dict) and part in cur:
            cur = cur[part]
        elif isinstance(cur, list) and part.isdigit() and int(part) < len(cur):
            cur = cur[int(part)]
        else:
            print("")
            sys.exit(0)
    if cur is None:
        print("")
    elif isinstance(cur, (dict, list)):
        print(json.dumps(cur, separators=(",", ":")))
    else:
        print(cur)
except Exception:
    print("")
PY
}

json_body() {
  python3 - "$@" <<'PY'
import json
import os
import sys

payload = {}
for arg in sys.argv[1:]:
    key, raw = arg.split("=", 1)
    if raw == "__true__":
        payload[key] = True
    elif raw == "__false__":
        payload[key] = False
    elif raw.startswith("__json__:"):
        payload[key] = json.loads(raw[len("__json__:"):])
    elif raw.startswith("__env__:"):
        payload[key] = os.environ[raw[len("__env__:"):]]
    else:
        payload[key] = raw
print(json.dumps(payload))
PY
}

write_smoke_pdf() {
  local output_path="$1"
  python3 - "$output_path" <<'PY'
import sys

# Tiny PDF-like fixture. It exercises multipart upload and byte-range
# streaming without triggering image thumbnail generation.
pdf = b"%PDF-1.1\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"
with open(sys.argv[1], "wb") as handle:
    handle.write(pdf)
PY
}

auth_headers=()
curl_common=(-s --connect-timeout "$CURL_CONNECT_TIMEOUT" --max-time "$CURL_MAX_TIME")
refresh_auth_headers() {
  auth_headers=(-b "$COOKIE_JAR")
  if [[ -n "$CSRF_TOKEN" ]]; then
    auth_headers+=(-H "X-CSRF-Token: $CSRF_TOKEN")
  fi
}

probe_status() {
  local label
  make_label "$1"
  label="$CHECK_LABEL"
  local expected="$2" url="$3" actual
  actual="$(curl "${curl_common[@]}" -o /dev/null -w '%{http_code}' "$url" 2>/dev/null)"
  if [[ "$actual" == "$expected" ]]; then
    record_ok "$label" "$actual"
  else
    record_fail "$label" "got '$actual'; expected '$expected'"
  fi
}

probe_status_authed() {
  local label
  make_label "$1"
  label="$CHECK_LABEL"
  local expected="$2" url="$3" actual
  refresh_auth_headers
  actual="$(curl "${curl_common[@]}" -o /dev/null -w '%{http_code}' "${auth_headers[@]}" "$url" 2>/dev/null)"
  if [[ "$actual" == "$expected" ]]; then
    record_ok "$label" "$actual"
  else
    record_fail "$label" "got '$actual'; expected '$expected'"
  fi
}

post_json() {
  local label expected url body out actual
  make_label "$1"
  label="$CHECK_LABEL"
  expected="$2"
  url="$3"
  body="$4"
  out="$5"
  shift 5

  : > "$out"
  actual="$(curl "${curl_common[@]}" -o "$out" -w '%{http_code}' \
    -X POST -H "Content-Type: application/json" "$@" -d "$body" "$url" 2>/dev/null)"

  if [[ "$actual" == "$expected" ]]; then
    record_ok "$label" "$actual"
  else
    record_fail "$label" "got '$actual'; expected '$expected'"
    echo "$label response body:"
    print_response_preview "$out"
  fi
}

post_multipart_upload() {
  local label expected url file_path out actual
  make_label "$1"
  label="$CHECK_LABEL"
  expected="$2"
  url="$3"
  file_path="$4"
  out="$5"
  shift 5

  : > "$out"
  actual="$(curl "${curl_common[@]}" -o "$out" -w '%{http_code}' \
    -X POST "$@" \
    -F "file=@${file_path};type=application/pdf;filename=smoke-upload.pdf" \
    -F "name=Smoke Upload ${TIMESTAMP}" \
    -F "type=pdf" \
    "$url" 2>/dev/null)"

  if [[ "$actual" == "$expected" ]]; then
    record_ok "$label" "$actual"
  else
    record_fail "$label" "got '$actual'; expected '$expected'"
    echo "$label response body:"
    print_response_preview "$out"
  fi
}

echo "Vizora API Critical-Path Smoke Test"
echo "  API:      $API_BASE"
echo "  Web:      $WEB_BASE"
echo "  Realtime: $RT_BASE"
echo "  Timeout:  connect ${CURL_CONNECT_TIMEOUT}s, max ${CURL_MAX_TIME}s per request"
echo "  Started:  $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo

# ---------- Health ----------
probe_status "Middleware health" "200" "$API_BASE/api/v1/health"
probe_status "Web home" "200" "$WEB_BASE"
probe_status "Realtime health" "200" "$RT_BASE/api/health"

# ---------- Auth ----------
echo
echo "Registering smoke-test user: $EMAIL"
REGISTER_BODY=$(EMAIL="$EMAIL" PASSWORD="$PASSWORD" ORG_NAME="$ORG_NAME" \
  json_body email=__env__:EMAIL password=__env__:PASSWORD firstName=Smoke lastName=Tester organizationName=__env__:ORG_NAME)
REGISTER_OUT="$(tmp_json register)"
post_json "Register smoke user" "201" "$API_BASE/api/v1/auth/register" "$REGISTER_BODY" "$REGISTER_OUT"

LOGIN_BODY=$(EMAIL="$EMAIL" PASSWORD="$PASSWORD" \
  json_body email=__env__:EMAIL password=__env__:PASSWORD)
LOGIN_OUT="$(tmp_json login)"
LOGIN_HEADERS="$(tmp_headers login)"
make_label "Login smoke user"
login_label="$CHECK_LABEL"
: > "$LOGIN_OUT"
: > "$LOGIN_HEADERS"
LOGIN_STATUS="$(curl "${curl_common[@]}" -D "$LOGIN_HEADERS" -o "$LOGIN_OUT" -w '%{http_code}' -c "$COOKIE_JAR" \
  -X POST -H "Content-Type: application/json" -d "$LOGIN_BODY" \
  "$API_BASE/api/v1/auth/login" 2>/dev/null)"
if [[ "$LOGIN_STATUS" == "201" ]]; then
  record_ok "$login_label" "201 (cookie captured)"
else
  record_fail "$login_label" "got '$LOGIN_STATUS'; expected '201'"
  echo "$login_label response body:"
  print_response_preview "$LOGIN_OUT"
fi

CSRF_TOKEN="$(python3 - "$LOGIN_HEADERS" <<'PY'
import sys

try:
    with open(sys.argv[1], "r", encoding="utf-8", errors="ignore") as handle:
        for line in handle:
            if line.lower().startswith("x-csrf-token:"):
                print(line.split(":", 1)[1].strip())
except Exception:
    pass
PY
)"
refresh_auth_headers

probe_status_authed "/auth/me with cookie" "200" "$API_BASE/api/v1/auth/me"

# ---------- Pairing ----------
echo
PAIRING_BODY=$(DEVICE_ID="$DEVICE_ID" \
  json_body deviceIdentifier=__env__:DEVICE_ID nickname="Smoke Display")
PAIRING_OUT="$(tmp_json pairing-request)"
post_json "Pairing request" "201" "$API_BASE/api/v1/devices/pairing/request" "$PAIRING_BODY" "$PAIRING_OUT" -b "$COOKIE_JAR"
CODE="$(json_get "$PAIRING_OUT" "data.code")"
make_label "Pairing code parsed"
parse_label="$CHECK_LABEL"
if [[ -n "$CODE" && ${#CODE} -eq 6 ]]; then
  record_ok "$parse_label" "$CODE"
else
  record_fail "$parse_label" "missing or invalid code"
fi

COMPLETE_BODY=$(CODE="$CODE" json_body code=__env__:CODE nickname="Smoke Display")
COMPLETE_OUT="$(tmp_json pairing-complete)"
post_json "Pairing complete" "201" "$API_BASE/api/v1/devices/pairing/complete" "$COMPLETE_BODY" "$COMPLETE_OUT" "${auth_headers[@]}"
DISPLAY_ID="$(json_get "$COMPLETE_OUT" "data.display.id")"
if [[ -z "$DISPLAY_ID" ]]; then
  DISPLAY_ID="$(json_get "$COMPLETE_OUT" "display.id")"
fi
make_label "Display id parsed"
parse_label="$CHECK_LABEL"
if [[ -n "$DISPLAY_ID" ]]; then
  record_ok "$parse_label" "$DISPLAY_ID"
else
  record_fail "$parse_label" "missing display id"
fi

STATUS_OUT="$(tmp_json pairing-status)"
make_label "Device retrieves token"
status_label="$CHECK_LABEL"
: > "$STATUS_OUT"
STATUS_CODE="$(curl "${curl_common[@]}" -o "$STATUS_OUT" -w '%{http_code}' "$API_BASE/api/v1/devices/pairing/status/$CODE" 2>/dev/null)"
DEVICE_TOKEN="$(json_get "$STATUS_OUT" "data.deviceToken")"
if [[ "$STATUS_CODE" == "200" && -n "$DEVICE_TOKEN" ]]; then
  record_ok "$status_label" "200 + device token"
else
  record_fail "$status_label" "got '$STATUS_CODE'; expected 200 with deviceToken"
  print_response_preview "$STATUS_OUT"
fi

probe_status_authed "List displays" "200" "$API_BASE/api/v1/displays"

# ---------- Content -> Playlist -> Schedule ----------
echo
CONTENT_BODY=$(json_body \
  name="Smoke Content ${TIMESTAMP}" \
  type=url \
  url="https://example.com/vizora-smoke-${TIMESTAMP}" \
  duration=__json__:10)
CONTENT_OUT="$(tmp_json content)"
post_json "Create URL content" "201" "$API_BASE/api/v1/content" "$CONTENT_BODY" "$CONTENT_OUT" "${auth_headers[@]}"
CONTENT_ID="$(json_get "$CONTENT_OUT" "data.id")"
make_label "Content id parsed"
parse_label="$CHECK_LABEL"
if [[ -n "$CONTENT_ID" ]]; then
  record_ok "$parse_label" "$CONTENT_ID"
else
  record_fail "$parse_label" "missing content id"
fi

probe_status_authed "List content" "200" "$API_BASE/api/v1/content"

UPLOAD_FILE="$(tmp_file smoke-upload.pdf)"
write_smoke_pdf "$UPLOAD_FILE"
UPLOAD_FILE_SIZE="$(python3 - "$UPLOAD_FILE" <<'PY'
import os
import sys

try:
    print(os.path.getsize(sys.argv[1]))
except Exception:
    print("")
PY
)"
UPLOAD_OUT="$(tmp_json upload-content)"
post_multipart_upload "Upload PDF content" "201" "$API_BASE/api/v1/content/upload" "$UPLOAD_FILE" "$UPLOAD_OUT" "${auth_headers[@]}"
UPLOAD_CONTENT_ID="$(json_get "$UPLOAD_OUT" "data.content.id")"
if [[ -z "$UPLOAD_CONTENT_ID" ]]; then
  UPLOAD_CONTENT_ID="$(json_get "$UPLOAD_OUT" "content.id")"
fi
make_label "Uploaded content id parsed"
parse_label="$CHECK_LABEL"
if [[ -n "$UPLOAD_CONTENT_ID" ]]; then
  record_ok "$parse_label" "$UPLOAD_CONTENT_ID"
else
  record_fail "$parse_label" "missing uploaded content id"
fi

RANGE_OUT="$(tmp_file uploaded-content-range.bin)"
RANGE_HEADERS="$(tmp_headers uploaded-content-range)"
make_label "Device streams uploaded content range"
range_label="$CHECK_LABEL"
if [[ -n "$UPLOAD_CONTENT_ID" && -n "$DEVICE_TOKEN" ]]; then
  : > "$RANGE_OUT"
  : > "$RANGE_HEADERS"
  RANGE_STATUS="$(curl "${curl_common[@]}" -D "$RANGE_HEADERS" -o "$RANGE_OUT" -w '%{http_code}' \
    -H "Authorization: Bearer $DEVICE_TOKEN" \
    -H "Range: bytes=0-4" \
    "$API_BASE/api/v1/device-content/$UPLOAD_CONTENT_ID/file" 2>/dev/null)"
  RANGE_HEX="$(python3 - "$RANGE_OUT" <<'PY'
import sys

try:
    with open(sys.argv[1], "rb") as handle:
        print(handle.read().hex())
except Exception:
    print("")
PY
)"
  CONTENT_RANGE="$(python3 - "$RANGE_HEADERS" <<'PY'
import sys

try:
    with open(sys.argv[1], "r", encoding="utf-8", errors="ignore") as handle:
        for line in handle:
            if line.lower().startswith("content-range:"):
                print(line.split(":", 1)[1].strip())
                break
except Exception:
    pass
PY
)"
  EXPECTED_CONTENT_RANGE="bytes 0-4/$UPLOAD_FILE_SIZE"
  if [[ "$RANGE_STATUS" == "206" && "$RANGE_HEX" == "255044462d" && "$CONTENT_RANGE" == "$EXPECTED_CONTENT_RANGE" ]]; then
    record_ok "$range_label" "206 + PDF header range"
  else
    record_fail "$range_label" "got status '$RANGE_STATUS', range '$CONTENT_RANGE', hex '$RANGE_HEX'; expected 206 $EXPECTED_CONTENT_RANGE PDF header"
    print_response_preview "$RANGE_OUT"
  fi
else
  record_fail "$range_label" "missing uploaded content id or device token"
fi

DELETE_UPLOAD_OUT="$(tmp_json delete-upload-content)"
make_label "Delete uploaded PDF content"
delete_upload_label="$CHECK_LABEL"
if [[ -n "$UPLOAD_CONTENT_ID" ]]; then
  : > "$DELETE_UPLOAD_OUT"
  refresh_auth_headers
  DELETE_UPLOAD_STATUS="$(curl "${curl_common[@]}" -o "$DELETE_UPLOAD_OUT" -w '%{http_code}' \
    -X DELETE "${auth_headers[@]}" \
    "$API_BASE/api/v1/content/$UPLOAD_CONTENT_ID" 2>/dev/null)"
  if [[ "$DELETE_UPLOAD_STATUS" == "200" || "$DELETE_UPLOAD_STATUS" == "204" ]]; then
    UPLOAD_CONTENT_DELETED=1
    record_ok "$delete_upload_label" "$DELETE_UPLOAD_STATUS"
  else
    record_fail "$delete_upload_label" "got '$DELETE_UPLOAD_STATUS'; expected 200 or 204"
    print_response_preview "$DELETE_UPLOAD_OUT"
  fi
else
  record_fail "$delete_upload_label" "missing uploaded content id"
fi

PLAYLIST_ITEMS=$(CONTENT_ID="$CONTENT_ID" python3 - <<'PY'
import json
import os
print(json.dumps([{"contentId": os.environ["CONTENT_ID"], "duration": 10}]))
PY
)
PLAYLIST_BODY=$(PLAYLIST_ITEMS="$PLAYLIST_ITEMS" json_body \
  name="Smoke Playlist ${TIMESTAMP}" \
  loop=__true__ \
  items=__json__:"$PLAYLIST_ITEMS")
PLAYLIST_OUT="$(tmp_json playlist)"
post_json "Create playlist with item" "201" "$API_BASE/api/v1/playlists" "$PLAYLIST_BODY" "$PLAYLIST_OUT" "${auth_headers[@]}"
PLAYLIST_ID="$(json_get "$PLAYLIST_OUT" "data.id")"
make_label "Playlist id parsed"
parse_label="$CHECK_LABEL"
if [[ -n "$PLAYLIST_ID" ]]; then
  record_ok "$parse_label" "$PLAYLIST_ID"
else
  record_fail "$parse_label" "missing playlist id"
fi

probe_status_authed "Read playlist detail" "200" "$API_BASE/api/v1/playlists/$PLAYLIST_ID"

SCHEDULE_VARS=$(python3 - <<'PY'
from datetime import datetime, timedelta, timezone
now = datetime.now(timezone.utc)
yesterday = now - timedelta(days=1)
js_day = (now.weekday() + 1) % 7
print(yesterday.isoformat().replace("+00:00", "Z"))
print(js_day)
PY
)
START_DATE="$(printf '%s\n' "$SCHEDULE_VARS" | sed -n '1p')"
DAY_OF_WEEK="$(printf '%s\n' "$SCHEDULE_VARS" | sed -n '2p')"
SCHEDULE_BODY=$(PLAYLIST_ID="$PLAYLIST_ID" DISPLAY_ID="$DISPLAY_ID" START_DATE="$START_DATE" DAY_OF_WEEK="$DAY_OF_WEEK" \
  json_body \
    name="Smoke Schedule ${TIMESTAMP}" \
    startDate=__env__:START_DATE \
    daysOfWeek=__json__:"[$DAY_OF_WEEK]" \
    isActive=__true__ \
    playlistId=__env__:PLAYLIST_ID \
    displayId=__env__:DISPLAY_ID)
SCHEDULE_OUT="$(tmp_json schedule)"
post_json "Create active schedule" "201" "$API_BASE/api/v1/schedules" "$SCHEDULE_BODY" "$SCHEDULE_OUT" "${auth_headers[@]}"
SCHEDULE_ID="$(json_get "$SCHEDULE_OUT" "data.id")"
make_label "Schedule id parsed"
parse_label="$CHECK_LABEL"
if [[ -n "$SCHEDULE_ID" ]]; then
  record_ok "$parse_label" "$SCHEDULE_ID"
else
  record_fail "$parse_label" "missing schedule id"
fi

probe_status_authed "List schedules" "200" "$API_BASE/api/v1/schedules"

ACTIVE_OUT="$(tmp_json active-schedules)"
make_label "Device reads active schedules"
active_label="$CHECK_LABEL"
: > "$ACTIVE_OUT"
ACTIVE_STATUS="$(curl "${curl_common[@]}" -o "$ACTIVE_OUT" -w '%{http_code}' \
  -H "Authorization: Bearer $DEVICE_TOKEN" \
  "$API_BASE/api/v1/schedules/active/$DISPLAY_ID" 2>/dev/null)"
ACTIVE_SCHEDULE_ID="$(json_get "$ACTIVE_OUT" "data.0.id")"
if [[ "$ACTIVE_STATUS" == "200" && "$ACTIVE_SCHEDULE_ID" == "$SCHEDULE_ID" ]]; then
  record_ok "$active_label" "200 + scheduled playlist visible"
else
  record_fail "$active_label" "got '$ACTIVE_STATUS'; expected first active schedule '$SCHEDULE_ID' (got '$ACTIVE_SCHEDULE_ID')"
  print_response_preview "$ACTIVE_OUT"
fi

probe_status_authed "List notifications" "200" "$API_BASE/api/v1/notifications"

# ---------- Report ----------
echo
echo "----------------------------------------------------"
for r in "${RESULTS[@]}"; do echo "  $r"; done
echo "----------------------------------------------------"
echo "  Checks:    $CHECK_NUM"
echo "  Test user: $EMAIL"
echo "  Test org:  $ORG_NAME"
echo "  Display:   $DEVICE_ID"
echo "  Finished:  $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo

if [[ $FAILED -eq 0 ]]; then
  echo "ALL $CHECK_NUM CRITICAL-PATH CHECKS PASSED"
  exit 0
else
  echo "$FAILED CHECK(S) FAILED -- investigate before promoting deploy"
  exit 1
fi
