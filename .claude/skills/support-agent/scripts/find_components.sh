#!/bin/bash
# find_components.sh — Find Vizora source files by feature keyword
# Usage: ./find_components.sh <keyword>
# Returns file paths with one-line descriptions

set -euo pipefail

KEYWORD="${1:?Usage: find_components.sh <keyword>}"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo '.')"

# Normalize keyword to lowercase
KW=$(echo "$KEYWORD" | tr '[:upper:]' '[:lower:]')

echo "=== Searching for: $KEYWORD ==="
echo ""

# Domain-specific paths
declare -A DOMAINS
DOMAINS=(
  [display]="web/src/components/Device* web/src/app/dashboard/devices/ middleware/src/modules/displays/ realtime/src/gateways/"
  [device]="web/src/components/Device* web/src/app/dashboard/devices/ middleware/src/modules/displays/ realtime/src/gateways/"
  [content]="web/src/app/dashboard/content/ middleware/src/modules/content/"
  [template]="web/src/components/templates/ web/src/components/template-editor/ middleware/src/modules/template-library/"
  [playlist]="web/src/app/dashboard/playlists/ web/src/components/playlist/ middleware/src/modules/playlists/"
  [schedule]="web/src/app/dashboard/schedules/ middleware/src/modules/schedules/"
  [auth]="web/src/app/\\(auth\\)/ middleware/src/modules/auth/"
  [dashboard]="web/src/app/dashboard/ web/src/components/dashboard/"
  [realtime]="realtime/src/gateways/ realtime/src/services/ web/src/lib/hooks/"
  [websocket]="realtime/src/gateways/ realtime/src/services/ web/src/lib/hooks/"
  [support]="web/src/components/support/ middleware/src/modules/support/"
  [organization]="middleware/src/modules/organizations/ web/src/app/dashboard/settings/"
  [user]="middleware/src/modules/users/ middleware/src/modules/auth/"
)

# Check if keyword matches a known domain
MATCHED=false
for domain in "${!DOMAINS[@]}"; do
  if [[ "$KW" == *"$domain"* ]]; then
    echo "--- Domain match: $domain ---"
    for path in ${DOMAINS[$domain]}; do
      full="$ROOT/$path"
      if [ -e "$full" ] || compgen -G "$full" > /dev/null 2>&1; then
        echo "  $path"
      fi
    done
    MATCHED=true
    echo ""
  fi
done

# Always do a grep search for the keyword
echo "--- Grep matches (*.ts, *.tsx) ---"
grep -rl --include="*.ts" --include="*.tsx" -i "$KEYWORD" \
  "$ROOT/web/src/" "$ROOT/middleware/src/" "$ROOT/realtime/src/" 2>/dev/null \
  | head -15 \
  | sed "s|$ROOT/||" \
  | while read -r f; do echo "  $f"; done

if [ "$MATCHED" = false ]; then
  echo ""
  echo "(No domain match — showing grep results only)"
fi
