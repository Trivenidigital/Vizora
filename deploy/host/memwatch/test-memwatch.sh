#!/usr/bin/env bash
# Fixture tests for vizora-memwatch.sh's pure functions (redaction + JSON escaping).
# Runs anywhere bash >= 4.4 runs, including Git Bash: `bash test-memwatch.sh`.
# The /proc-reading paths are NOT covered here — they need a Linux host.

# shellcheck source=vizora-memwatch.sh
source "$(dirname "${BASH_SOURCE[0]}")/vizora-memwatch.sh"
pass=0 fail=0

check() { # name expected actual
  if [[ $2 == "$3" ]]; then pass=$((pass + 1)); printf 'ok   %s\n' "$1"
  else fail=$((fail + 1)); printf 'FAIL %s\n     want: %s\n     got:  %s\n' "$1" "$2" "$3"; fi
}
redact() { redact_args "$@"; printf '%s' "$REPLY"; }
esc() { json_escape "$1"; printf '%s' "$REPLY"; }

# --- redaction, per-argv-token ---
check 'redis-cli -a'      'redis-cli -a <redacted> info'           "$(redact redis-cli -a s3cret info)"
check '--password flag'   'mysql --password <redacted> db'         "$(redact mysql --password hunter2 db)"
check '--token / --auth'  'x --token <redacted> --auth <redacted>' "$(redact x --token t1 --auth a1)"
check 'PGPASSWORD=x'      'PGPASSWORD=<redacted> psql -U postgres' "$(redact PGPASSWORD=x psql -U postgres)"
check 'lowercase key='    'api_key=<redacted> run'                 "$(redact api_key=abc run)"
check '--password=x form' '--password=<redacted>'                  "$(redact --password=x)"
check 'URL creds'         'psql postgresql://<redacted>@host:5432/db' "$(redact psql postgresql://u:p@host:5432/db)"
check 'https URL creds'   'curl https://<redacted>@host'           "$(redact curl https://u:p@host)"
check 'Bearer (one token)' 'curl -H Authorization: <redacted>'     "$(redact curl -H 'Authorization: Bearer abc')"
check 'Bearer (split)'    'curl <redacted> x'                      "$(redact curl Bearer abc x)"
# --- redaction, secrets embedded inside a single argv token (sh -c) ---
check 'sh -c redis -a'    'sh -c redis-cli -a <redacted> ping'     "$(redact sh -c 'redis-cli -a s3cret ping')"
check 'sh -c KEY=VALUE'   'sh -c PGPASSWORD=<redacted> psql'       "$(redact sh -c 'PGPASSWORD=x psql')"
# --- must NOT redact ---
check 'node flags kept'   'node --max-old-space-size=2048 dist/main.js' "$(redact node --max-old-space-size=2048 dist/main.js)"
check 'redis -p port kept' 'redis-cli -p 6379'                     "$(redact redis-cli -p 6379)"
check 'plain URL kept'    'curl https://vizora.cloud/api'          "$(redact curl https://vizora.cloud/api)"
# --- truncation happens after redaction ---
long=$(printf 'a%.0s' {1..400})
out=$(redact x "$long" -a secretsecret)
check 'truncated to 300'  300 "${#out}"
out=$(redact -a "$(printf 'S%.0s' {1..290})" tail)
check 'redacted then cut' '-a <redacted> tail' "$out"

# --- JSON escaping ---
check 'quotes'      'say \"hi\"'      "$(esc 'say "hi"')"
check 'backslash'   'C:\\path\\x'     "$(esc 'C:\path\x')"
json_escape $'a\nb\tc\rd'   # not via $(...): msys bash strips CR from substitutions
check 'newline+tab+cr' 'a\nb\tc\rd' "$REPLY"
check 'other ctrl'  'x\u0001y\u001bz' "$(esc $'x\x01y\x1bz')"
check 'plain'       'node dist/main.js' "$(esc 'node dist/main.js')"

# --- end to end: redacted + escaped args are valid JSON (when node is around) ---
# KNOWN RESIDUAL: a quoted secret containing a space INSIDE an sh -c string leaks
# its tail (" w\"" below) — pass 2 cannot see shell quoting. Pinned, not hidden.
redact_args sh -c $'PGPASSWORD="p w" psql -c "select 1"\tdone'; jstr j "$REPLY"
check 'jstr wraps' '"sh -c PGPASSWORD=<redacted> w\" psql -c \"select 1\"\tdone"' "$j"
if command -v node >/dev/null 2>&1; then
  check 'node parses jstr' 'ok' "$(node -e 'JSON.parse(process.argv[1]); console.log("ok")' "$j" 2>&1)"
fi
jnum n ''; check 'jnum empty -> null' null "$n"
jnum n '0.42'; check 'jnum decimal' 0.42 "$n"
jstr n ''; check 'jstr empty -> null' null "$n"

printf '\n%d passed, %d failed\n' "$pass" "$fail"
((fail == 0))
