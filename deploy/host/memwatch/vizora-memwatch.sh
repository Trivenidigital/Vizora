#!/usr/bin/env bash
# vizora-memwatch — READ-ONLY host memory sampler for OOM attribution.
#
# The kernel OOM report names the victim by pid + a 15-char comm ("node"). This
# records, every 15 s, the pid -> cmdline / ppid / start time / PM2 app mapping for
# every large (or orphaned) process, so the next OOM can be joined by pid.
#
# Reads /proc only. Changes no workload, sends nothing anywhere. From
# /proc/<pid>/environ it reads ONLY the keys `name` and `pm_id` (set by PM2 and
# inherited by descendants); no other environ key is kept or logged.
#
# Usage: vizora-memwatch.sh [--once] [--stdout] [--log PATH] [--threshold-kb N]
#                           [--samples N] [--interval S]
# Always exits 0 — it is an observer and must never fail its cron noisily.
#
# Results pass through $REPLY / printf -v rather than $(...), so a sample costs no
# fork per process or per field — this runs on a box that is already starved.

LOG=/var/log/vizora-memwatch/memwatch.jsonl
LOCK=${MEMWATCH_LOCK:-/run/lock/vizora-memwatch.lock}
THRESHOLD_KB=51200 SAMPLES=4 INTERVAL=15 TO_STDOUT=0
export TZ=UTC

warn() { printf 'vizora-memwatch: %s\n' "$*" >&2; }

