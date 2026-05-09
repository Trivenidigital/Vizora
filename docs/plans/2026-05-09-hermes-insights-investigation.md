# Hermes Insights Empty Output — Investigation

**Date:** 2026-05-09
**Triggered by:** Sidecar `hermes-insights-poller` reporting `insights_rows: 0` on every tick despite known firings.
**Companion:** `docs/plans/2026-05-08-agent-platform-redesign-design.md` §3.4, ADL-2.

---

## Finding

**`hermes -z` (one-shot mode) does NOT write to the SQLite session store.** This is by design — `-z` is fire-and-forget; persistent sessions only exist for conversational modes (`hermes chat`, `hermes cron`, `hermes telegram`, etc.).

Evidence:
```
hermes sessions stats:
  Total sessions: 232
  Total messages: 9792
  Database size: 36.3 MB

hermes sessions list (latest 20):
  All entries dated 2026-05-05, source=cron (the OLD hermes-cron mechanism,
  deprecated in PR #60 when we switched to PM2-cron-driven `hermes -z`).

hermes insights --days 7 --source cron: No sessions found.
hermes insights --days 7 --source cli:  No sessions found.
hermes insights --days 7 --source telegram: No sessions found.
hermes insights --days 7 --source slack:    No sessions found.
```

The May 5-or-earlier sessions exist (from when we used `hermes cron` directly). After PR #60 cutover to PM2 + `hermes -z`, no new sessions land in storage.

Hermes CLI flags reviewed (`hermes -z --help`, `hermes --help`):
- `--resume`, `--continue` — for resuming existing sessions
- `--pass-session-id` — for INCLUDING the session id in agent's system prompt
- **No flag to enable session persistence in `-z` mode.**

## Implication for the cost-tracking layer (P0.5)

The sidecar's design (`scripts/agents/hermes/poll-insights.ts`) assumes `hermes insights` will return per-firing token usage. This assumption is invalid for our `hermes -z` invocation pattern. The sidecar will continue to report `insights_rows: 0` indefinitely.

**This is NOT a safety failure.** The 4-layer cost-defense is intact:
- L1 (OpenRouter $2/day cap): hard ceiling, provider-side
- L2 (pre-flight balance check): runner aborts if balance < $0.50
- L3 (Hermes `model.max_tokens=4096`): per-call output cap
- L4 (cross-firing breaker, planned P4): NOT YET IMPLEMENTED

What we lose: **per-firing cost attribution.** The `agent_runs` table has `costMicrodollars=NULL` for every row written today. Grafana's "cost per firing" panel is empty.

## Three fix paths (ranked by cost / complexity)

### Path A (simplest, ~1h): Pre/post balance delta in runner
The runner already does a pre-flight `/credits` check (capturing `total_credits - total_usage`). Add a post-flight `/credits` check; the delta IS the firing's cost.

**Pros:** Provider-agnostic. Works for any LLM provider via their balance API.
**Cons:** Imprecise when multiple firings overlap (rare in our cron cadence — `*/30` for lifecycle, `*/15` for triage). Doesn't decompose into input/output tokens.

### Path B (medium, ~½ day): Capture generation IDs, query OpenRouter
Hermes prints generation IDs in stdout. Parse them from the runner log; for each, query `GET https://openrouter.ai/api/v1/generation?id=<gen_id>` which returns `{ tokens_prompt, tokens_completion, total_cost, ... }`.

**Pros:** Per-call accuracy. Decomposes input/output tokens. Includes prompt-cache discounts automatically.
**Cons:** OpenRouter-specific. Adds N round-trips per firing. Requires Hermes log to actually print generation IDs (not yet verified).

### Path C (largest, days): File a Hermes upstream PR
Add `hermes -z --persist-session` flag. Patch lands in next Hermes release; deploy bumps `HERMES_VERSION`.

**Pros:** Clean architectural fix. Sidecar's design works as-intended once shipped.
**Cons:** Out of our control / timeline.

## Decision

**Path A for now** (~1h work). Sufficient for first-customer launch. Pre/post-balance delta gets us per-firing cost attribution at ~1-second resolution, which is already coarser than our cron cadence so over-counting is rare.

Path B is the right long-term answer; tracked in `tasks/feature-backlog.md` for post-launch.

Path C is filed as upstream feedback to the Hermes maintainers (out of scope here).

## Implementation sketch (Path A)

In `run-hermes-skill.sh`, after the Hermes invocation:

```bash
# Already captured PREFLIGHT_BALANCE before invocation.
POSTFLIGHT_BALANCE="$(openrouter_balance_usd 2>/dev/null || echo "")"

# Compute delta. Both must be valid decimals.
COST_DELTA=""
if [[ "$PREFLIGHT_BALANCE" =~ ^-?[0-9]+(\.[0-9]+)?$ ]] \
   && [[ "$POSTFLIGHT_BALANCE" =~ ^-?[0-9]+(\.[0-9]+)?$ ]]; then
  COST_DELTA=$(echo "$PREFLIGHT_BALANCE - $POSTFLIGHT_BALANCE" | bc -l)
fi
```

Pass `costMicrodollars=$(round_to_microdollars $COST_DELTA)` to the POST body. Middleware writes it directly into the `agent_runs` row alongside the metadata.

The sidecar's role shrinks to: orphan-row sweep + outcome refinement (which still works via `mcp_audit_log` join — assuming Path B for `agentRunId` propagation also lands).

## Status

- Finding documented: ✅ this file
- Sidecar fix: minimal — change `level: 'error'` to `level: 'info'` for the "No sessions found" case so it doesn't trip the parser-failure alert
- Runner fix (Path A): tracked in `tasks/feature-backlog.md` as P2
- Long-term (Path B / C): backlog
