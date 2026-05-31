# Support-Triage Cross-Tenant Token — P2 Design Decision

**Date:** 2026-05-09
**Triggered by:** P1.1 cross-tenant write defense (correct security fix) blocks support-triage from writing per-org shadow rows when its token is per-org.
**Companion:** `docs/plans/2026-05-08-agent-platform-redesign.md` §support-triage, `docs/plans/2026-05-08-agent-platform-redesign-design.md` §3.3.

---

## The contradiction

The support-triage Hermes skill needs to:
1. Read open support requests via `list_open_support_requests` (per-org tool, requires per-org token)
2. Write a per-ticket shadow row via `log_shadow_row` with the ticket's `organization_id` (the originating org)

**P1.1 (this sprint)** added cross-tenant write defense: per-org tokens get their `organization_id` forced into the row; mismatched agent-supplied `organization_id` returns INVALID_INPUT.

**Result:** support-triage's per-org token (currently org `1dceeda9-...`) can ONLY attribute shadow rows to that one org. Per-ticket rows for other orgs return INVALID_INPUT.

This is correct security behavior. The question is: how should support-triage be deployed?

## Why we have this contradiction in the first place

The original design assumed `log_shadow_row` was platform-scope only (write to a global ops audit). That's a reasonable design — the shadow log IS a platform-internal audit, not customer-visible. But P1.1 opened it to per-org tokens to fix the support-triage bootstrap (where the agent's only available token was per-org).

Now we have two different goals:
- A: support-triage needs to log cross-org tickets it triaged (platform-scope behavior)
- B: prevent malicious per-org tokens from spoofing org_id in shadow rows (defended by P1.1)

These conflict for support-triage specifically.

## Five options

### Option 1: Re-issue support-triage as platform-scope token
Add a NEW MCP token: `hermes-support-triage-shadow-platform` with `organizationId=NULL` and scopes `support:read, support:write, shadow:write, displays:read`.

**Pros:** Simplest. Just a token re-issue.
**Cons:** `support:*` MCP tools are currently per-org-only — they reject platform-scope tokens with FORBIDDEN. So this token can't actually call `list_open_support_requests`.

### Option 2: Make `support:*` tools accept platform-scope tokens
Modify `support.tools.ts` to accept platform-scope tokens. When token is platform-scope, return tickets across ALL orgs.

**Pros:** Solves both A and B. support-triage gets one platform-scope token that can read all orgs' tickets and log per-org shadow rows.
**Cons:** Bigger code change. Risk of accidentally exposing cross-org data to per-org tokens (need careful test). Multi-tenant security review required.

### Option 3: Issue support-triage as platform-scope, change skill to call a NEW platform-scope read tool
Add a new MCP tool `list_all_open_support_requests` (platform-scope only). support-triage uses this for its read step. Existing per-org `list_open_support_requests` stays unchanged for per-org agents.

**Pros:** Minimal blast radius — net new tool, no risk to existing per-org callers.
**Cons:** Tool surface bloat. Second tool that does almost the same thing.

### Option 4: Issue TWO tokens to support-triage — per-org for `support:*`, platform for `log_shadow_row`
Hermes' MCP config supports multiple servers (`vizora`, `vizora-platform` already exist). Issue a third token bound to a third server entry; support-triage uses `vizora` for support reads + `vizora-platform` for shadow log writes.

**Pros:** No code change. Pure config + token issuance.
**Cons:** Already-issued `vizora-platform` token IS the customer-lifecycle's platform-scope token. We'd need a fourth server entry (`vizora-platform-triage`) with a fresh token. Hermes config + skill prompt changes per-server tool selection. Skill prompt must be carefully crafted to use the right server per call.

### Option 5: Disable support-triage entirely until customer-lifecycle proves stable
Don't enable the support-triage Hermes shadow agent for customer #1. Operator handles support tickets manually. Re-evaluate in week-2.

**Pros:** Zero risk. No design call needed.
**Cons:** Loses the support-triage shadow signal. The original PR work still ships, just isn't activated.

## Recommendation

**Option 5 for first-customer launch.** No customer-#1 dependency on support-triage. Operator handles tickets directly via the dashboard. The shadow data we'd lose (~5 firings/day × 1 customer × few tickets = ~10 audit rows/week) isn't load-bearing for any decision in week-1.

**Option 2 for week-2.** This is the architecturally cleanest answer. The work is bounded and reviewable:
1. Add a `requirePlatformOrOrgScope()` helper to `mcp/auth/mcp-context.ts`
2. Modify `support.tools.ts` handlers to use it
3. When token is platform-scope, the WHERE clause omits `organizationId =` (returns all-org rows)
4. When token is per-org, the existing per-org filter applies
5. Re-issue `hermes-support-triage-shadow` as platform-scope
6. Update test coverage in `support.tools.spec.ts`

Estimated effort: 4-6h including review.

**Option 3 (new tool) is the fallback** if Option 2's security review surfaces concerns about the existing per-org tool growing platform-scope behavior.

## Status

- Finding documented: ✅ this file
- Customer #1 launch impact: NONE — Option 5 keeps support-triage disabled (its current state)
- Tracked for week-2: Option 2 implementation in `tasks/feature-backlog.md`
- Customer-lifecycle (the OTHER Hermes shadow agent) is platform-scope and works — verified today
