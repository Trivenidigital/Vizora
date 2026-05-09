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
# Behavior added 2026-05-08/09 (P0.4 — agent-platform-redesign):
#   1. Pre-flight check on OpenRouter credits (refuse < MIN_BALANCE_USD).
#   2. Pre-flight check on today's app-level spend
#      (refuse if >= DAILY_BUDGET_USD).
#   3. Pre-flight check on Hermes version (refuse if HERMES_VERSION env
#      is set and `hermes --version` returns a different value).
#   4. Optional per-skill toolset filter via -t (P1.2).
#   5. Post-flight POST /internal/agent-runs with run metadata.
#
# NOTE on max_tokens (PR-review R3 C1):
#   `--max-tokens` is NOT a Hermes 0.12.0 CLI flag — argparse interprets
#   the integer as the positional `command` slot. The real Layer-3 cost
#   defense is the Hermes config setting `model.max_tokens=4096` in
#   /root/.hermes/config.yaml (set 2026-05-08). Whether THAT setting
#   actually clamps the OpenRouter request param is verified post-hoc
#   by P0.0a (smoke-test once credits are added). If it doesn't clamp,
#   the OpenRouter dashboard's per-key cap remains the hard backstop.
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

# Load Vizora app env (INTERNAL_API_SECRET, MIDDLEWARE_URL, HERMES_VERSION,
# MIN_BALANCE_USD, DAILY_BUDGET_USD, INTERNAL_API_LOOPBACK_ONLY).
# PM2 doesn't auto-source .env files; without this the runner POSTs end up
# unauthenticated → no agent_runs row written.
#
# Cannot `source /opt/vizora/app/.env` directly — some values contain shell-
# special chars (e.g. `EMAIL_FROM=Vizora <noreply@...>` where `<` is a
# redirect operator) and bash will fail to parse the line.
#
# Selective per-key load: only the vars THIS script needs; ignore everything
# else. Whitespace-trimmed, quote-stripped.
_load_env_var() {
  local key="$1" val
  val=$(grep "^${key}=" /opt/vizora/app/.env 2>/dev/null | head -1 | cut -d= -f2-)
  # Strip surrounding quotes if present.
  val="${val%\"}"; val="${val#\"}"
  val="${val%\'}"; val="${val#\'}"
  [[ -n "$val" ]] && export "$key=$val"
}
for k in INTERNAL_API_SECRET MIDDLEWARE_URL HERMES_VERSION MIN_BALANCE_USD DAILY_BUDGET_USD INTERNAL_API_LOOPBACK_ONLY; do
  _load_env_var "$k"
done

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

# Helper: post a JSON body to the agent-runs endpoint. Builds JSON via
# python3 json.dumps so embedded special chars in $SKILL etc. cannot
# break out of string context (PR-review R2 C6: removes JSON injection).
# Sends the api-key via the @-stdin pattern to keep it out of /proc/$pid/cmdline
# (PR-review R2 I6).
post_agent_run() {
  local body_json
  body_json="$1"
  printf '%s\n' "x-internal-api-key: $INTERNAL_SECRET" \
    | curl -fsS --max-time 3 -X POST \
        -H "@-" \
        -H "Content-Type: application/json" \
        -H "x-internal-caller: runner" \
        -d "$body_json" \
        "$MIDDLEWARE_URL/api/v1/internal/agent-runs" 2>/dev/null
}

# Helper: build a JSON body from named fields safely via python3.
# Validates that numeric values are actually numeric (PR-review R2 I7).
build_run_body() {
  python3 -c '
import json, sys, re
fields = {}
for arg in sys.argv[1:]:
    if "=" not in arg: continue
    k, v = arg.split("=", 1)
    if v == "": continue
    # Numeric coercion for known number fields. Validate strictly so a
    # tampered env var cannot inject non-numeric content.
    if k in ("exitCode", "pid"):
        try:
            fields[k] = int(v)
        except ValueError:
            sys.exit(1)
    elif k in ("preflightBalanceUsd", "preflightTodaySpendUsd"):
        if not re.fullmatch(r"-?\d+(\.\d+)?", v):
            sys.exit(1)
        fields[k] = float(v)
    else:
        fields[k] = v
print(json.dumps(fields))
' "$@"
}

PREFLIGHT_BALANCE="$(openrouter_balance_usd 2>/dev/null || echo "")"
# Validate the balance string is a plain decimal before passing to bc.
if [[ -n "$PREFLIGHT_BALANCE" ]] && [[ "$PREFLIGHT_BALANCE" =~ ^-?[0-9]+(\.[0-9]+)?$ ]] \
    && (( $(echo "$PREFLIGHT_BALANCE < $MIN_BALANCE_USD" | bc -l) )); then
  END=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
  {
    echo "[$END] ABORT skill=$SKILL reason=balance_too_low balance=$PREFLIGHT_BALANCE min=$MIN_BALANCE_USD"
  } >> "$LOG"
  body="$(build_run_body \
    "skillName=$SKILL" \
    "startedAt=$START" \
    "finishedAt=$END" \
    "exitCode=0" \
    "outcome=budget_aborted" \
    "preflightBalanceUsd=$PREFLIGHT_BALANCE")"
  post_agent_run "$body" > /dev/null || true
  exit 0
