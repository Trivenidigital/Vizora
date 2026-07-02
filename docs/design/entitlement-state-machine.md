# B3 — Entitlement State Machine (DESIGN — for review before implementation)

**Status:** DESIGN. Implementation is gated on operator review (per checkpoint). This is the one
slice where a wrong default darkens paying customers, so the states, grace windows, emissions, and
per-state screen behavior are all pinned here first.

**Finding:** B3 — entitlement lapse currently has **no effect on live screens and emits no device
signal**; `screenQuota` is enforced create-time only, so a downgraded/suspended tenant keeps all
existing screens live indefinitely (`billing-lifecycle.service.ts:162-202`, `quota.guard.ts:63`,
`pairing.service.ts:879`). This design wires entitlement transitions to the contract's
`tenant:suspended`/`tenant:resumed` events (Slice 0 item 3 emission plumbing is already built and
tested; this design supplies the trigger).

## Design principle (north-star aligned)

Billing/entitlement **fails closed** (no service without entitlement) but **degrades with a grace
period — never an instant kill of live screens**. A screen going dark is a business-visible failure,
so suspension is the *last* step of a signposted sequence, not the first consequence of a failed
charge. Suspension is **reversible** (credentials kept, device holds on a branded screen, resumes on
payment) — distinct from revocation (credential purge), which entitlement never triggers.

## Current states (as-is, verified)

`Organization.subscriptionStatus ∈ { trial, active, past_due, canceled }`, `subscriptionTier`,
`screenQuota`. There is **no `suspended` status today** — which is exactly why `auth/check`'s 403
branch and the `tenant:suspended` emission never fire yet (safe: nothing is falsely darkened).

## Proposed states & transitions

```
                        payment succeeds
        ┌──────────────────────────────────────────────┐
        ▼                                                │
   ┌─────────┐  trialEndsAt reached   ┌──────────┐  no payment by trial end
   │  TRIAL  │───────────────────────▶│  ACTIVE  │       (no card)
   └────┬────┘   (card on file)       └────┬─────┘            │
        │ no card                          │ payment fails    │
        │                                  ▼                  │
        │                            ┌───────────┐            │
        └───────────────────────────▶│ PAST_DUE  │◀───────────┘
                                      │ (grace)   │
                    payment succeeds  └────┬──────┘
        ┌──────────────────────────────────┤ grace window elapses (N days)
        │                                   ▼
   ┌────┴──────┐   payment succeeds   ┌────────────┐
   │  ACTIVE   │◀─────────────────────│ SUSPENDED  │  screens hold (branded), creds kept
   └───────────┘   (tenant:resumed)   └─────┬──────┘
                                            │ operator/admin cancels, or M days suspended
                                            ▼
                                      ┌────────────┐
                                      │  CANCELED  │  → downgrade to free tier (5 screens)
                                      └────────────┘   free tier still SERVES within quota
```

### State table

| State | Screens show | `subscriptionStatus` | Device signal | Reversible? |
|---|---|---|---|---|
| TRIAL | normal content | `trial` | — | n/a |
| ACTIVE | normal content | `active` | `tenant:resumed` on entry from suspended | n/a |
| PAST_DUE (grace) | **normal content** (grace — do NOT darken) + dashboard banner + dunning emails | `past_due` | — (no device change during grace) | yes → ACTIVE on payment |
| SUSPENDED | **branded holding screen** ("Display paused — update billing"), credentials kept, cached loop stopped | `suspended` (**new**) | `tenant:suspended` on entry | yes → ACTIVE on payment (`tenant:resumed`) |
| CANCELED | free-tier content within the 5-screen quota; screens beyond quota → holding | `canceled`, tier `free` | `tenant:resumed` (back to serving) for the ≤5 that stay; `tenant:suspended` for the over-quota remainder | via re-subscribe |

## Grace windows (proposed defaults — operator to confirm)

- **PAST_DUE → SUSPENDED: N = 7 days** (matches the existing 7-day `billing-lifecycle` window, but
  the trigger changes from "downgrade to free" to "suspend"). During grace: **screens keep playing**,
  dashboard shows a billing banner, dunning emails at day 0 / 3 / 6.
- **SUSPENDED → CANCELED: M = 14 days** (suspended-but-unpaid → hard cancel → free tier). Screens are
  already holding during suspension, so this transition is about billing cleanup, not a new darkening.
- **The grace clock must key on the state-entry timestamp, not `updatedAt`** (current bug B8:
  `billing-lifecycle.service.ts:173` keys on `updatedAt`, which any unrelated org write resets,
  silently extending grace). Add an explicit `entitlementStateSince` timestamp.

## Emission map (→ contract §3.2, plumbing already built)

| Transition | Emit | Via |
|---|---|---|
| → SUSPENDED | `tenant:suspended {reason:'past_due'}` | `POST /api/internal/tenant-entitlement {state:'suspended'}` → `gateway.emitTenantEntitlement` |
| SUSPENDED → ACTIVE (payment) | `tenant:resumed` | same, `state:'resumed'` |
| CANCELED (over-quota screens) | `tenant:suspended {reason:'quota'}` for screens beyond 5 | per-device or org-room + client-side quota |
| `auth/check` while suspended | returns `403 TENANT_SUSPENDED` (already coded, fires once status='suspended' exists) | `DeviceAuthCheckService` |

## What implementation will touch (after approval)

1. Add `suspended` to the status enum + an `entitlementStateSince` column (migration).
2. `billing-lifecycle` cron: PAST_DUE→SUSPENDED at N days (emit `tenant:suspended`); SUSPENDED→
   CANCELED at M days. Re-key the clock off `entitlementStateSince`.
3. `handlePaymentSucceeded`: on payment while PAST_DUE/SUSPENDED → ACTIVE + emit `tenant:resumed`.
4. A `TenantEntitlementService.emit()` middleware→realtime call (mirrors `sendDeviceRevoked`).
5. Negative tests: a failed charge does NOT darken screens during grace; suspension emits exactly
   one `tenant:suspended`; payment during suspension emits exactly one `tenant:resumed`; the grace
   clock is not reset by an unrelated org write.

## Open questions for review

1. **Grace defaults** — confirm N=7, M=14, and the dunning cadence (0/3/6).
2. **Enforce quota on existing screens on downgrade?** Today over-quota screens keep running after a
   downgrade to free. Should CANCELED/free actively hold the over-quota remainder (emit
   `tenant:suspended` for screens beyond 5), or grandfather them until they disconnect? This is a
   revenue-vs-goodwill call, not a technical one.
3. **Trial-no-card path** — TRIAL with no card at `trialEndsAt`: straight to SUSPENDED (hold), or a
   short grace first? Proposed: SUSPENDED immediately (no payment method = no grace basis), but
   confirm.
