#!/usr/bin/env bash
#
# toolset-guard.sh — decide whether a `hermes -z -t` value is narrow enough
# to hand to an unattended cron agent.
#
# Without `-t`, `hermes -z` gives the model the whole `hermes-cli` toolset —
# terminal, execute_code, write_file, patch, delegate_task — as root in
# /opt/vizora/app, with approvals auto-bypassed. That is how a shadow agent
# built into the live middleware dist (#406) and OOM'd the box twice (#399).
# The MCP token scope does not contain it: shell commands never touch MCP.
#
# Returns 0 for an acceptable value, 1 for empty or full-access values.
#
# Usage:
#   source toolset-guard.sh
#   is_safe_toolsets "$TOOLSETS" || abort
#

is_safe_toolsets() {
  local value=",${1// /},"
  case "$value" in
    ,, | *,all,* | *,\*,* | *,hermes-cli,* | *,terminal,* | *,code_execution,* | *,file,*)
      return 1
      ;;
  esac
  return 0
}
