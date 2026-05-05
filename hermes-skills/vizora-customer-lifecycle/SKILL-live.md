---
name: vizora-customer-lifecycle
description: Live-mode customer-lifecycle agent. For each onboarding candidate, score, then either send a nudge email (via server-templated MCP write tool), or auto-complete stale (>30d) signups. Replaces SKILL.md (shadow) when shadow comparison data justifies the cutover. Customer-visible — handle with care.
---

# Vizora Customer Lifecycle — LIVE Mode

You are running as a scheduled Vizora customer-lifecycle agent in **LIVE** mode. You replace the existing PM2 cron `agent-customer-lifecycle` for the orgs your token covers. **Every action you take touches production data and may send real customer-visible email.**

This file is named `SKILL-live.md` in the repo. The cutover is performed by scp'ing this file over `SKILL.md` on the VPS — see CLAUDE.md "MCP Server" → "Cutover playbook for customer-lifecycle".

## Hard rules (non-negotiable)

1. **Server-side templates only.** When calling `send_lifecycle_nudge_email`, you supply ONLY the `nudge_key`. The server picks the subject, body, and footer from a hardcoded table. Do NOT generate prose.
2. **Structural signals only for scoring.** The MCP read tool already strips org name, admin email, and billing detail. You receive only `tier`, `days_since_signup`, `milestone_flags`, `nudges_sent`. Do NOT fabricate or infer email content.
3. **One MCP read call per cron firing.** Call `list_onboarding_candidates` exactly once. Don't paginate.
4. **One write per ticket per cron firing.** For each candidate, you make at most ONE of: `send_lifecycle_nudge_email`, OR `auto_complete_org_onboarding`, OR no write (template = `none`). Do NOT call both for the same org in the same firing.
5. **Audit: invoke the `log_shadow_row` MCP tool per decision.** Every decision (including `none` and dry-run results) gets one tool invocation: pass `log_name: "vizora-customer-lifecycle-live"` and a `fields` object with the decision details. Tool invocation only — do NOT echo or shell-redirect. Server prepends `timestamp` + `run_id`. The mcp_audit_log is the server-side trail; the JSONL the tool writes is the agent-side trail.
6. **Trust the server's `LIFECYCLE_LIVE` gate.** If the server returns `reason: "dry_run"`, that means `LIFECYCLE_LIVE` is unset on the server — emails were intentionally NOT sent. Log it and move on. Do not retry.
7. **Trust the server's dedup.** If the server returns `reason: "already_sent"`, the dayN_NudgeSentAt column was already set. Don't try to re-send via a different tool.

## Steps to run

### 1. Pull onboarding candidates

Use the `vizora-platform` MCP server (NOT the `vizora` server — that one carries a per-org token and `list_onboarding_candidates` will reject it with INVALID_INPUT).

```
list_onboarding_candidates({ "lookback_days": 30, "limit": 200 })
```

If the response is empty, **invoke the `log_shadow_row` MCP tool** with `log_name: "vizora-customer-lifecycle-live"` and `fields: { "organization_id": null, "action": "none", "hermes_reasoning": "heartbeat: 0 candidates" }`, then stop. Do NOT call any other write tool. Tool invocation only, no shell redirect.

### 2. For each candidate, decide the action

Score by the same rules as `SKILL.md` (shadow). **The nudge windows are BOUNDED** — match the existing PM2 cron's `suggestNudge` (`scripts/agents/lib/ai.ts`) exactly. An org that has missed all three windows (e.g., 25 days old, never paired a screen) does NOT get a retroactive day1 nudge — it gets `none`, and once it crosses 30 days it gets `auto_complete`.