fi

# ---------------------------------------------------------------------------
# Pre-flight #2: today's app-level spend.
# ---------------------------------------------------------------------------
PREFLIGHT_TODAY_SPEND="$(printf '%s\n' "x-internal-api-key: $INTERNAL_SECRET" \
  | curl -fsS --max-time 3 \
      -H "@-" \
      -H "x-internal-caller: runner" \
      "$MIDDLEWARE_URL/api/v1/internal/agent-runs/today-spend" 2>/dev/null \
  | python3 -c 'import json,sys; print(json.load(sys.stdin).get("usd", 0))' 2>/dev/null \
  || echo "0")"

# Validate today-spend is a plain decimal before passing to bc.
if [[ "$PREFLIGHT_TODAY_SPEND" =~ ^-?[0-9]+(\.[0-9]+)?$ ]] \
    && (( $(echo "$PREFLIGHT_TODAY_SPEND >= $DAILY_BUDGET_USD" | bc -l) )); then
  END=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
  {
    echo "[$END] ABORT skill=$SKILL reason=daily_budget_exceeded today_spend=$PREFLIGHT_TODAY_SPEND budget=$DAILY_BUDGET_USD"
  } >> "$LOG"
  body="$(build_run_body \
    "skillName=$SKILL" \
    "startedAt=$START" \
    "finishedAt=$END" \
    "exitCode=0" \
    "outcome=budget_aborted" \
    "preflightTodaySpendUsd=$PREFLIGHT_TODAY_SPEND" \
    "preflightBalanceUsd=$PREFLIGHT_BALANCE")"
  post_agent_run "$body" > /dev/null || true
  exit 0
fi

# ---------------------------------------------------------------------------
# Pre-flight #3: Hermes version pin (fail closed on drift).
# Pinned version lives in /opt/vizora/app/.env as HERMES_VERSION (e.g.
# "v0.12.0"). Fail-closed: a Hermes upgrade can silently invalidate the
# `-t` flag, `insights` parser, MCP tool naming. Block until ops confirms.
#
# `hermes --version` output format (verified live): `Hermes Agent v0.12.0 (2026.4.30)`
# We extract field 3 (the version tag), NOT $NF which gives the date suffix.
# (PR-review R3 C2 fix.)
# ---------------------------------------------------------------------------
if [[ -n "${HERMES_VERSION:-}" ]]; then
  RUNNING_VERSION="$(/usr/local/bin/hermes --version 2>/dev/null | awk '{print $3}' || echo "")"
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
# Invocation: build Hermes args. NO --max-tokens flag — see header note.
# Per-call output cap is enforced by /root/.hermes/config.yaml's
# `model.max_tokens=4096` setting (verified by P0.0a once credits added).
# ---------------------------------------------------------------------------
HERMES_ARGS=(--skills "$SKILL" -z "$PROMPT")
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
#
# IMPORTANT: scope the grep to the CURRENT firing's portion of the log.
# Earlier draft scanned the whole file — false-positive on stale HTTP 402
# entries from the May 6 incident (every firing classified as api_error).
# The current firing's portion is the lines after our START marker.
CURRENT_FIRING=$(awk -v marker="start skill=$SKILL pid=$$" 'index($0, marker){found=1} found' "$LOG")

OUTCOME="success"
if [[ $RC -eq 124 ]]; then
  OUTCOME="timeout"
elif [[ $RC -ne 0 ]]; then
  OUTCOME="api_error"
elif printf '%s\n' "$CURRENT_FIRING" | grep -qE "(API call failed.*HTTP 4|API call failed.*HTTP 5|HTTP 402|HTTP 429)"; then
  OUTCOME="api_error"
fi

# Best-effort POST of run metadata. Failure is silent; alerting is on
# rate, not count. The runner ALWAYS exits 0 regardless of POST result.
# Body is constructed via python3 json.dumps to escape any special chars
# in $SKILL or log excerpts (PR-review R2 C6).

# Capture last 1024 chars of THIS FIRING's log for errorExcerpt on failure
# outcomes (not the whole file — same scoping fix as the classifier above).
EXCERPT_ARG=""
if [[ "$OUTCOME" != "success" ]]; then
  EXCERPT_ARG="errorExcerpt=$(printf '%s' "$CURRENT_FIRING" | tail -c 1024)"
fi

POST_BODY="$(build_run_body \
  "skillName=$SKILL" \
  "pid=$$" \
  "startedAt=$START" \
  "finishedAt=$END" \
  "exitCode=$RC" \
  "outcome=$OUTCOME" \
  "preflightBalanceUsd=$PREFLIGHT_BALANCE" \
  "preflightTodaySpendUsd=$PREFLIGHT_TODAY_SPEND" \
  "$EXCERPT_ARG")"

RUN_ID="$(post_agent_run "$POST_BODY" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin).get("id",""))' 2>/dev/null \
  || echo "")"

{
  echo "[$END] end skill=$SKILL exit=$RC outcome=$OUTCOME agent_run_id=$RUN_ID"
} >> "$LOG"

# ALWAYS exit 0 — PM2 cron_restart treats non-zero as crash.
exit 0
