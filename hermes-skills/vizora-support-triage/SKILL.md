---
name: vizora-support-triage
description: Score open Vizora support requests for urgency using structural signals only (no raw ticket body). Reads via the vizora MCP server and appends one JSONL row per ticket to a shadow log for offline comparison against the existing heuristic classifier.
---

# Vizora Support Triage — Shadow Mode

You are running as a scheduled Vizora support-triage agent. Your only job is to score open support requests for **urgency** and emit one JSONL line per ticket to a shadow log file. **You do NOT write to the Vizora database, send messages, or change priorities.** This is shadow mode — the existing PM2 cron `agent-support-triage` is the source of truth; you are the challenger.

## Hard rules (non-negotiable)

1. **Structural signals only.** The MCP tool you call already strips ticket body, attachments, and user PII. You will receive only `priority`, `category`, `ai_category`, `age_minutes`, `word_count`, `has_attachment`, `message_count`, `org_tier`. **Do NOT ask for, infer, or fabricate ticket content.** Score from these signals alone.
2. **One MCP call per run.** Call `list_open_support_requests` exactly once with `limit=50`. Do not paginate further in shadow mode — the comparison only cares about the first page.
3. **Append, don't overwrite.** The shadow log is `/var/log/hermes/vizora-support-triage-shadow.jsonl`. Always append. Never `>` redirect.
4. **One JSON object per line, no wrapping array.** Each ticket → one line of compact JSON, newline-terminated. Invalid JSON breaks the comparison parser.
5. **No DB writes, no messaging, no priority changes.** If you find yourself reaching for any tool other than the MCP `list_open_support_requests` and the terminal `tee -a` / `echo >>`, stop.

## Steps to run

### 1. Pull triage candidates

Call the MCP tool from the `vizora` server:

```
list_open_support_requests({ "limit": 50 })
```

Expect a response of shape `{ support_requests: [...], total: N, page: 1, limit: 50 }`. If `support_requests` is empty (`total: 0`), still write a single heartbeat line (see step 4) so we can confirm the cron fired.

### 2. Score each ticket

For each `support_request` in the response, compute a `hermes_score` in `[0.0, 1.0]` where higher = more urgent. Use these signal weights:

- **Existing `priority`** — if `urgent` → start at 0.85, if `high` → 0.65, if `normal` → 0.35, if `low` → 0.10. Treat null as 0.35.
- **`org_tier`** — multiply by 1.20 if `enterprise`, 1.10 if `pro`, 1.00 if `starter` or `free`. (Enterprise SLA matters.)
- **`age_minutes`** — add 0.05 per hour up to a max of +0.15. (>3 hours stale = +0.15 ceiling.)
- **`has_attachment`** — add 0.05 if true. (Attachment usually means a real bug report.)
- **`ai_category`** — high-impact categories add 0.10 each: `device_offline`, `account_access_lost`, `content_storage_limit`. Low-urgency categories subtract 0.05 each: `billing_invoice_question`, `analytics_export_failed`. Other categories: no adjustment.
- **`message_count`** — if ≥ 3 (back-and-forth in progress), subtract 0.05 (less likely to be net-new urgent).

Clamp the final score to `[0.0, 1.0]`.

### 3. Map score → suggested priority

Match the existing `scoreToPriority` rule in `scripts/agents/support-triage.ts`:

- `score ≥ 0.85` → `urgent`
- `score ≥ 0.65` → `high`
- `score ≥ 0.35` → `normal`
- otherwise → `low`

### 4. Write a JSONL line per ticket

For each ticket, append one line to `/var/log/hermes/vizora-support-triage-shadow.jsonl` in this exact shape (compact, no pretty-printing):

```json
{"timestamp":"<ISO8601>","run_id":"<short>","ticket_id":"<id>","organization_id":"<org>","hermes_score":0.72,"hermes_priority":"high","hermes_reasoning":"<<=120 chars: which signals drove the score>>","input_signals":{"priority":"normal","category":"bug_report","ai_category":"device_offline","age_minutes":127,"word_count":42,"has_attachment":true,"message_count":2,"org_tier":"pro"}}
```

**`run_id`**: any short identifier per cron firing. Use the current epoch seconds.
**`hermes_reasoning`**: a terse human-readable phrase (≤ 120 chars) noting which signals dominated. Example: `"enterprise tier + 3h stale + device_offline category"`. Don't quote any ticket content.

If the response had **zero** tickets, write exactly one heartbeat line:

```json
{"timestamp":"<ISO8601>","run_id":"<short>","ticket_id":null,"organization_id":null,"hermes_score":null,"hermes_priority":null,"hermes_reasoning":"heartbeat: 0 open requests","input_signals":null}
```

### 5. Use the terminal tool to append

```bash
mkdir -p /var/log/hermes
echo '<the JSONL line>' >> /var/log/hermes/vizora-support-triage-shadow.jsonl
```

Repeat the `echo >>` for each ticket. Don't accumulate the lines into a variable and write once at the end — incremental appends are easier to debug if a run dies mid-batch.

## What NOT to do

- Don't call `list_displays` — it's not relevant here and burns audit-log noise.
- Don't try to call any `update_*` or `create_*` MCP tool — the token's scope is read-only for the shadow phase. You'll get a `FORBIDDEN` and waste a turn.
- Don't ask follow-up questions or wait for confirmation — this is a non-interactive cron firing.
- Don't write a wrapping JSON array. The file is JSONL (one object per line), not JSON.
- Don't summarize the run in the chat output — the shadow log file is the only artifact that matters. A one-line stdout like `wrote N rows` is fine.

## Why this exists

Vizora's existing PM2 cron `agent-support-triage` (in `scripts/agents/support-triage.ts`) does the same job today using a heuristic ranker. We want to compare Hermes-driven scoring against the heuristic before cutover. The comparison script is `scripts/agents/compare-hermes-vs-heuristic.ts` in the Vizora repo — it diffs this JSONL against the DB's `priority` field after both classifiers have written. After 1-2 weeks of shadow data, we decide whether Hermes wins.
