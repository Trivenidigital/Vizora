#!/usr/bin/env bash
#
# Publish the Vizora Display APK to https://vizora.cloud/downloads/ and update
# https://vizora.cloud/tv — as ONE operation.
#
# The APK, the version shown on the page, and the hash shown on the page are
# deployed together or not at all. Publishing them separately is how a customer
# ends up downloading 1.3.11 from a page that claims it is 1.3.10.
#
# This script REFUSES TO RUN until both release gates are recorded in
# deploy/tv/release.json:
#   Gate A — artifact approval        (approval.artifactApprovedBy)
#   Gate B — signing-key durability   (approval.signingKeyBackupConfirmedBy)
#
# It never touches PM2, the database, or any application service. It writes
# only to /var/www/vizora/ and, with --install-nginx, the nginx site config.
#
# Usage:
#   scripts/release/publish-display-apk.sh --apk <path> [--dry-run] [--install-nginx]
#
# Environment:
#   VIZORA_SSH_HOST   default root@89.167.55.176
#   VIZORA_SSH_OPTS   default -o KexAlgorithms=curve25519-sha256

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SSH_HOST="${VIZORA_SSH_HOST:-root@89.167.55.176}"
SSH_OPTS="${VIZORA_SSH_OPTS:--o KexAlgorithms=curve25519-sha256}"

WEB_ROOT="/var/www/vizora"
DL_DIR="$WEB_ROOT/downloads"
TV_DIR="$WEB_ROOT/tv"
ARCHIVE_DIR="$WEB_ROOT/archive"   # sibling of downloads, never a child
PUBLIC_APK_URL="https://vizora.cloud/downloads/vizora-display.apk"

APK=""
DRY_RUN=0
INSTALL_NGINX=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apk)           APK="$2"; shift 2 ;;
    --dry-run)       DRY_RUN=1; shift ;;
    --install-nginx) INSTALL_NGINX=1; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

[[ -n "$APK" ]] || { echo "FATAL: --apk <path> is required" >&2; exit 2; }
[[ -f "$APK" ]] || { echo "FATAL: APK not found: $APK" >&2; exit 2; }

say() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

# ─── Gates A and B ───────────────────────────────────────────────────────────
say "Checking release gates"

RELEASE_JSON="$REPO_ROOT/deploy/tv/release.json"
GATE_OUT="$(node -e '
const fs = require("fs");
const r = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const a = r.approval || {};
const missing = [];
if (!a.artifactApprovedBy)            missing.push("Gate A: approval.artifactApprovedBy is null (artifact not approved for customer distribution)");
if (!a.signingKeyBackupConfirmedBy)   missing.push("Gate B: approval.signingKeyBackupConfirmedBy is null (signing-key backup not confirmed)");
if (missing.length) { console.log("BLOCKED\n" + missing.join("\n")); process.exit(0); }
console.log("OK");
' "$RELEASE_JSON")"

GATES_OPEN=0
if [[ "$GATE_OUT" != "OK" ]]; then
  GATES_OPEN=1
  echo "$GATE_OUT" | tail -n +2 | sed 's/^/  BLOCKED: /' >&2
  cat >&2 <<'EOF'

  Publishing is blocked until both gates are recorded in deploy/tv/release.json.
  These are human confirmations, not checkboxes to fill in to make the script
  proceed. Record only the location CLASS and recovery ownership for the
  keystore — never the key, the .jks, or the password.
EOF
  # A real publish stops here. A dry run continues so the verification output
  # is visible BEFORE the approval decision is made — it uploads nothing, and
  # still exits non-zero at the end so it can never read as "green".
  if [[ $DRY_RUN -eq 0 ]]; then
    exit 1
  fi
  echo "  (dry run — continuing to show verification; nothing will be uploaded)" >&2
else
  echo "  both gates recorded"
fi

# ─── Verify the artifact ─────────────────────────────────────────────────────
# --require-apksigner makes publication FAIL CLOSED when full cross-scheme
# signature verification cannot run. keytool alone reads the v1 block only and
# would miss a v2/v3 block signed with a different key.
#
# --require-pinned-origins does the same for the DEFAULT origins the APK was
# compiled with (build provenance — runtime config can still be overridden on the
# device). Every other check is origin-blind: a build made against the wrong
# environment has a valid package id, a correct version, the right certificate and
# a good hash.
say "Verifying APK identity, signing key, compiled origins and integrity"
node "$REPO_ROOT/scripts/release/verify-display-apk.mjs" \
  --apk "$APK" \
  --against "$RELEASE_JSON" \
  --require-apksigner \
  --require-pinned-cert \
  --require-pinned-origins

# ─── Confirm the page matches the artifact ───────────────────────────────────
say "Confirming installer page matches release.json"
node "$REPO_ROOT/scripts/release/render-tv-page.mjs" --check

if [[ $DRY_RUN -eq 1 ]]; then
  if [[ $GATES_OPEN -eq 1 ]]; then
    say "DRY RUN — verification passed, but PUBLISHING IS STILL BLOCKED"
    echo "  Gate A and/or Gate B are open in deploy/tv/release.json (listed above)."
    echo "  Nothing was uploaded. Exiting non-zero so this cannot read as ready."
    exit 1
  fi
  say "DRY RUN — verification passed, nothing was uploaded"
  exit 0
fi

