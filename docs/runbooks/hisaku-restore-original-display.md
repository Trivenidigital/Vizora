# Hisaku — restore the original logical display (`50a2280f`)

**Status: BLOCKED on two parties Vizora cannot substitute for** — someone physically at
the TV, and a Hisaku tenant admin. Everything Vizora controls is in place.

## Why this is needed

On 2026-08-18 the TV's stored credential stopped verifying (signature failure, not
expiry). A live socket masked it until 2026-08-21 13:37, so the dashboard showed the
screen online while it was already unrecoverable. On 2026-08-22 the tester recovered it
the only way then available — clearing app storage — which made the client mint a **new**
`deviceIdentifier`, so pairing created a **second row** instead of rebinding.

Result today (verified 2026-08-23):

| Row | Nickname | Playlist | Impressions | State |
|---|---|---|---|---|
| `50a2280f` | Mobile | **Mana Ruchulu** | **71** | offline — the ORIGINAL logical display |
| `3da5dcb9` | Home | Promotions | 10 | offline — the accidental row the TV is now bound to |

Org quota: **5**, currently **2** rows counting against it.

`#377` (deployed) + `#378` (the dashboard affordance) now make it possible to rebind the
physical TV back to `50a2280f`, keeping its identity, assignment and history.

## The runbook

Steps 1–2 need someone **at the TV**. Steps 3–5 need a **Hisaku tenant admin**
(`hisaku.digitalmarketing@gmail.com` is currently the only one). Vizora staff cannot do
either — see "Why Vizora cannot do this" below.

1. **At the TV:** Android Settings → Apps → **Vizora Display** → Storage → **Clear
   storage**. Not "Clear cache", and reinstalling is not reliably sufficient.
   *Why this is still needed:* the client refuses to show a pairing screen while
   credentials exist (`canPair` in `vizora-tv/src/main.ts`, normative in
   `docs/design/revocation-contract.md`). #377/#378 change which row a session binds to;
   they do not change how a TV reaches pairing mode.
2. **At the TV:** relaunch the app. It shows a fresh 6-character pairing code.
3. **Dashboard:** open the **original** display — `50a2280f`, "Mobile", the one showing
   **Mana Ruchulu**. Do **not** open "Home".
4. Choose **Re-pair display** and enter the code currently on the TV screen.
5. Confirm. The TV's own poller receives the credential — it is never shown in the
   dashboard.

## Verify before touching anything else

6. `50a2280f` becomes **online** and heartbeating (~15s interval).
7. **Mana Ruchulu** is rendering on the screen.
8. The **71 impressions** are still attached to `50a2280f`.
9. Quota still reads **2 of 5** — a rebind consumes no additional slot.

## Only then, the accidental row

10. **Disable** `3da5dcb9` ("Home"). Do **not** delete it.
    *Why disable:* `content_impressions.displayId` is `ON DELETE CASCADE`, so deleting
    destroys that row's history. Disabling preserves it.
11. Confirm the active count drops from 2 to 1. Verified in code: **both** quota counters
    — `pairing.service.ts` `enforceScreenQuota` and `billing/guards/quota.guard.ts` —
    select `displays: { where: { isDisabled: false } }`, so a disabled row genuinely
    stops counting.

**Delete neither row.** `50a2280f` is the logical display; `3da5dcb9` holds 10 real
impressions.

## Why Vizora cannot do this for them

There is no supported cross-org path. `isSuperAdmin` exists on `pbc.srini@gmail.com`, but
it only grants a **DB-layer tenant bypass** (`deriveTenantContext`); the display
controllers pass `@CurrentUser('organizationId')` explicitly and `DisplaysService.update`
calls `findOne(organizationId, id)` first, so a super-admin's lookup scopes to their own
org and returns NotFound. The super-admin-gated admin module has only org-level routes
(plans, promotions, suspend/unsuspend) — no display-level operations at all.

Direct SQL would work and is deliberately **not** used: it bypasses the tenant, skips the
pairing session the credential must come from, and would leave the TV holding a
credential the server never issued to it.

## If the tenant cannot act

Leave both rows as they are. The screen currently works (bound to `3da5dcb9`, showing
Promotions), quota is 2 of 5 with no pressure, and no data is at risk. The only cost of
waiting is that the original identity and its 71 impressions stay detached from the live
screen.
