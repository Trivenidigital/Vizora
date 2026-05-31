# Vizora Support Ticket Taxonomy v2 (Hybrid 20)

**Date:** 2026-04-24
**Status:** Proposed (not yet validated against real customer traffic)
**Scope:** Classification labels emitted by `scripts/agents/support-triage.ts` and consumed by downstream Hermes/Path B surfaces
**Supersedes:** The 6-bucket `TicketCategory` union (billing / technical / content / display / account / other) — kept for backward compat, deprecated for new reads

---

## Context for a cold reader

- **What this is:** A 20-way classification of support tickets Vizora will receive once the product goes live to SMB customers (restaurants, retail, gyms, quick-service). The 20 are grouped by product surface (Device / Content / Schedule / Analytics / Account-Billing) and tagged by the Path B conversational surface's ability to handle them.
- **Why 20, not 6:** The 6-bucket `TicketCategory` was built for an internal routing view and collapses too many different root causes into `technical`. Hermes/Path B needs finer labels to decide whether to answer, act, or escalate.
- **Why now, not after launch:** Instrumentation debt compounds. Adding a parallel `aiCategory` column today gives us 30 days of labeled traffic before we commit to the taxonomy. The measurement gate (Step 4 of the original plan) is deliberately deferred — don't lock this in as canonical until real tickets confirm or falsify it.
- **Key caveat (memory calibration rule):** This taxonomy was built from domain knowledge of the Vizora codebase plus the maintainer's guesses at likely SMB patterns. **No real customer conversations, demo feedback, or CRM history informed it.** Treat volume percentages as priors, not facts. Revisit after 30 days of production data.

---

## The 20 categories

Each row: `slug` — human label — **v1 / v2 / fix / escalate** — projected volume % (prior, unverified).

### Device (5) — ~30% projected volume

| Slug | Label | Tier | Vol % | Notes |
|------|-------|------|-------|-------|
| `device_pairing_failed` | Pairing code won't work | **v1** | 8% | Read: pairing code status in Redis, display registration state. Most common "can't onboard" ticket. |
| `device_offline` | Screen shows offline / not connecting | **v1** | 10% | Read: last heartbeat, socket room membership, device lastSeen. fleet-manager already detects this. |
| `device_wrong_content` | Screen showing wrong or old content | **v2** | 5% | v1: diagnose (playlist/schedule assigned vs active). v2: force content refresh (write). |
| `device_playback_error` | Video/image won't play | **fix** | 4% | Usually a codec, URL, or CSP issue. Needs engineering — escalate with signal. |
| `device_display_config` | Resolution / orientation / timezone wrong | **v2** | 3% | v1: read current config. v2: push config update. |

### Content (5) — ~25% projected volume

| Slug | Label | Tier | Vol % | Notes |
|------|-------|------|-------|-------|
| `content_upload_failed` | File won't upload | **fix** | 6% | MIME mismatch, size cap, MinIO outage — almost always surfaces a bug or misconfig. |
| `content_not_showing` | Uploaded content never appeared on screen | **v1** | 7% | Read: content publish state, playlist membership, schedule coverage. High-value diagnosis. |
| `content_expired` | Content disappeared / replacement logic | **v1** | 4% | Read: expiration timestamp, replacement content resolution. |
| `content_template_broken` | Template renders wrong or blank | **fix** | 5% | Handlebars variable / data-source issue. Engineering. |
| `content_storage_limit` | Upload rejected: over plan quota | **v1** | 3% | Read: quota, usage; return upgrade path. |

### Schedule (4) — ~15% projected volume

| Slug | Label | Tier | Vol % | Notes |
|------|-------|------|-------|-------|
| `schedule_not_playing` | Scheduled content didn't trigger at the expected time | **v1** | 5% | Read: schedule rule, device timezone, current playlist. schedule-doctor touches this. |
| `schedule_timezone_issue` | Off by hours (DST, TZ offset) | **v1** | 4% | Read: device TZ, org TZ, schedule TZ. Pure diagnosis. |
| `schedule_conflict` | Two schedules overlap, wrong one wins | **v2** | 3% | v1: show conflicts. v2: resolve (rewrite one). |
| `schedule_coverage_gap` | Dead air between schedules | **v2** | 3% | v1: show the gap. v2: fill with default playlist. |

### Analytics (3) — ~10% projected volume

| Slug | Label | Tier | Vol % | Notes |
|------|-------|------|-------|-------|
| `analytics_missing_data` | No playback metrics showing | **fix** | 4% | Almost always ClickHouse ingestion / reporter agent issue. |
| `analytics_wrong_count` | Impression counts look off | **escalate** | 3% | Accounting / attribution dispute — human review. |
| `analytics_export_failed` | Report export errors or blank | **fix** | 3% | Code path. |

### Account / Billing (3) — ~20% projected volume

| Slug | Label | Tier | Vol % | Notes |
|------|-------|------|-------|-------|
| `account_access_lost` | Can't log in / forgot password / MFA | **v1** | 8% | Read: check user state; direct to reset flow. Never touch credentials directly. |
| `account_permissions` | Wrong role, missing org access | **v2** | 5% | v1: show current role. v2: modify (admin-gated). |
| `billing_invoice_question` | Invoice confusion, refunds, plan change | **escalate** | 7% | Money = human. Always escalate with signal. |

