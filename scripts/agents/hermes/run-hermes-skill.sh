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
# Every run logs to /var/log/hermes/runner/<skill>.log (timestamped
# start + Hermes stdout/stderr + end). On non-zero exit from hermes
# we log it but ALWAYS exit 0 — PM2's cron_restart treats non-zero as
# crash and triggers exponential backoff, which is the wrong behavior
# for a fire-and-forget cron firing.
#
# Usage:
#   run-hermes-skill.sh <skill-name> <prompt>
#
# Example:
#   run-hermes-skill.sh vizora-customer-lifecycle "Run the skill end-to-end now..."

set -uo pipefail

SKILL="${1:-}"
PROMPT="${2:-}"
if [[ -z "$SKILL" || -z "$PROMPT" ]]; then
  echo "usage: $0 <skill-name> <prompt>" >&2
  exit 0
fi

LOGDIR="/var/log/hermes/runner"
mkdir -p "$LOGDIR"
LOG="$LOGDIR/${SKILL}.log"

START=$(date -u +%Y-%m-%dT%H:%M:%SZ)
{
  echo "─────────────────────────────────────────"
  echo "[$START] start skill=$SKILL pid=$$"
} >> "$LOG"

# Bound the run. Hermes can occasionally hang; 5 min is generous for
# our 5-min and 30-min cron cadences without overlapping.
timeout 300 /usr/local/bin/hermes --skills "$SKILL" -z "$PROMPT" >> "$LOG" 2>&1
RC=$?

END=$(date -u +%Y-%m-%dT%H:%M:%SZ)
{
  echo "[$END] end skill=$SKILL exit=$RC"
} >> "$LOG"

# ALWAYS exit 0 — PM2 cron_restart treats non-zero as crash.
exit 0