# ─── Publish ─────────────────────────────────────────────────────────────────
say "Creating server directories"
# shellcheck disable=SC2086
ssh $SSH_OPTS "$SSH_HOST" "mkdir -p '$DL_DIR' '$TV_DIR' '$ARCHIVE_DIR'"

# The archive name must describe the OUTGOING build — the bytes currently at
# vizora-display.apk, which this publish is about to replace — NOT the incoming
# one. Using basename "$APK" here labelled every archived build with its
# successor's version: on 2026-08-11 the 1.3.11 bytes were archived as
# "vizora-display-1.3.12-release.apk". Nothing customer-facing broke, because the
# archive is not web-served, but it silently corrupted the one store you reach for
# during an incident, and it got worse every release.
#
# `published` in release.json is still the outgoing build at this point —
# candidate -> published is a deliberate post-publish step — so it is the correct
# source for the name. Null on the very first publish, where there is nothing to
# archive anyway.
ARCHIVE_NAME="$(node -e '
const r = require(process.argv[1]);
const p = r.published;
if (!p) { process.stdout.write(""); }
else { process.stdout.write(p.sourceAssetName || `vizora-display-${p.versionName}-release.apk`); }
' "$RELEASE_JSON")"
OUTGOING_SHA="$(node -e '
const r = require(process.argv[1]);
process.stdout.write(r.published ? String(r.published.apkSha256).toLowerCase() : "");
' "$RELEASE_JSON")"

say "Uploading APK and installer page"
# shellcheck disable=SC2086
scp $SSH_OPTS "$APK" "$SSH_HOST:$DL_DIR/.incoming.apk"
# shellcheck disable=SC2086
scp $SSH_OPTS "$REPO_ROOT/deploy/tv/index.html" "$SSH_HOST:$TV_DIR/.incoming.html"

say "Archiving current build and swapping atomically"
# mv within a filesystem is atomic, so no request ever sees a partial APK.
# shellcheck disable=SC2086
ssh $SSH_OPTS "$SSH_HOST" "
  set -e
  if [ -f '$DL_DIR/vizora-display.apk' ]; then
    if [ -z '$ARCHIVE_NAME' ]; then
      echo 'REFUSING to archive: release.json has no published block to name the outgoing build after.' >&2
      echo 'A live vizora-display.apk with no published baseline means the two have drifted apart.' >&2
      exit 1
    fi
    # Assert the outgoing bytes really are what release.json claims is published
    # before labelling them. A mismatch means someone published out of band, and
    # archiving under the recorded name would bake that lie into the archive.
    actual=\$(sha256sum '$DL_DIR/vizora-display.apk' | cut -d' ' -f1)
    if [ -n '$OUTGOING_SHA' ] && [ \"\$actual\" != '$OUTGOING_SHA' ]; then
      echo \"REFUSING to archive: live APK is \$actual but release.json published says $OUTGOING_SHA.\" >&2
      echo 'Reconcile before publishing — do not overwrite an artifact of unknown provenance.' >&2
      exit 1
    fi
    cp -p '$DL_DIR/vizora-display.apk' '$ARCHIVE_DIR/$ARCHIVE_NAME'
  fi
  mv '$DL_DIR/.incoming.apk' '$DL_DIR/vizora-display.apk'
  mv '$TV_DIR/.incoming.html' '$TV_DIR/index.html'
  chmod 644 '$DL_DIR/vizora-display.apk' '$TV_DIR/index.html'
  chown -R www-data:www-data '$WEB_ROOT'
"

if [[ $INSTALL_NGINX -eq 1 ]]; then
  say "Installing nginx config"
  echo "  Diff against live config (review before it is applied):"
  # shellcheck disable=SC2086
  scp $SSH_OPTS "$REPO_ROOT/deploy/nginx/vizora-tv-downloads.conf" \
      "$SSH_HOST:/etc/nginx/snippets/vizora-tv-downloads.conf"
  cat <<EOF

  Uploaded to /etc/nginx/snippets/vizora-tv-downloads.conf.

  This script does NOT edit /etc/nginx/sites-enabled/vizora automatically —
  that file contains the live TLS config for every Vizora service and an
  automated edit there risks the whole site. Add this line inside the
  vizora.cloud server block, by hand, then test and reload:

      include /etc/nginx/snippets/vizora-tv-downloads.conf;

      nginx -t && systemctl reload nginx
EOF
fi

# ─── Post-publish verification ───────────────────────────────────────────────
say "Verifying the published artifact from the server itself"
# Verified from the box, not from a workstation: local curl to vizora.cloud
# has returned 000 while production was perfectly healthy.
# shellcheck disable=SC2086
ssh $SSH_OPTS "$SSH_HOST" "curl -sI '$PUBLIC_APK_URL' | head -20"

say "Comparing published bytes against the source APK"
node "$REPO_ROOT/scripts/release/verify-display-apk.mjs" \
  --apk "$APK" \
  --against "$RELEASE_JSON" \
  --url "$PUBLIC_APK_URL"

say "Published"
cat <<EOF

  Installer page : https://vizora.cloud/tv
  APK            : $PUBLIC_APK_URL

  Remaining manual step: move the verified 'candidate' block in
  deploy/tv/release.json to 'published', commit, and open a PR. That block is
  the baseline the NEXT release is compared against — its signing certificate,
  its versionCode, and its compiledOrigins. Carry compiledOrigins across with
  the rest: leaving it null keeps the origins continuity check permanently
  SKIPPED, which looks like coverage without being any.
EOF
