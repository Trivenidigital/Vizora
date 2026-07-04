# T2 pull-on-connect — offshore hardware field-validation checklist

Increment 5's green client tests are the **spec half** (the version-wins decision + the pull/reconcile
plumbing, keyboard-closed). This is the **field half** — the three device behaviors only real silicon on a
real network can confirm. Increment 5's test suite is the client-side oracle the way B12 is the server-side
oracle: spec-green + hardware-red isolates cleanly to the device.

## The three checks (real hardware, real network)

1. **Pull fires on a real cold-boot connect.** Power-pull the device; on boot + socket connect, confirm it
   pulls `GET /devices/me/content` and renders the authoritative content **without a manual re-trigger** —
   not just an emulator reconnect. (This is the F1-boot × Finding-2 field version, now on the pull path.)
   Watch: the request actually fires on the FIRST connect after a cold boot, and applies via version-wins.

2. **Heartbeat-reconcile self-heals a drifted device over a real flaky link.** With the socket STAYS-UP but
   flaky (no disconnect), change the device's assigned content server-side so its rendered version drifts
   from authoritative. Confirm the device re-pulls and reconciles **without a disconnect** — this is the
   connected-but-flaky-never-drops residual (Finding-2 residual 1) the emulator can't fake.
   **NOTE — server-side dependency (completing piece, see below):** the client carries `contentVersion` on
   the heartbeat and re-pulls when the server sets `reconcileContent: true`. The realtime heartbeat handler
   must compute/compare the authoritative version and set that flag; until that lands, this check exercises
   only the client plumbing. Verify the server-compare is wired before this hardware check.

3. **A reconcile/pull FAILURE holds last-known-good, never blanks.** Force the pull to fail (kill the
   backend / drop the network) at a reconcile moment and confirm the device **keeps playing what it has** —
   never a black frame. The `pullContent` `try/catch` keeps last-known-good by construction (never touches
   `currentPlaylist` on error); this check proves it under real flaky-network conditions, which is exactly
   where an emulator green-tests but only hardware confirms the never-black invariant on the reconcile path.

## Completing piece (keyboard follow-up before check #2 is meaningful)

The heartbeat-reconcile **server side** is not yet built: the realtime heartbeat handler must set
`reconcileContent: true` when the device's reported `contentVersion` differs from the authoritative version.
Recommended design (to avoid a per-heartbeat `resolveEffectiveContent` at fleet scale): track the
**last-version-pushed per device** (in-memory/Redis, updated on each `sendInitialState`/push) and compare the
heartbeat's reported version against it — a cheap two-value compare, no resolve on the heartbeat path. The
client is already wired for the signal. Pull-on-connect (check #1) is fully wired client+server and needs no
follow-up; only heartbeat-reconcile (check #2) has this dependency.

## What is keyboard-closed vs field-pending

- **Keyboard-closed:** the version-wins decision (7 client acceptance tests incl. same-version-no-reflash),
  pull-on-connect wiring, the versioned-push→version-wins route, the fail-safe `try/catch`, and — server-side
  — the resolver + serializer + `GET /devices/me/content` + `sendInitialState`-via-resolver (push==pull is a
  wire fact).
- **Field-pending (this checklist):** does the pull actually fire on a real cold-boot connect; does
  heartbeat-reconcile self-heal over a real flaky link (with the server-compare wired); does a reconcile-pull
  failure hold last-known-good on real hardware. Green client tests do **not** mean "Finding-2 closed on
  hardware" — keyboard-closed, field-pending.