**Fallback:** `other` — anything the heuristic can't classify with confidence.

---

## Tier summary (projected, pre-measurement)

| Tier | Meaning | Projected % of volume |
|------|---------|----------------------|
| **v1** (read-only Path B) | Conversational surface answers from structural reads, no writes | **47%** |
| **v2** (write Path B) | Requires action routed through `OpsApiClient` with audit + dry-run | **28%** |
| **fix** (product bug) | Engineering work, not a conversational problem | **25%** |
| **escalate** (human) | Ambiguous, financial, or policy — always human | **2%** |

**The v1 = 47% claim is the load-bearing number for the Path B business case.** If real traffic shows this lower than ~30%, the conversational surface isn't worth building standalone; it should stay behind the D-family agents (Path A). If real traffic shows it higher than ~60%, v2 writes become the next investment. 30-day gate applies.

---

## Exclusion list (things this taxonomy deliberately does NOT cover)

These arrive through support but don't belong in `aiCategory` — they go to separate channels or are filtered out before triage:

- **Sales / demo requests** — routed by web form, never creates a `SupportRequest`.
- **Feature requests** — product backlog, not triage. Tag `other` if misfiled.
- **Security reports** — out-of-band (email to security@), never touched by Hermes.
- **Partner / integration questions** — separate queue once we have partners.
- **Spam / misuse** — handled by moderation, not triage.
- **Compliance / legal** — escalated the instant detected; never answered by AI.

---

## How this maps to the existing 6-bucket TicketCategory

The old union stays canonical for the priority heuristic and for any existing consumer. The new column is additive.

| v2 slug | Legacy bucket |
|---------|---------------|
| `device_*` | `display` |
| `content_*`, `schedule_*` | `content` |
| `analytics_*` | `technical` |
| `account_*` | `account` |
| `billing_*` | `billing` |
| `other` | `other` |

The coarse `TicketCategory` remains the input to `buildSignals()` and priority scoring. `aiCategory` is purely a secondary signal for Path B routing and future measurement.

---

## What happens next

1. **This commit:** add `TicketCategoryV2` union + `aiCategory` column + heuristic classifier in `support-triage.ts`. Heuristic = keyword/regex, no LLM cost.
2. **Deploy + observe (30 days):** watch the distribution. Expect the heuristic to mis-classify 15–25% into `other` — that's the measurement signal.
3. **Gate decision (not now):** after 30 days, review the `aiCategory` histogram. If `v1 %` is within ±10pp of 47%, proceed with Path B v1. If lower, revisit the premise. Either way, the taxonomy itself may shift — we may collapse or split categories based on what the data shows.
4. **Do NOT:** backfill historical tickets, expose `aiCategory` in the UI, or build Path B routing logic against this until the 30-day gate clears.

---

## Measurement integrity: classifier is frozen per-ticket

The 30-day histogram is only a credible measurement if each ticket is classified **once** — tweaking the classifier mid-window and silently re-labeling historical rows turns the histogram into a moving target.

Two guards keep this honest:

- **D7 reply-loop prevention** (pre-existing): `fetchTicketsForOrg` filters `messages: { none: { authorType: 'agent' } }`. Once a ticket gets its agent triage message, it drops out of the fetch and is never visited again.
- **Idempotency check** (added in this commit): the loop calls `classifyCategoryV2` / `writeAiCategory` only when `ticket.aiCategory == null`. This is belt-and-suspenders — if `writeAgentMessage` fails partway through a cycle and the ticket reappears on the next run, its `aiCategory` is already set and won't be overwritten.

If the classifier needs a material change during the window (new category, split category, broadened regex), introduce `aiCategoryVersion Int?` and group histograms by version rather than mutating in place. Noted but **not added now** — YAGNI until we actually need to tweak mid-window.

---

## Read-side contract for downstream consumers

Prisma types `aiCategory` as `string | null`, not `TicketCategoryV2 | null`. When Path B (or any future consumer) reads it, **validate at the boundary** — do not cast. A later classifier version may write a slug this union doesn't know about, and a `as TicketCategoryV2` cast will type-launder it into code paths that rely on exhaustive switch coverage.

Recommended pattern at each read site:

```typescript
const V2_SLUGS = new Set<TicketCategoryV2>([
  'device_pairing_failed', 'device_offline', /* … */ 'other',
]);
function asV2(s: string | null): TicketCategoryV2 | null {
  if (s == null) return null;
  return (V2_SLUGS as Set<string>).has(s) ? (s as TicketCategoryV2) : 'other';
}
```

Unknown values fall to `'other'` rather than crashing or silently taking a wrong branch. Consider exporting `V2_SLUGS` from `@vizora/database` when the first consumer lands.

---

## Open questions flagged for later (do not resolve now)

- Should `device_pairing_failed` split into pre-pairing (code never generated) vs mid-pairing (code expired) once we see real volume?
- Is `content_not_showing` really 7%, or is it masking 3 distinct bugs? The heuristic will tell us.
- Does `analytics_wrong_count` deserve a category or should it collapse into `escalate`?
- When Path B v2 lands, which `v2`-tagged slugs are safe to auto-remediate (with audit) vs require confirmation dialog?
