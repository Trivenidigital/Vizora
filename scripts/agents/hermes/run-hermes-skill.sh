#!/usr/bin/env bash
# Drive a Hermes skill via one-shot prompt — replacement for `hermes cron`.
#
# We tried `hermes cron` and the model produced different (worse) behavior
# in cron-firing context vs `hermes -z` invocation: probe loops on
# get_prompt/read_resource and chat-text outputs instead of MCP tool
# calls. Same model, same SKILL, same tools, but cron context appears
# to inject something that confuses the agent. One-shot via -z works
# end-to-end.
#
# This script is the bridge. PM2 fires it on a cron schedule (matching
# the original hermes-cron cadence per agent), and it shells out to
# `hermes -z` with the explicit action prompt that demonstrably works.
#
# Behavior added 2026-05-08 (P0.4 — agent-platform-redesign):
#   1. Pre-flight check on OpenRouter credits (refuse < MIN_BALANCE_USD).
#   2. Pre-flight check on today's app-level spend
#      (refuse if >= DAILY_BUDGET_USD).
#   3. ALWAYS pass --max-tokens 4096 to clamp per-call output
#      (Reviewer 2 phantom-lever finding — config-only setting was not
#      actually clamping the OpenRouter request param).
#   4. Optional per-skill toolset filter via -t (P1.2).
#   5. Post-flight POST /internal/agent-runs with run metadata.
#
# Every run logs to /var/log/hermes/runner/<skill>.log (timestamped
# start + Hermes stdout/stderr + end). On non-zero exit from hermes
# we log it but ALWAYS exit 0 — PM2's cron_restart treats non-zero as
# crash and triggers exponential backoff, which is the wrong behavior
# for a fire-and-forget cron firing.
#
# Usage:
#   run-hermes-skill.sh <skill-name> <prompt> [toolsets-csv]
#
# Example:
#   run-hermes-skill.sh vizora-customer-lifecycle "Run end-to-end..." \
#     "mcp_vizora_list_onboarding_candidates,mcp_vizora_log_shadow_row"

set -uo pipefail

SKILL="${1:-}"
PROMPT="${2:-}"
TOOLSETS="${3:-}"
if [[ -z "$SKILL" || -z "$PROMPT" ]]; then
  echo "usage: $0 <skill-name> <prompt> [toolsets-csv]" >&2
  exit 0
fi

LOGDIR="/var/log/hermes/runner"
mkdir -p "$LOGDIR"
LOG="$LOGDIR/${SKILL}.log"

# Configurable budgets — overridable via PM2 env or shell.
MIN_BALANCE_USD="${MIN_BALANCE_USD:-0.50}"
DAILY_BUDGET_USD="${DAILY_BUDGET_USD:-1.00}"
MIDDLEWARE_URL="${MIDDLEWARE_URL:-http://localhost:3000}"
INTERNAL_SECRET="${INTERNAL_API_SECRET:-}"

START=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
{
  echo "─────────────────────────────────────────"
  echo "[$START] start skill=$SKILL pid=$$"
} >> "$LOG"

# ---------------------------------------------------------------------------
# Pre-flight #1: OpenRouter balance check.
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/lib/openrouter-balance.sh"

PREFLIGHT_BALANCE="$(openrouter_balance_usd 2>/dev/null || echo "")"
if [[ -n "$PREFLIGHT_BALANCE" ]] && (( $(echo "$PREFLIGHT_BALANCE < $MIN_BALANCE_USD" | bc -l) )); then
  END=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
  {
    echo "[$END] ABORT skill=$SKILL reason=balance_too_low balance=$PREFLIGHT_BALANCE min=$MIN_BALANCE_USD"
  } >> "$LOG"
  curl -fsS --max-time 3 -X POST \
    -H "Content-Type: application/json" \
    -H "x-internal-api-key: $INTERNAL_SECRET" \
    -H "x-internal-caller: runner" \
    -d "{\"skillName\":\"$SKILL\",\"startedAt\":\"$START\",\"finishedAt\":\"$END\",\"exitCode\":0,\"outcome\":\"budget_aborted\",\"preflightBalanceUsd\":$PREFLIGHT_BALANCE}" \
    "$MIDDLEWARE_URL/api/v1/internal/agent-runs" > /dev/null 2>&1 || true
  exit 0
fi

# ---------------------------------------------------------------------------
# Pre-flight #2: today's app-level spend.
# ---------------------------------------------------------------------------
PREFLIGHT_TODAY_SPEND="$(curl -fsS --max-time 3 \
  -H "x-internal-api-key: $INTERNAL_SECRET" \
  -H "x-internal-caller: runner" \
  "$MIDDLEWARE_URL/api/v1/internal/agent-runs/today-spend" 2>/dev/null \
  | python3 -c 'import json,sys; print(json.load(sys.stdin).get("usd", 0))' 2>/dev/null \
  || echo "0")"