# JSON string body (no surrounding quotes) -> $REPLY. Escapes \ " and every
# control character.
json_escape() {
  local s=$1 out='' c i
  s=${s//\\/\\\\}; s=${s//\"/\\\"}
  s=${s//$'\n'/\\n}; s=${s//$'\r'/\\r}; s=${s//$'\t'/\\t}
  if [[ $s == *[[:cntrl:]]* ]]; then
    for ((i = 0; i < ${#s}; i++)); do
      c=${s:i:1}
      if [[ $c == [[:cntrl:]] ]]; then printf -v c '\\u%04x' "'$c"; fi
      out+=$c
    done
    s=$out
  fi
  REPLY=$s
}

# Redact secrets from an argv (passed as "$@"), join with spaces, truncate to 300
# -> $REPLY. Pass 1 works per argv token (exact); pass 2 re-runs on the joined
# string, which catches secrets inside one token, e.g. `sh -c "redis-cli -a pw"`.
# Redaction happens BEFORE truncation so a cut can never expose half a secret.
readonly SECRET_FLAGS='-a|--password|--pass|--token|--auth'
readonly SECRET_KEY='(PASS|SECRET|TOKEN|KEY|AUTH)'
redact_args() {
  local tok prev='' s m
  local -a toks=()
  shopt -s nocasematch
  for tok in "$@"; do
    if [[ $prev =~ ^($SECRET_FLAGS)$ ]]; then tok='<redacted>'
    elif [[ $tok != *[[:space:]]* && $tok =~ ^([^=]*$SECRET_KEY[^=]*)= ]]; then
      tok="${BASH_REMATCH[1]}=<redacted>"
    fi
    toks+=("$tok"); prev=$tok
  done
  s="${toks[*]}"
  # Each replacement yields a value starting with '<', which the patterns refuse,
  # so every loop strictly shrinks its set of matches and terminates.
  while [[ $s =~ (^|[[:space:]])($SECRET_FLAGS)[[:space:]]+[^\<[:space:]][^[:space:]]* ]]; do
    m=${BASH_REMATCH[0]}; s=${s/"$m"/"${BASH_REMATCH[1]}${BASH_REMATCH[2]} <redacted>"}
  done
  while [[ $s =~ ([^[:space:]=]*$SECRET_KEY[^[:space:]=]*)=[^\<[:space:]][^[:space:]]* ]]; do
    m=${BASH_REMATCH[0]}; s=${s/"$m"/"${BASH_REMATCH[1]}=<redacted>"}
  done
  while [[ $s =~ bearer[[:space:]]+[^[:space:]]+ ]]; do
    m=${BASH_REMATCH[0]}; s=${s/"$m"/<redacted>}
  done
  while [[ $s =~ ://[^/@[:space:]]+:[^/@[:space:]]+@ ]]; do
    m=${BASH_REMATCH[0]}; s=${s/"$m"/://<redacted>@}
  done
  shopt -u nocasematch
  REPLY=${s:0:300}
}

# jstr / jnum VAR VALUE: set VAR to a JSON string / number, or null when the value
# is empty / not numeric.
jstr() { if [[ -n $2 ]]; then json_escape "$2"; printf -v "$1" '"%s"' "$REPLY"; else printf -v "$1" null; fi; }
jnum() { if [[ $2 =~ ^-?[0-9]+(\.[0-9]+)?$ ]]; then printf -v "$1" '%s' "$2"; else printf -v "$1" null; fi; }

# One process as a JSON object -> $PJ. Returns 1 if it is below threshold (and not
# an orphan under user.slice), a kernel thread, or vanished mid-read (ENOENT).
proc_json() {
  local pid=$1 k v _ rss='' swap=0 ppid='' stat rest cg='' line name='' pmid=''
  local start jp jg jn ji ja
  local -a f argv envv
  PJ=
  while read -r k v _; do
    case $k in PPid:) ppid=$v ;; VmRSS:) rss=$v ;; VmSwap:) swap=$v ;; esac
  done 2>/dev/null <"/proc/$pid/status"
  [[ $rss =~ ^[0-9]+$ && $swap =~ ^[0-9]+$ && $ppid =~ ^[0-9]+$ ]] || return 1
  ((rss + swap >= THRESHOLD_KB || ppid == 1)) || return 1
  while IFS= read -r line; do
    [[ $line == 0::* ]] && cg=${line#0::}
  done 2>/dev/null <"/proc/$pid/cgroup"
  if ((rss + swap < THRESHOLD_KB)) && [[ $cg != */user.slice* ]]; then return 1; fi
  stat=$(<"/proc/$pid/stat") 2>/dev/null || return 1
  rest=${stat##*) }; read -r -a f <<<"$rest"   # f[n-3] is stat field n (comm-safe)
  mapfile -d '' -t argv 2>/dev/null <"/proc/$pid/cmdline" || return 1
  mapfile -d '' -t envv 2>/dev/null <"/proc/$pid/environ"
  for line in "${envv[@]}"; do
    case $line in name=*) name=${line#name=} ;; pm_id=*) pmid=${line#pm_id=} ;; esac
  done
  envv=()
  printf -v start '"%(%Y-%m-%dT%H:%M:%SZ)T"' $((BTIME + ${f[19]:-0} / CLK_TCK))
  jnum jp "${f[2]}"; jstr jg "$cg"; jstr jn "$name"; jnum ji "$pmid"
  redact_args "${argv[@]}"; jstr ja "$REPLY"
  printf -v PJ '{"pid":%s,"ppid":%s,"pgid":%s,"start":%s,"rss_kb":%s,"swap_kb":%s,"cgroup":%s,"pm2_name":%s,"pm2_id":%s,"args":%s}' \
    "$pid" "$ppid" "$jp" "$start" "$rss" "$swap" "$jg" "$jn" "$ji" "$ja"
}

# One sample line -> $OUT.
sample() {
  local k v _ kind a10 a60 mavail='' mtotal='' stot='' sfree='' load1='' p procs='' sep=''
  local ps10='' ps60='' pf10='' pf60='' a b c d e g h i n
  while read -r k v _; do
    case $k in MemAvailable:) mavail=$v ;; MemTotal:) mtotal=$v ;;
               SwapTotal:) stot=$v ;; SwapFree:) sfree=$v ;; esac
  done 2>/dev/null </proc/meminfo
  while read -r kind a10 a60 _; do
    a10=${a10#avg10=}; a60=${a60#avg60=}
    case $kind in some) ps10=$a10 ps60=$a60 ;; full) pf10=$a10 pf60=$a60 ;; esac
  done 2>/dev/null </proc/pressure/memory
  read -r load1 _ 2>/dev/null </proc/loadavg
  for p in /proc/[0-9]*; do
    proc_json "${p#/proc/}" || continue
    procs+=$sep$PJ; sep=,
  done
  jnum a "$mavail"; jnum b "$mtotal"; jnum c "$stot"; jnum d "$sfree"
  jnum e "$ps10"; jnum g "$ps60"; jnum h "$pf10"; jnum i "$pf60"; jnum n "$load1"
  printf -v OUT '{"ts":"%(%Y-%m-%dT%H:%M:%SZ)T","mem_available_kb":%s,"mem_total_kb":%s,"swap_total_kb":%s,"swap_free_kb":%s,"psi_some_avg10":%s,"psi_some_avg60":%s,"psi_full_avg10":%s,"psi_full_avg60":%s,"load1":%s,"procs":[%s]}' \
    -1 "$a" "$b" "$c" "$d" "$e" "$g" "$h" "$i" "$n" "$procs"
}

main() {
  local k v i
  while (($#)); do
    case $1 in
      --once) SAMPLES=1 ;;
      --stdout) TO_STDOUT=1 ;;
      --log) LOG=$2; shift ;;
      --threshold-kb) THRESHOLD_KB=$2; shift ;;
      --samples) SAMPLES=$2; shift ;;
      --interval) INTERVAL=$2; shift ;;
      *) warn "unknown argument: $1"; exit 0 ;;
    esac
    shift
  done
  [[ $THRESHOLD_KB =~ ^[0-9]+$ && $SAMPLES =~ ^[0-9]+$ && $INTERVAL =~ ^[0-9]+$ ]] \
    || { warn 'numeric flags must be non-negative integers'; exit 0; }
  umask 027   # new dir 0750, new log file 0640
  if ((!TO_STDOUT)); then
    # Never stack invocations on a starved box: a second run just leaves.
    { exec 9>>"$LOCK"; } 2>/dev/null && flock -n 9 || exit 0
    mkdir -p "${LOG%/*}" 2>/dev/null && : >>"$LOG" 2>/dev/null \
      || { warn "cannot write $LOG"; exit 0; }
  fi
  BTIME=0; CLK_TCK=$(getconf CLK_TCK 2>/dev/null) || CLK_TCK=100
  while read -r k v; do [[ $k == btime ]] && BTIME=$v; done 2>/dev/null </proc/stat
  for ((i = 0; i < SAMPLES; i++)); do
    ((i)) && sleep "$INTERVAL"
    sample
    if ((TO_STDOUT)); then printf '%s\n' "$OUT"
    else printf '%s\n' "$OUT" >>"$LOG" 2>/dev/null || { warn "write to $LOG failed"; exit 0; }
    fi
  done
  exit 0
}

if [[ ${BASH_SOURCE[0]} == "$0" ]]; then
  # Re-exec at the lowest CPU and IO priority so the observer never competes with
  # the workload it is watching.
  if [[ -z ${MEMWATCH_NICED:-} ]]; then
    export MEMWATCH_NICED=1
    if command -v ionice >/dev/null 2>&1; then exec nice -n 19 ionice -c3 bash "$0" "$@"; fi
    exec nice -n 19 bash "$0" "$@"
  fi
  main "$@"
fi
