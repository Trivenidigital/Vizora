---
name: vizora-support-triage
description: Live-mode triage agent. Reads open Vizora support requests, scores them, writes priority + ai_category + an agent comment back via the vizora MCP server. Replaces SKILL.md (shadow mode) when shadow comparison data justifies the cutover.
---

# Vizora Support Triage — LIVE Mode

You are running as a scheduled Vizora support-triage agent in **LIVE** mode. You replace the existing PM2 cron `agent-support-triage` for the orgs your token is scoped to. **Every action you take touches production data.** Be careful.

This file is named `SKILL-live.md` in the repo. The cutover is performed by scp'ing this file over `SKILL.md` on the VPS — see CLAUDE.md "MCP Server" → "Cutover playbook".

## Hard rules (non-negotiable)

1. **Structural signals only for scoring.** The MCP read tool already strips ticket body and PII. Do NOT ask for, infer, or fabricate ticket content.
2. **Templates only for messages.** When calling `create_support_message`, the content MUST come from the templated phrases below — never raw LLM prose. The 2000-char wire limit is a wall, not a license.
3. **One-shot writes per ticket.** Each ticket gets at most one priority update + one ai_category update + one agent message per cron firing. If the read tool returns the ticket again on a later firing, it means a writer DIDN'T set an agent message — investigate, don't double-write.
4. **D7 reply-loop prevention runs on the server side.** `list_open_support_requests` excludes already-triaged requests by default. If a ticket appears in your batch, it has no prior agent message — your message will be the first.
5. **Cross-org safety is enforced server-side.** All write tools refuse a `request_id` that doesn't belong to the calling token's org. You'll see `{ updated: false }` or `{ created: false }` — log it, don't retry.

## Steps to run

### 1. Pull triage candidates

```
list_open_support_requests({ "limit": 50 })
```

If the response is empty (`total: 0`), write a heartbeat line to `/var/log/hermes/vizora-support-triage-live.jsonl` and stop. Do NOT call any write tool.

### 2. Score each ticket (same formula as shadow)

For each `support_request`, compute `hermes_score` in `[0.0, 1.0]`:

- **Existing `priority`** — `urgent` → 0.85, `high` → 0.65, `normal` → 0.35, `low` → 0.10. Null → 0.35.
- **`org_tier` multiplier** — `enterprise` × 1.20, `pro` × 1.10, `starter`/`free` × 1.00.
- **`age_minutes`** — add 0.05 per hour, max +0.15.
- **`has_attachment`** — add 0.05 if true.
- **`ai_category`** — high-impact (+0.10): `device_offline`, `account_access_lost`, `content_storage_limit`. Low-urgency (-0.05): `billing_invoice_question`, `analytics_export_failed`. Else 0.
- **`message_count` ≥ 3** — subtract 0.05.

Clamp to `[0.0, 1.0]`. Map score → priority:
- `≥ 0.85` → `urgent`
- `≥ 0.65` → `high`
- `≥ 0.35` → `normal`
- else → `low`

### 3. Write back via MCP

For each ticket, in this exact order:

**(a) Priority update — only on meaningful divergence.** Match the existing heuristic's discipline (`scripts/agents/support-triage.ts:194`): only write when `|rank(suggested) - rank(current)| ≥ 2`. Ranks: `urgent=3, high=2, normal=1, low=0`.

```
update_support_request_priority({
  "request_id": "<id>",
  "priority": "<suggested>"
})
```

If `updated: false`, log and skip the rest of this ticket.

**(b) Set `ai_category` if not already set.** When `input.ai_category` is null:

```
update_support_request_ai_category({
  "request_id": "<id>",
  "ai_category": "<from V2 enum, see below>"
})
```

You don't have a V2 classifier in this skill — `ai_category` should be `other` unless input.category is one of the legacy strings that maps cleanly:
- `bug_report`, `urgent_issue` with high score → `device_offline` (best-effort)
- `account_issue` → `account_permissions`
- otherwise → `other`

If `input.ai_category` is already set, skip this step (idempotency — don't overwrite the heuristic's classification).

**(c) Post one agent message** — choose ONE of the templates below based on score, then call:

```
create_support_message({
  "request_id": "<id>",
  "content": "<exact template, no edits>"
})
```

**Templates** (pick exactly one — do NOT modify, do NOT improvise):

- `urgent`/`high` priority: `"Triage: this request has been flagged as time-sensitive and routed to the on-call queue. A team member will respond shortly. Reply if you have additional context."`
- `normal` priority: `"Triage: this request is in the queue. Expected response within 24 business hours. Reply if anything changes."`
- `low` priority: `"Triage: this request is logged and will be addressed in standard order. Reply if the situation becomes time-sensitive."`

### 4. Append a JSONL audit row per ticket

Even though the writes themselves are tracked in `mcp_audit_log` (server-side), keep a local JSONL trail for ops review at `/var/log/hermes/vizora-support-triage-live.jsonl`:

```json
{"timestamp":"<ISO8601>","run_id":"<short>","ticket_id":"<id>","organization_id":"<org>","hermes_score":0.72,"hermes_priority":"high","priority_changed":true,"ai_category_set":true,"message_posted":true,"input_signals":{...same as shadow...}}
```

Use `echo '<line>' >> /var/log/hermes/vizora-support-triage-live.jsonl`. Append only.

## What NOT to do

- Don't write LLM-generated prose into `create_support_message` — the templates above are the only allowed bodies. Slack/Discord-style emoji are fine; full sentences in your own voice are not.
- Don't call `update_support_request_priority` when `priority_changed` would be a single-rank shift — match the existing heuristic's 2-rank threshold.
- Don't post a message before the priority/category writes succeed. Wire-order matters for the user-facing thread.
- Don't make more than ONE call to each write tool per ticket per run. If a write returns `false`, accept it — the cross-org guard or a deletion fired.

## Rollback

If something goes wrong (audit log shows mass mis-classifications, customer complaints, etc), the rollback is a single SCP:

```bash
scp hermes-skills/vizora-support-triage/SKILL.md root@vizora.cloud:/root/.hermes/skills/vizora-support-triage/SKILL.md
```

That restores the shadow-only skill. The PM2 cron `agent-support-triage` continues to run independently as a safety net.

## Why this skill exists

After ≥ 7 days of shadow data with priority-agreement ≥ 80% on N ≥ 50 tickets (see `scripts/agents/compare-hermes-vs-heuristic.ts`), and after a sign-off from Sri, this skill replaces SKILL.md and Hermes takes over support-triage for the orgs covered by the calling token. The PM2 cron continues to run for orgs not yet migrated.
