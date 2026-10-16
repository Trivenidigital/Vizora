# vizora-memwatch — host memory sampler for OOM attribution

## Purpose

With `vm.oom_dump_tasks=1` the kernel OOM report already lists every pid with its
`rss` / `swapents` at the moment of a kill — but only a 15-character `comm` (`node`).
That is not enough to say *which* node: the victim pid cannot be mapped to a command
line, a parent, a start time or a PM2 app after the fact.

This sampler records that mapping continuously (every 15 s) so the next OOM can be
joined **by pid**.

**It is read-only.** It reads `/proc` and writes one log file. It changes no workload,
restarts nothing, sends nothing off the box, and runs at `nice 19` / `ionice` idle
behind a non-blocking `flock`, so overlapping runs on a starved box skip rather than
stack. From `/proc/<pid>/environ` it reads **only** the keys `name` and `pm_id` (PM2
sets them and every descendant inherits them, which is what makes a forked child
attributable to its PM2 app); no other environ key is kept or logged. Command lines
are redacted before they are written (see "Redaction").

It always exits 0 — an observer must never fail its cron noisily — and writes a single
stderr line if it cannot write its log.

## Files

| Repo file | Installed as | Mode |
|---|---|---|
| `vizora-memwatch.sh` | `/usr/local/sbin/vizora-memwatch.sh` | 0755 |
| `vizora-memwatch.cron` | `/etc/cron.d/vizora-memwatch` | 0644 |
| `vizora-memwatch.logrotate` | `/etc/logrotate.d/vizora-memwatch` | 0644 |
| `test-memwatch.sh` | not installed — fixture tests for redaction + JSON escaping | |

Like `deploy/nginx/`, these are host-installed and copied deliberately; nothing
generates them.

## Install

```bash
install -m 0755 vizora-memwatch.sh        /usr/local/sbin/vizora-memwatch.sh
install -m 0644 vizora-memwatch.logrotate /etc/logrotate.d/vizora-memwatch
install -d -m 0750 /var/log/vizora-memwatch

# Eyeball one sample BEFORE enabling the cron (stdout mode takes no lock, writes no file):
/usr/local/sbin/vizora-memwatch.sh --once --stdout

# Enable (cron.d files must be 0644 and root-owned, and the filename must not contain a dot):
install -m 0644 vizora-memwatch.cron /etc/cron.d/vizora-memwatch
```

After a couple of minutes: `tail -n1 /var/log/vizora-memwatch/memwatch.jsonl` and
`ls -l /var/log/vizora-memwatch/` (dir 0750, file 0640 root).

Flags: `--once` (1 sample), `--stdout`, `--log PATH`, `--threshold-kb N` (default
51200 = 50 MB), `--samples N` (default 4), `--interval S` (default 15).

## Uninstall

```bash
rm -f /etc/cron.d/vizora-memwatch /usr/local/sbin/vizora-memwatch.sh /etc/logrotate.d/vizora-memwatch
rm -f /run/lock/vizora-memwatch.lock
rm -rf /var/log/vizora-memwatch     # optional — the logs are the point; keep them if an OOM is under investigation
```

Removing the cron file alone stops all sampling.

## What a line contains

One JSON object per sample:

- `ts`, `mem_available_kb`, `mem_total_kb`, `swap_total_kb`, `swap_free_kb` (`/proc/meminfo`)
- `psi_some_avg10`, `psi_some_avg60`, `psi_full_avg10`, `psi_full_avg60` (`/proc/pressure/memory`; `null` if absent), `load1`
- `procs`: every process with `VmRSS + VmSwap >= threshold`, **plus** every process
  with `ppid == 1` whose cgroup is under `user.slice` (likely orphans of an ssh
  session). Each entry: `pid` (always the first key), `ppid`, `pgid`, `start` (UTC,
  from `/proc/<pid>/stat` starttime + `btime`), `rss_kb`, `swap_kb`, `cgroup` (the
  `0::` line), `pm2_name`, `pm2_id`, `args`.

A process that exits mid-read is silently skipped.

## Expected size

A header-only line is ~300 bytes; each process entry is ~200–550 bytes (`args` is
capped at 300 chars). On the prod VPS expect roughly 10–20 processes over 50 MB, i.e.
~3–8 KB per sample. At 5,760 samples/day that is **~20–45 MB/day uncompressed**,
typically ~10x smaller gzipped — so 14 rotations is a few tens of MB on disk.
Measure the real figure after a day with `ls -l /var/log/vizora-memwatch/`.

`maxsize 50M` only takes effect when logrotate runs, which on Ubuntu 24.04 is the
daily `logrotate.timer`; it is a ceiling for an unusual day, not an intra-day cap.

## How to attribute an OOM kill

```bash
# 1. The victim pid (and the time of the kill)
journalctl -k | grep "Out of memory: Killed process"
#   ... Out of memory: Killed process 123456 (node) total-vm:... anon-rss:...

# 2. Every sample of that pid — args, ppid, pm2_name, start time, rss/swap trend
cd /var/log/vizora-memwatch
grep  '"pid":123456,' memwatch.jsonl memwatch.jsonl.1
zgrep '"pid":123456,' memwatch.jsonl.*.gz

# 3. Walk the parent chain: repeat step 2 with the ppid from the matching entries,
#    up to the PM2 daemon or pid 1. Use samples from just before the kill —
#    pids are reused, so check `start` matches across the entries you join.
```

`pm2_name` / `pm2_id` name the PM2 app even for a forked child (a build, a `tsx`
ops agent, a worker), because PM2 exports them into the app's environment and
children inherit it. `null` means the process is not descended from PM2.

The pressure fields show whether the box was already thrashing (`psi_full_avg10`
rising) in the minutes before the kill.

## Redaction

`args` is redacted **before** it is truncated, so a cut can never expose half a
secret. Replaced with `<redacted>`:

- the token after `-a`, `--password`, `--pass`, `--token`, `--auth`
  (`-a` is over-redacted on purpose — e.g. `exec -a name` — `-p` is not touched
  because it is usually a port)
- the value of any `KEY=VALUE` token whose KEY matches `PASS|SECRET|TOKEN|KEY|AUTH`
  (case-insensitive; the key name is kept: `PGPASSWORD=<redacted>`)
- `Bearer <anything>`, and URL credentials `scheme://user:pass@` → `scheme://<redacted>@`

The rules run per argv token and again over the joined command line, so secrets
inside one token (`sh -c "redis-cli -a pw ping"`) are caught too. **Known residual:**
a quoted secret containing a space inside an `sh -c` string leaks the part after the
space (the joined-string pass cannot see shell quoting); `test-memwatch.sh` pins this.

## Tests

`bash test-memwatch.sh` — fixture tests for redaction and JSON escaping. Pure bash
(>= 4.4), runs in Git Bash. It does not exercise the `/proc` paths; those were
verified in an `ubuntu:24.04` container (output parsed as JSON, 0750/0640 modes,
lock-skip, ~0.13 s per sample over 300 processes).