- **`days_since_signup >= 30`** → action = `auto_complete` (stale signup; matches the PM2 cron's auto-complete branch).
- **`days_since_signup` between 1 and 2 inclusive** AND NOT `screen_paired` AND NOT `nudges_sent.day1` → action = `send_nudge`, key = `day1-pair-screen`.
- **`days_since_signup` between 3 and 4 inclusive** AND NOT `content_uploaded` AND NOT `nudges_sent.day3` → action = `send_nudge`, key = `day3-upload-content`.
- **`days_since_signup` between 7 and 10 inclusive** AND NOT `schedule_created` AND NOT `nudges_sent.day7` → action = `send_nudge`, key = `day7-create-schedule`.
- Otherwise → action = `none` (welcome window <1d, between-window gap, missed-all-windows but <30d, or already-completed).

### 3. Execute the action via MCP

**For `action == 'send_nudge'`:**

```
send_lifecycle_nudge_email({
  "organization_id": "<id>",
  "nudge_key": "<key>"
})
```

This single tool call covers the whole pipeline server-side: dedup pre-check, admin lookup, template render, SMTP send (if `LIFECYCLE_LIVE=true`), mark-sent on success. You don't need a separate `mark_onboarding_nudge_sent` call — bundling prevents the race.

Possible `reason` values you'll see in the response:
- `sent` — email actually went out, dayN column marked
- `dry_run` — `LIFECYCLE_LIVE` unset on server, no SMTP fired (still success)
- `already_sent` — dedup tripped, server didn't try
- `no_admin` — org has no admin/manager user; nothing to do
- `no_smtp_configured` — SMTP creds missing on server (alert ops)
- `smtp_error` — SMTP rejected the send; server already logged with masked recipient

**For `action == 'auto_complete'`:**

```
auto_complete_org_onboarding({
  "organization_id": "<id>"
})
```

Idempotent. The org will stop showing up in `list_onboarding_candidates` after this.

**For `action == 'none'`:**

No tool call other than the audit log (next step).

### 4. Log a JSONL audit row per candidate via the MCP tool

For every candidate (including `action == 'none'`), **invoke the `log_shadow_row` MCP tool** with these arguments:

- `log_name`: `"vizora-customer-lifecycle-live"` (NOT `-shadow` — this is the live skill)
- `fields`: a JSON object with the per-org result:
  ```json
  {
    "organization_id": "<id>",
    "tier": "pro",
    "days_since_signup": 4,
    "action": "send_nudge",
    "nudge_key": "day3-upload-content",
    "tool_result": { "sent": true, "reason": "sent", "recipient_count": 1, "recipient_hashes": ["abcd1234..."] },
    "hermes_reasoning": "<≤120 chars>"
  }
  ```

This is a tool INVOCATION — call the function via the MCP transport. Do NOT use `echo`, `tee`, or any shell redirect. Server prepends `timestamp` + `run_id`.

For `action == 'none'`: `tool_result: null`, reasoning explains why (e.g., `"day=15 stalled at content-upload but day3 nudge already sent"`).

For `action == 'auto_complete'`: `tool_result: { "completed": true }`, reasoning notes age (e.g., `"age=42d, no completion — auto-closing"`).

`hermes_reasoning`: ≤120 chars, terse, no org names or email content.

### 5. Stop

After all candidates processed, exit. A short stdout summary is fine — `wrote N rows: M nudges, K auto-completes, P none`.

## Templates (FYI — server picks these, you never supply them)

For your awareness only:
- `day1-pair-screen` → subject "Pair your first screen with Vizora"
- `day3-upload-content` → subject "Upload your first piece of content"
- `day7-create-schedule` → subject "Schedule your content for automatic playback"

Body for all three is the same template: `Hi,\n\n<subject>.\n\nOpen your dashboard: <APP_URL>/dashboard\n\n— Vizora`. The server renders this — you cannot influence body, recipient, or footer.

## What NOT to do

- Do NOT call `mark_onboarding_nudge_sent` directly. The send tool already marks-sent on success. Calling mark separately creates duplicate-send race risk and is only for cases where the email went out via some non-MCP path.
- Do NOT call `list_displays`, `list_open_support_requests`, or any non-customer-lifecycle tool — they're irrelevant.
- Do NOT generate or paraphrase email body text. The templates are fixed.
- Do NOT keep retrying on `smtp_error` or `no_smtp_configured` — that's an ops issue, not an agent issue. Log and move on.
- Do NOT call any tool more than once per candidate per cron firing.
- Do NOT overwrite the JSONL log (`>` redirect) — append only (`>>`).
- Do NOT post a summary back to chat that quotes org IDs back. The JSONL is the artifact.

## Rollback

If something goes wrong (audit log shows mass mis-decisions, customer complaints, SMTP error storm), rollback is a one-line scp:

```bash
scp hermes-skills/vizora-customer-lifecycle/SKILL.md \
    root@vizora.cloud:/root/.hermes/skills/vizora-customer-lifecycle/SKILL.md
```

That restores the shadow-only skill. Hermes stops writing.

If `LIFECYCLE_LIVE=true` was flipped as part of the cutover and the PM2 cron was decommissioned, **also**:

```bash
# Stop emails immediately
ssh root@vizora.cloud 'pm2 set vizora:LIFECYCLE_LIVE false && pm2 reload all'
# Re-enable PM2 cron as the safety net
ssh root@vizora.cloud 'pm2 start ecosystem.config.js --only agent-customer-lifecycle && pm2 save'
```

The MCP server's dedup row prevents the PM2 cron from re-sending nudges Hermes already sent.

## Why this skill exists

After ≥ 7 days of shadow data with template-agreement ≥ 80% on N ≥ 50 orgs (see `scripts/agents/compare-lifecycle-hermes-vs-heuristic.ts`), and after explicit Sri sign-off, this skill replaces SKILL.md and Hermes takes over customer-lifecycle for the orgs covered by the calling token. The PM2 cron continues to run for orgs not yet migrated — until decommissioned per the cutover playbook in CLAUDE.md.
