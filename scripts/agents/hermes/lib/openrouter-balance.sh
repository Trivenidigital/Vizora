#!/usr/bin/env bash
#
# openrouter-balance.sh — query OpenRouter for current credit balance.
#
# Echoes the balance as a USD decimal string; returns non-zero on
# failure so the caller can fall through to a default behavior.
#
# Balance semantics (verified live 2026-05-08, design §3.2):
#   GET /v1/credits returns { data: { total_credits, total_usage } }
#   balance = total_credits - total_usage
#   May be NEGATIVE temporarily for users with multiple top-ups + refunds.
#
# Reads OPENROUTER_API_KEY from the environment.
#
# Usage:
#   source openrouter-balance.sh
#   balance=$(openrouter_balance_usd) || balance=""
#

openrouter_balance_usd() {
  local response
  response=$(curl -fsS \
    --max-time 5 \
    -H "Authorization: Bearer ${OPENROUTER_API_KEY}" \
    https://openrouter.ai/api/v1/credits 2>/dev/null) || return 1
  echo "$response" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)["data"]
    print(f"{d[\"total_credits\"] - d[\"total_usage\"]:.8f}")
except Exception:
    sys.exit(1)
' || return 1
}
