#!/usr/bin/env bash
# Linux-only check of the /proc paths, meant to run as root in a throwaway container:
#   docker run --rm -v "$PWD:/m:ro" ubuntu:24.04 bash /m/container-test-memwatch.sh
# It builds a chain top.sh -> mid.sh -> leaf.sh, where only the leaf is large (~80 MB),
# and asserts that its small parents are emitted, each once, with the PM2 env attributed.

M=$(dirname "${BASH_SOURCE[0]}")
pass=0 fail=0
check() { if eval "$2"; then pass=$((pass + 1)); echo "ok   $1"; else fail=$((fail + 1)); echo "FAIL $1"; fi; }

printf '%s\n' "s=\$(head -c 80000000 /dev/zero | tr '\\0' a); sleep 120" >/tmp/leaf.sh
printf '%s\n' 'bash /tmp/leaf.sh; true' >/tmp/mid.sh
printf '%s\n' 'bash /tmp/mid.sh; true' >/tmp/top.sh
(export name=vizora-fake pm_id=7 SECRET_X=dontlogme; bash /tmp/top.sh) &
# ubuntu:24.04 ships no procps, so find pids from /proc directly.
pidof_cmd() { local c; local -a a; for c in /proc/[0-9]*; do mapfile -d "" -t a 2>/dev/null <"$c/cmdline"; [[ ${a[0]-} == bash && ${a[1]-} == "$1" ]] && { echo "${c#/proc/}"; return; }; done; }
for _ in $(seq 60); do
  sleep 0.5; leaf=$(pidof_cmd /tmp/leaf.sh)
  [[ -n $leaf ]] && (($(awk '/^VmRSS/{print $2}' "/proc/$leaf/status") > 60000)) && break
done
mid=$(pidof_cmd /tmp/mid.sh); top=$(pidof_cmd /tmp/top.sh)
echo "chain: top=$top mid=$mid leaf=$leaf"

out=$(bash "$M/vizora-memwatch.sh" --once --stdout)
entry() { grep -o "{\"pid\":$1,[^}]*}" <<<"$out"; }
echo "$(entry "$leaf")"; echo "$(entry "$mid")"; echo "$(entry "$top")"

check 'leaf (big) emitted'          '[[ -n $(entry "$leaf") ]]'
check 'mid (small parent) emitted'  '[[ -n $(entry "$mid") ]]'
check 'top (grandparent) emitted'   '[[ -n $(entry "$top") ]]'
check 'leaf ppid is mid'            '[[ $(entry "$leaf") == *"\"ppid\":$mid,"* ]]'
check 'mid is below threshold'      '[[ $(entry "$mid") =~ \"rss_kb\":([0-9]+), ]] && ((BASH_REMATCH[1] < 51200))'
check 'pm2_name inherited by leaf'  '[[ $(entry "$leaf") == *"\"pm2_name\":\"vizora-fake\",\"pm2_id\":7,"* ]]'
check 'no duplicate pids'           '[[ -z $(grep -o "\"pid\":[0-9]*," <<<"$out" | sort | uniq -d) ]]'
check 'pid 1 not walked into'       '[[ -z $(entry 1) ]]'
check 'other environ never logged'  '[[ $out != *dontlogme* ]]'

kill "$top" "$mid" "$leaf" 2>/dev/null
printf '\n%d passed, %d failed\n' "$pass" "$fail"
((fail == 0))
