# B3 — Entitlement State Machine (DESIGN v2 — APPROVED against this revision)

**Status:** APPROVED for implementation against this revised design (operator, degrade-ladder
revision). v1's binary suspend-at-day-7 is replaced by a **degrade ladder** so dunning pressure
escalates through the *dashboard* (where the owner is) before the *storefront* (where their
customers are).

**Finding:** B3 — entitlement lapse currently has no effect on live screens and emits no device
signal (`billing-lifecycle.service.ts:162-202`, `quota.guard.ts:63`, `pairing.service.ts:879`). This
design wires entitlement transitions to the contract's `tenant:suspended`/`tenant:resumed` events
(Slice 0 item 3 plumbing already built + tested).

## Core principle — degrade ladder, not a binary kill

A screen going to a holding page in a customer's storefront is the harshest dunning action, and most
payment failures are **involuntary** (expired cards, bank declines), not churn intent. For the SMB
QSR/grocery segment, involuntary churn is the main killer, so screens darkening is the *last* rung,
reached only after the dashboard-side pressure has had two weeks to work. Suspension is reversible
(credentials kept, resumes on payment) — never revocation (credential purge).

## The ladder

```
 ACTIVE / TRIAL
   │  payment fails (or trial ends)
   ▼
 PAST_DUE ───────────── days 0–7 ── screens PLAY normally
   │                                 dashboard billing banner; dunning email day 0 / 3 / 7
   │  day 7, still unpaid
   ▼
 PUBLISH_LOCKED ─────── days 7–14 ─ screens PLAY (cached/last-published)
   │                                 CANNOT push new content; dashboard shows "billing paused"
   │  day 14, still unpaid
   ▼
 HOLDING (suspended) ── day 14+ ─── screens show branded holding; credentials kept
   │                                 ◀── tenant:suspended FIRES HERE (not earlier)
   │  day 30, still unpaid
   ▼
 CANCELED ───────────── day 30 ──── downgrade to free tier (5 screens); free still SERVES within quota

 Any rung → ACTIVE on payment success → tenant:resumed (if it had reached HOLDING)
```

## State table

| State | Days unpaid | Screens show | Publishing | `subscriptionStatus` | Device signal |
|---|---|---|---|---|---|
| ACTIVE / TRIAL | — | normal content | allowed | `active` / `trial` | — |
| PAST_DUE | 0–7 | **normal content** (do NOT darken) | allowed | `past_due` | none |
| PUBLISH_LOCKED | 7–14 | **still plays** cached/last content | **blocked** (content-push endpoints 403) | `publish_locked` (**new**) | none — this rung is dashboard/API-side only |
| HOLDING | 14–30 | **branded holding** ("Display paused — update billing"); creds kept | blocked | `suspended` (**new**) | `tenant:suspended` on entry |
| CANCELED | 30+ | free-tier content within 5-screen quota | free-tier limits | `canceled`, tier `free` | `tenant:resumed` for the screens that stay |

Recovery from any rung on payment: → ACTIVE; emit `tenant:resumed` only if it had reached HOLDING
(the earlier rungs never sent a device signal, so none is needed to undo).

## Grace windows (approved defaults)

- Dunning emails: **day 0 / 3 / 7** (all while screens still play).
- **Publish-lock at day 7**, **screens-to-holding at day 14**, **cancel at day 30.**
- Deliberately more generous than v1's 7/14: at ~$6/screen, aggressive enforcement isn't worth it —
  a customer recovered at day 12 is worth far more than the service cost of the unpaid window.
- **Clock keys on `entitlementStateSince`, NOT `updatedAt`** (fixes B8: `billing-lifecycle.service.ts:173`
  currently resets grace on any unrelated org write). New column set on each rung transition.

## Over-quota on downgrade — never auto-pick which storefront goes dark

The vendor must never choose which of a customer's screens goes black. On downgrade to a lower quota:

- The account enters an **over-quota** state; **all screens keep playing cached content.**
- **Publishing to the over-quota screens locks** (same publish-lock mechanism as the ladder).
- The dashboard **forces the owner to choose** which screens to keep within quota before the next
  billing cycle.
- If they never choose, the **newest-paired screens lock first** (defensible default) — still
  playing cached content until explicitly unpaired. No screen is auto-darkened by vendor choice.

## Trials — no card wall

Given the community-distributed, trust-based go-to-market (diaspora/TAGCA channel), a card wall kills
the top of funnel. So:

- **No card required to start a trial.**
- Abuse mitigated by a **trial screen cap (2–3 screens)**, not a card.
- Trial expiry follows the **same ladder** (publish-lock → holding → cancel), never an instant dark.

## Emission map (→ contract §3.2; plumbing already built & tested)

| Transition | Device signal | Via |
|---|---|---|
| PAST_DUE, PUBLISH_LOCKED entry | **none** (dashboard/API-side only) | — |
| → HOLDING (day 14) | `tenant:suspended {reason:'past_due'}` | `POST /api/internal/tenant-entitlement {state:'suspended'}` → `gateway.emitTenantEntitlement` |
| HOLDING → ACTIVE (payment) | `tenant:resumed` | same, `state:'resumed'` |
| `auth/check` while HOLDING | `403 TENANT_SUSPENDED` (already coded; fires once status='suspended' exists) | `DeviceAuthCheckService` |
| PUBLISH_LOCKED / over-quota | no device signal; content-push endpoints return 403 for the tenant | new `EntitlementPublishGuard` |

## Implementation plan (approved against this doc)

1. **Migration:** add `publish_locked` + `suspended` to the status vocabulary and an
   `entitlementStateSince` timestamp column.
2. **`billing-lifecycle` cron** (re-keyed off `entitlementStateSince`): PAST_DUE→PUBLISH_LOCKED @ 7d;
   PUBLISH_LOCKED→HOLDING @ 14d (emit `tenant:suspended`); HOLDING→CANCELED @ 30d.
3. **`handlePaymentSucceeded`:** any rung → ACTIVE; emit `tenant:resumed` iff it had reached HOLDING.
4. **`EntitlementPublishGuard`:** blocks content-push endpoints when the tenant is PUBLISH_LOCKED /
   HOLDING / over-quota (screens keep playing; only *new* publishes are blocked).
5. **Dunning:** emails at day 0/3/7 via the (now fail-loud-capable) mail service — these are
   non-critical (best-effort), so they log-and-swallow.
6. **Over-quota UX:** dashboard screen-selection flow; newest-paired-locks-first default.
7. **`TenantEntitlementService.emit()`** middleware→realtime call (mirrors `sendDeviceRevoked`).

### Negative tests (ship with implementation)

- A failed charge does **not** darken or publish-lock screens before day 7 (PAST_DUE plays).
- PUBLISH_LOCKED blocks a content push (403) but emits **no** device signal and screens keep playing.
- HOLDING emits **exactly one** `tenant:suspended`; earlier rungs emit none.
- Payment at any rung → ACTIVE; `tenant:resumed` emitted **iff** it had reached HOLDING.
- The grace clock is **not** reset by an unrelated org write (keys on `entitlementStateSince`).
- Downgrade never auto-darkens: all screens keep playing; over-quota publish is blocked; newest-paired
  locks first when the owner doesn't choose.
- Trial with no card starts (≤3 screens); trial expiry follows the ladder, never instant dark.
