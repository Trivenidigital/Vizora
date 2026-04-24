# Hermes / Path B Backlog

**Opened:** 2026-04-24
**Next decision gate:** 2026-05-24 (30 days after taxonomy-v2 deploy)
**Owner:** srinivas.yalavarthi@gmail.com

This file exists because "we'll revisit after 30 days" loses to "we never revisited." Keep it under source control, review at top of every new conversation that touches Hermes / support-triage / Path B.

---

## Where we are today (2026-04-24)

- **Skills inventory:** PR #35 falsified the "vizora-skills-v3 (28) / agency-skills-v4 (28)" premise. No prior skill bundles exist on disk or GitHub. Path A/B implementations will be authored from scratch, not ported.
- **Taxonomy v2:** PR #36 open. 20-way `TicketCategoryV2` scaffolded with heuristic classifier in `scripts/agents/support-triage.ts`, `aiCategory` column on `SupportRequest`, migration `20260424000000_add_support_request_ai_category`.
- **Path B:** NOT started. Explicitly gated on 30 days of production `aiCategory` data.
- **Hermes (NousResearch LLM layer):** decision deferred. Not blocking taxonomy work.

## The 30-day gate (2026-05-24)

**Do NOT before the gate:**
- Backfill historical tickets with `aiCategory`
- Expose `aiCategory` in the dashboard or any API consumer
- Build Path B routing logic against `TicketCategoryV2`
- Tweak `classifyCategoryV2()` heuristic (re-triage is prevented by D7 + idempotency guard; a mid-window tweak silently invalidates the histogram)

**Do AT the gate (2026-05-24 checklist):**
- [ ] Pull `aiCategory` histogram from prod: `SELECT "aiCategory", COUNT(*) FROM support_requests WHERE "aiCategory" IS NOT NULL GROUP BY "aiCategory"`
- [ ] Compute `v1 / v2 / fix / escalate` volume shares (mapping in `docs/hermes/ticket-categories-2026-04-24.md`)
- [ ] Measure `other` rate — target under 25% for a credible taxonomy
- [ ] Compare v1 share against the 47% prior:
  - **Within ±10pp (37–57%):** proceed to spec Path B v1
  - **Below 37%:** don't build standalone Path B — keep it behind D-family agents (Path A)
  - **Above 57%:** accelerate — v2 write surface becomes next investment
- [ ] Review `other`-bucket tickets manually — identify missing categories or patterns the heuristic misses
- [ ] Decide: taxonomy locked, adjusted, or scrapped

## Pending work (before the gate)

| # | Task | Size | Status |
|---|------|------|--------|
| 1 | Apply migration `20260424000000_add_support_request_ai_category` to production | 30 min | TODO — blocks data collection; clock only starts after this |
| 2 | Build classifier fixture corpus (50–100 synthetic tickets + expected labels) | ~4 hr | TODO — **recommended next** |
| 3 | Run fixture corpus as a Jest/vitest regression suite in CI | ~1 hr | TODO — follows #2 |
| 4 | Smoke-test classifier against a real ticket in staging after migration | 15 min | TODO — follows #1 |

## Explicitly deferred (don't pick up until gate clears)

- `aiCategoryVersion Int?` column for mid-window classifier tweaks — YAGNI until we actually need to tweak
- `V2_SLUGS` runtime export from `@vizora/database` — add only when a consumer needs it
- Path B v1 read-only query surface spec — waits on gate
- Path B v2 write-capable actions routed through `OpsApiClient` — waits on v1
- Hermes LLM integration decision — waits on both v1 spec and accuracy data
- Backfill of historical `SupportRequest` rows — never, unless taxonomy stabilizes and a specific consumer needs it

## Tripwires (flag during the window, don't act)

- If real ticket volume is < 20/month, the gate is statistically meaningless — push gate to 60-day mark
- If `classifyCategoryV2` returns `other` > 50% of the time, the heuristic needs a fundamental rethink before measurement proceeds
- If a category gets zero hits in 30 days, it's dead weight — candidate for removal
- If two categories collapse to indistinguishable volumes (~same keywords), merge them

## Reference

- Taxonomy doc: `docs/hermes/ticket-categories-2026-04-24.md`
- Open PR: https://github.com/Trivenidigital/Vizora/pull/36
- Skills inventory (falsification): https://github.com/Trivenidigital/Vizora/pull/35
- Memory calibration rule: `~/.claude/projects/C--projects-vizora/memory/feedback_memory_calibration.md`