if (( $(echo "$PREFLIGHT_TODAY_SPEND >= $DAILY_BUDGET_USD" | bc -l) )); then
  END=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
  {
    echo "[$END] ABORT skill=$SKILL reason=daily_budget_exceeded today_spend=$PREFLIGHT_TODAY_SPEND budget=$DAILY_BUDGET_USD"
  } >> "$LOG"
  BAL_FIELD=""
  if [[ -n "$PREFLIGHT_BALANCE" ]]; then
    BAL_FIELD=",\"preflightBalanceUsd\":$PREFLIGHT_BALANCE"
  fi
  curl -fsS --max-time 3 -X POST \
    -H "Content-Type: application/json" \
    -H "x-internal-api-key: $INTERNAL_SECRET" \
    -H "x-internal-caller: runner" \
    -d "{\"skillName\":\"$SKILL\",\"startedAt\":\"$START\",\"finishedAt\":\"$END\",\"exitCode\":0,\"outcome\":\"budget_aborted\",\"preflightTodaySpendUsd\":$PREFLIGHT_TODAY_SPEND${BAL_FIELD}}" \
    "$MIDDLEWARE_URL/api/v1/internal/agent-runs" > /dev/null 2>&1 || true
  exit 0
fi

# ---------------------------------------------------------------------------
# Pre-flight #3: Hermes version pin (fail closed on drift).
# Pinned version lives in /opt/vizora/app/.env as HERMES_VERSION.
# Fail-closed: a Hermes upgrade can silently invalidate the `-t` flag,
# `insights` parser, MCP tool naming. Block until ops confirms.
# ---------------------------------------------------------------------------
if [[ -n "${HERMES_VERSION:-}" ]]; then
  RUNNING_VERSION="$(/usr/local/bin/hermes --version 2>/dev/null | awk '{print $NF}' || echo "")"
  if [[ -n "$RUNNING_VERSION" && "$RUNNING_VERSION" != "$HERMES_VERSION" ]]; then
    {
      echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ABORT skill=$SKILL reason=version_skew running=$RUNNING_VERSION pinned=$HERMES_VERSION"
    } >> "$LOG"
    # version_skew firings do NOT create an agent_runs row — they're a
    # non-event signaling ops attention; ops-watchdog detects the gap.
    exit 0
  fi
fi

# ---------------------------------------------------------------------------
# Invocation: ALWAYS pass --max-tokens 4096 explicitly.
# This is the phantom-lever fix (Reviewer 2 finding): the Hermes config
# `model.max_tokens` setting may not propagate to the OpenRouter request
# param. The CLI flag is belt-and-braces. P0.0a verifies clamping arrives
# at the OpenRouter layer.
# ---------------------------------------------------------------------------
HERMES_ARGS=(--skills "$SKILL" --max-tokens 4096 -z "$PROMPT")
if [[ -n "$TOOLSETS" ]]; then
  HERMES_ARGS+=(-t "$TOOLSETS")
fi

# Bound the run. Hermes can occasionally hang; 5 min is generous for
# our 5-min and 30-min cron cadences without overlapping.
timeout 300 /usr/local/bin/hermes "${HERMES_ARGS[@]}" >> "$LOG" 2>&1
RC=$?

END=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)

# Classify outcome from RC + stdout markers ONLY (Reviewer A I2 +
# design ADL-3). FORBIDDEN/INVALID_INPUT live in mcp_audit_log, not
# Hermes stdout — sidecar refines later.
OUTCOME="success"
if [[ $RC -eq 124 ]]; then
  OUTCOME="timeout"
elif [[ $RC -ne 0 ]]; then
  OUTCOME="api_error"
elif grep -qE "(API call failed.*HTTP 4|API call failed.*HTTP 5|HTTP 402|HTTP 429)" "$LOG"; then
  OUTCOME="api_error"
fi

# Best-effort POST of run metadata. Failure is silent; alerting is on
# rate, not count. The runner ALWAYS exits 0 regardless of POST result.
BAL_FIELD=""
if [[ -n "$PREFLIGHT_BALANCE" ]]; then
  BAL_FIELD=",\"preflightBalanceUsd\":$PREFLIGHT_BALANCE"
fi
SPEND_FIELD=""
if [[ -n "$PREFLIGHT_TODAY_SPEND" ]]; then
  SPEND_FIELD=",\"preflightTodaySpendUsd\":$PREFLIGHT_TODAY_SPEND"
fi

# Capture last 1024 chars of log for errorExcerpt on failure outcomes.
ERROR_FIELD=""
if [[ "$OUTCOME" != "success" ]]; then
  EXCERPT="$(tail -c 1024 "$LOG" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' 2>/dev/null || echo "\"\"")"
  ERROR_FIELD=",\"errorExcerpt\":$EXCERPT"
fi

POST_BODY="{\"skillName\":\"$SKILL\",\"pid\":$$,\"startedAt\":\"$START\",\"finishedAt\":\"$END\",\"exitCode\":$RC,\"outcome\":\"$OUTCOME\"${BAL_FIELD}${SPEND_FIELD}${ERROR_FIELD}}"

RUN_ID="$(curl -fsS --max-time 3 -X POST \
  -H "Content-Type: application/json" \
  -H "x-internal-api-key: $INTERNAL_SECRET" \
  -H "x-internal-caller: runner" \
  -d "$POST_BODY" \
  "$MIDDLEWARE_URL/api/v1/internal/agent-runs" 2>/dev/null \
  | python3 -c 'import json,sys; print(json.load(sys.stdin).get("id",""))' 2>/dev/null \
  || echo "")"

{
  echo "[$END] end skill=$SKILL exit=$RC outcome=$OUTCOME agent_run_id=$RUN_ID"
} >> "$LOG"

# ALWAYS exit 0 — PM2 cron_restart treats non-zero as crash.
exit 0
