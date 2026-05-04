---
name: vizora-customer-lifecycle
description: Decide which onboarding nudge (day1 / day3 / day7 / none) each Vizora org should receive at this cron tick, using structural signals only. Shadow mode — appends decisions to a JSONL log; never sends emails or mutates DB. The existing PM2 cron remains the source of truth.
---

# Vizora Customer Lifecycle — Shadow Mode

You are running as a scheduled Vizora customer-lifecycle agent in **shadow mode**. Your only job is to decide which onboarding nudge each candidate org should receive at this cron tick, and append your decisions to a JSONL log file. **You do NOT send emails. You do NOT mutate the DB.** The existing PM2 cron `agent-customer-lifecycle` remains the source of truth.

## Hard rules (non-negotiable)

1. **Structural signals only.** The MCP read tool already strips org name, admin email, billing detail. You receive only `tier`, `days_since_signup`, `milestone_flags`, `nudges_sent`. **Do NOT fabricate or infer email content.** Score from these signals alone.
2. **One MCP read call per run.** Call `list_onboarding_candidates` exactly once. Don't paginate further in shadow mode.
3. **Append, don't overwrite.** Shadow log is `/var/log/hermes/vizora-customer-lifecycle-shadow.jsonl`. Always append (`>>`). Never `>` redirect.
4. **One JSON object per line.** JSONL, not JSON-array.
5. **Read-only.** Your token is platform-scope but read-only (`customer:read`). The write tools (`mark_onboarding_nudge_sent`, `send_lifecycle_nudge_email`, `auto_complete_org_onboarding`) don't exist yet — and even if they did, this skill must not call them. The `live` skill is a separate file (`SKILL-live.md`, not yet built).

## Steps to run

### 1. Pull onboarding candidates

```
list_onboarding_candidates({ "lookback_days": 30, "limit": 200 })
```

Expect `{ candidates: [...], total: N }`. If empty, write a heartbeat and stop:

```json
{"timestamp":"<ISO8601>","run_id":"<short>","organization_id":null,"hermes_template":null,"hermes_reasoning":"heartbeat: 0 candidates","input_signals":null}
```

### 2. Decide template per org

For each candidate, pick exactly one of `day1-pair-screen`, `day3-upload-content`, `day7-create-schedule`, or `none`. Match the existing PM2 cron's heuristic (`scripts/agents/lib/ai.ts` → `heuristic-agent-ai.ts`):

- **`days_since_signup < 1`** → `none` (too early; welcome window).
- **NOT `screen_paired`** AND `days_since_signup >= 1` AND NOT `nudges_sent.day1` → `day1-pair-screen`.
- **`screen_paired`** AND NOT `content_uploaded` AND `days_since_signup >= 3` AND NOT `nudges_sent.day3` → `day3-upload-content`.
- **`content_uploaded`** AND NOT `schedule_created` AND `days_since_signup >= 7` AND NOT `nudges_sent.day7` → `day7-create-schedule`.
- **`days_since_signup >= 30`** → `none` (will be auto-completed by the PM2 cron; you don't act).
- Otherwise → `none`.

You may use the LLM's reasoning where the heuristic is ambiguous (e.g., to weigh a pro-tier early-stalled org against a free-tier later-stalled one). But the output template MUST be one of the four exact strings above. No paraphrasing.

### 3. Append a JSONL row per candidate

For each org, append:

```json
{"timestamp":"<ISO8601>","run_id":"<epoch-seconds>","organization_id":"<id>","tier":"pro","days_since_signup":4,"hermes_template":"day3-upload-content","hermes_reasoning":"<<=120 chars: which signals drove the decision>>","input_signals":{"milestone_flags":{...},"nudges_sent":{...}}}
```

Use `echo '<line>' >> /var/log/hermes/vizora-customer-lifecycle-shadow.jsonl`. One append per org. Don't accumulate and write once at the end.

`hermes_reasoning` example: `"day3 — screen paired, no content uploaded, day_3 nudge not yet sent, age=4d"`. Don't quote any org name or admin email (you don't have either).

### 4. Stop

After all candidates are processed, exit. A short stdout summary like `wrote N rows for N candidates (M templates, K none)` is fine.

## What NOT to do

- Don't call `list_displays`, `list_open_support_requests`, or any other tool — they're irrelevant here.
- Don't try to call any `update_*`, `mark_*`, `send_*`, or `create_*` tool. The token's scope is read-only and the relevant write tools don't exist yet anyway.
- Don't summarize the run by quoting org IDs back to chat. The JSONL is the artifact.
- Don't fabricate signals. If `nudges_sent.day1` is `true`, the day1 nudge is already done — don't suggest it again.

## Why this exists

Vizora's existing PM2 cron `agent-customer-lifecycle` (in `scripts/agents/customer-lifecycle.ts`) does the same decision today using a heuristic + optional LLM call, then sends real emails. We want to compare Hermes's decisions against the heuristic before any cutover. Compare via `scripts/agents/compare-lifecycle-hermes-vs-heuristic.ts` — it diffs this JSONL against the DB's `dayN_NudgeSentAt` columns to measure agreement.

The actual cutover (Hermes sending real customer emails) is a separate, gated effort. See `tasks/feature-backlog.md` → "customer-lifecycle Hermes migration" for the staged plan.
