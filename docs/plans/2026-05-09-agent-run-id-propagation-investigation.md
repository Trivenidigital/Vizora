# agentRunId Propagation — Investigation

**Date:** 2026-05-09
**Triggered by:** P0.5 sidecar-refinement design assumes `mcp_audit_log.agentRunId` is populated by Hermes on each tool call. Today it's NULL on every row.
**Companion:** `docs/plans/2026-05-08-agent-platform-redesign-design.md` ADL-4, §2.3.

---

## Finding

**Hermes' MCP-server config supports static `headers:` (Authorization etc.) but NOT per-invocation dynamic header injection.** The `headers:` block is set once at config-load and sent on every MCP call from that server.

Evidence (from `/root/.hermes/config.yaml`):
```yaml
mcp_servers:
  vizora:
    url: https://vizora.cloud/api/v1/mcp
    headers:
      Authorization: "Bearer mcp_IkMWJA7BlAR8tKcf2XyrawPNi4ZfxsA3RIKEUzlg"
    timeout: 30
  vizora-platform:
    url: https://vizora.cloud/api/v1/mcp
    headers:
      Authorization: "Bearer mcp_yk18drkX1B3Fn8922L8ObsiZO3nEqMZiNsXWDzjXrq8"
    timeout: 30
```

The `Authorization: "Bearer mcp_..."` is hardcoded plaintext. No env-var interpolation pattern (`${VAR}` / `{{var}}`) is visible in the config.yaml comments or examples.

`hermes -z --help` does not expose a per-invocation `--header` flag.

## Three fix paths

### Path A (cleanest, requires Hermes change): per-skill or per-invocation header
Add `--header` flag to `hermes -z`. The runner script does:
```bash
hermes -z --header "X-Agent-Run-Id: $RUN_ID" --skills <skill> -t <tools> "$PROMPT"
```
MCP server reads from `req.headers['x-agent-run-id']` and stores on `mcp_audit_log.agentRunId`.

**Pros:** Clean. Keeps the agent_run_id contract crisp.
**Cons:** Requires upstream Hermes feature. Not in 0.12.0.

### Path B (config env interpolation, if Hermes supports it)
If Hermes' YAML loader supports env-var interpolation:
```yaml
mcp_servers:
  vizora:
    headers:
      Authorization: "Bearer mcp_..."
      X-Agent-Run-Id: "${AGENT_RUN_ID}"
```
Runner exports `AGENT_RUN_ID=<id>` before each `hermes -z` call.

**Status:** UNVERIFIED. Hermes may or may not support `${VAR}` in config values. Quick test would be: set `Authorization: "${MCP_TOKEN}"` with that env set; check if it works. Out of scope for this investigation.

### Path C (encode in token): one-time MCP token per firing
Runner generates a short-lived (5-min) per-firing MCP token; server maps token → agent_run_id at validation time. Hermes MCP config uses `Authorization: "Bearer ${PER_FIRING_TOKEN}"` (assumes Path B works) OR Hermes is configured with a stable token but server stores last-issued-per-runner-pid mapping.

**Pros:** Works with any Hermes version; clean attribution.
**Cons:** Token-management overhead. Token rotation cost. Tracking which token was used by which firing is itself a coordination problem.

### Path D (sidecar fallback by time-range): document the limitation
Sidecar's outcome refinement falls back to `mcp_audit_log` time-range + agentName join (per design §2.3 fallback path). Less precise — overlapping firings could double-attribute — but acceptable given our cron cadence (`*/30` lifecycle, `*/15` triage) makes overlap rare.

**Pros:** Zero implementation work. Already in design as fallback.
**Cons:** No precise per-firing attribution. Minor monitoring degradation.

## Decision

**Path D for now.** Per-firing attribution is a quality-of-monitoring concern, not a safety gate. The 4-layer cost defense doesn't depend on it. Customer #1 launch isn't gated on it.

Path B (env interpolation) is the right next step IF Hermes supports it. Quick to test post-launch:
```yaml
mcp_servers:
  test-server:
    headers:
      X-Test: "${TEST_VAR}"
```
Run `TEST_VAR=hello hermes ... ` and check the actual HTTP request headers (via logger or proxy). If the header arrives as `hello`, Path B is viable.

Path A (upstream Hermes contribution) tracked in `tasks/feature-backlog.md` for post-launch.

## Implementation: enable the time-range fallback in the sidecar

The sidecar at `scripts/agents/hermes/poll-insights.ts` used to join `mcp_audit_log` ONLY by `agentRunId`. When that's NULL on every row (today's reality), the join found 0 rows and the outcome refinement marked every successful firing as `no_work` — incorrect.

Pass73 implemented Path D repo-side:

- `scripts/agents/hermes/outcome-refinement.ts` classifies audit status groups.
- `poll-insights.ts` queries exact `agentRunId` groups first.
- If exact groups are absent, it falls back to `agentRunId: null` + MCP audit
  `agentName` candidates for the skill (for example
  `vizora-customer-lifecycle` also checks `hermes-customer-lifecycle`) + the
  firing's `startedAt`/`finishedAt` window with a small boundary pad.
- Concrete audit-derived outcomes, including confirmed `success`, are PATCHed
  through the existing internal endpoint so `enrichedAt` is set and valid runs
  are not later orphan-swept as `runner_crash`.
- If neither exact nor fallback rows exist, it leaves the provisional `success` row unrefined instead of writing `no_work`.

There is no schema column for an explicit fallback confidence flag today, so the lower-confidence fallback is documented and covered by ops tests rather than persisted on the row.

## Status

- Finding documented: ✅ this file
- Sidecar Path D fallback: implemented repo-side in pass73
- Path A upstream contribution: tracked as long-term feedback to Hermes maintainers
- Remaining precise `agentRunId` propagation: deferred to Hermes upstream `--header` support or a verified env-var interpolation path
- Customer #1 impact: NONE (cost defense intact, monitoring gracefully degrades when precise headers are unavailable)
