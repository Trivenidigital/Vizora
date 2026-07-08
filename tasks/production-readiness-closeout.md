# Vizora — Production-Readiness Close-Out

**Date:** 2026-07-05 · **Scope:** the full hardening arc (backend `vizora` + realtime + TV app `vizora-tv`).
**One-line state:** *the keyboard-provable build work is complete; what remains is the operator's flip, the
coordinated merges, offshore's hardware sitting, live keys, and the keystore — none of it more build.*

This is the capstone record: (1) every finding/PD with final disposition, (2) the nine dimensions re-scored
with honest wording, (3) the coordinated-merge runbook with dependency order. Hand it to offshore, to a
future session, or to yourself when the hardware results land.

---

## Part 1 — Findings & decisions: final disposition

### Merged to `main`
| ID | What | Status |
|---|---|---|
| B1–B16, Slice 0, contract 1–5 | prior engagement (webhooks/billing/revocation/JWT-TTL) | ✅ MERGED (see the original close-out table) |
| T1 | schedules UI interim hide (C-7 exposure stop) | ✅ MERGED (`54943c29`) |
| T3 / PD-4 | register `default` throttler → per-route auth limits FIRE + upload 30/min | ✅ MERGED (`10e918f7`) |
| T2 S1-2 filter | `findActiveSchedules` drops expired/archived content | ✅ MERGED (`8c6c3d82`) |
| T4 bare-id sweep (1) | folders/webhooks/tag-rules/provisioning org-scoped | ✅ MERGED (`13f79b85`) |

### Built + build-verified, HELD for coordinated merge (nothing on `main` but records)
| ID | What | Branch / commit |
|---|---|---|
| PD-5 | pairing poll-secret + atomic release (JWT-leak) — reviewed SHIP | vizora + vizora-tv `fix/pd5-pairing-pollsecret` |
| PD-6 | Redis ThrottlerStorage (prod) — limits true across PM2 cluster | vizora `fix/pd6-redis-throttler-storage` |
| PD-7 | `content.updatedAt` in realtime payloads (signature discriminator) | vizora `fix/pd7-content-version-payload` (backend); TV half on the T2-TV branch |
| T4-2 | bare-id sweep (support/template-library/pairing + updates) | vizora `fix/tenant-guard-enforce-prereqs-2` |
| bypass-context | webhook `recordAttempt` + template `clone` under bypass — reviewed SHIP | vizora `fix/enforce-bypass-system-writes` |
| **T2 delivery** | resolver + pull endpoint + serializer + push==pull + PD-9 zones + heartbeat-reconcile server | vizora `fix/t2-effective-content-resolver` |
| **T2 TV + PD-1 + PD-7-TV + inc.5** | signature no-op + pull-on-connect + version-wins + reconcile client | vizora-tv `fix/pd1-updateplaylist-idempotent` |
| Finding-2 backend | connect-time strand + `requeued` short-circuit fix | vizora `fix/finding2-reconnect-rehydration` — **largely SUPERSEDED by T2** (see runbook) |

### Findings closed keyboard-side
- **PD-3 / C-7** (schedule-only content delivered by no path) — ✅ CLOSED: the resolver delivers
  `schedule ?? currentPlaylist` on both channels (pull + push).
- **Finding-2** (reconnect strand + never-drops residual) — ✅ CLOSED keyboard-side: pull-on-connect covers
  reconnects; **heartbeat-reconcile covers the connected-but-flaky-never-drops residual** (server compares
  reported version vs a last-sent-per-device cache → signal → client self-heals, fails safe). Field-pending
  on offshore for the real-hardware behaviors.
- **PD-9** (layout zone coherence) — ✅ CLOSED: shared-path zone resolution + per-zone versioning.

### Open — operator decisions / config / hardware (NOT build)
| ID | What | Gate |
|---|---|---|
| HS-1 | keystore in the working tree | **verify off-machine backup opens, THEN relocate** (two steps; the verify is operator-only) |
| HS-2 | live PSP/SMTP keys | insert behind a live-mode-test-key sandbox smoke |
| HS-3 | hardware sitting | offshore; three checklists (below). Survivability 2.5 until it runs |
| HS-4 | `TENANT_GUARD_MODE=enforce` flip | surface enumerated+executed; **log-warn window over a representative traffic cycle first** (empirical confirmation the static enumeration matches runtime), then the realtime `$use` guard |
| PD-2 | CSRF 403-before-401 order | operator/security ruling (defensible either way) |
| PD-8 | per-org upload throttle keying | follow-up (per-IP shared-NAT collision) |

---

## Part 2 — Nine-dimension scorecard (honest re-score)

| # | Dimension | Score | Honest wording |
|---|---|---|---|
| 1 | Tenant isolation | **4** | **Structural in middleware, convention-safe in realtime — pending the flip + the realtime `$use` guard.** Enforce surface enumerated + executed on evidence (all 6 points), but log-only until the flip; realtime is safe-by-construction (verified) but unenforced. A legitimate 4; 5 needs BOTH the flip and the realtime guard. |
| 2 | Publish-path safety | **3\*** | Not deep-audited this arc; publish-lock guard adjacent. Flag stands. |
| 3 | Delivery reliability | **4** | C-7 + Finding-2 closed keyboard-side on both channels/processes incl. the never-drops residual; push==pull is a wire fact. Not 5: increment-5 client behaviors are field-pending on offshore (pull-on-real-connect, reconcile-over-flaky-link, reconcile-failure-holds-LKG). |
| 4 | Billing & entitlement | **4** | Webhooks + idempotency + entitlement ladder. Not 5: live-key sandbox proof outstanding (HS-2). |
| 5 | Identity & security | **3.5** | Throttles fire (T3 merged). → ~4 when PD-5 (JWT leak) + PD-6 (cluster 2× storage) merge. |
| 6 | Observability | **3** | screenState/playbackSource ingested; watchdog. Not higher: fleet dark-screen UI + crash reporting. |
| 7 | Economics | **n/a** | Cost-per-screen unmeasured — out of scope. Do not claim a number. |
| 8 | Testing | **4** | Strong negative suites + B12 lifecycle E2E. **STANDING FINDING (mild downward pressure): unit-green is necessary-not-sufficient — EIGHT build-verify catches in T2, in TWO classes.** (a) 6 **type-level** (moved helpers, ts-jest ESM, missing `databaseService`, orphaned imports, resolver Pick, serializer item shape) → build-breaks, caught by the full typecheck not unit mocks; fix = **CI cross-app typecheck gate**. (b) 2 **runtime cross-process contract** (ack `.data` wrapping made heartbeat-reconcile SILENT-INERT; `forbidNonWhitelisted` DTO) → invisible to typecheck AND unit mocks; fix = **integration ack round-trip / shared contract type — ranked ABOVE the typecheck gate** because silent-inert doesn't announce itself. |
| 9 | Code & ops quality | **3.5** | rawBody/email/migration hygiene; the T2 shared-package + resolver are clean single-source. |
| — | **Survivability** | **2.5** | **Pending offshore.** Nothing keyboard-side moves it — it needs real silicon. |

---

## Part 3 — Coordinated-merge runbook (dependency order)

**Nothing is on `main` except records/docs. All below are held branches. Merge in this order.** Note the
entanglement: the T2 delivery's resolver-based `sendInitialState` (increment 4) **supersedes** parts of
PD-7-backend and the Finding-2 strand fix — resolve at merge as noted.

1. **PD-6** (`fix/pd6-redis-throttler-storage`, vizora) — independent; acceptance = 429 at nominal (not 2×)
   across both PM2 workers on a running cluster.
2. **PD-5 pair, TOGETHER** (`fix/pd5-pairing-pollsecret` in BOTH vizora + vizora-tv) — coordinated deploy:
   new backend requires the poll-secret; old device can't pair. Merge/ship both or neither.
3. **T2 stack, as ONE unit** — vizora `fix/t2-effective-content-resolver` + vizora-tv
   `fix/pd1-updateplaylist-idempotent` **together**. The TV branch carries PD-1 (signature no-op), PD-7-TV
   (signature `updatedAt`), increment 5, and the reconcile client fix, so **PD-1 + PD-7-TV land WITH T2**.
   - **Supersession to resolve here:** T2's increment-4 `sendInitialState` (resolver + serializer) replaces
     the old currentPlaylist-only transform, so it **subsumes PD-7-backend's `sendInitialState` change AND
     the Finding-2 strand fix** (the resolver delivers authoritative content on every connect — no
     best-effort-pending strand). The T2 approach is the durable one; take it where they overlap.
   - Layouts: PD-9 (in T2) is what keeps layouts coherent — do NOT merge a T2 subset that lacks it.
4. **PD-7-backend** (`fix/pd7-content-version-payload`, vizora) — merge for the `pushContent` `updatedAt`
   (increment 4 superseded only its `sendInitialState` hunk; `pushContent` still uses the old transform).
   Verify the `sendInitialState` overlap resolves in T2's favor.
5. **Finding-2 backend** (`fix/finding2-reconnect-rehydration`, vizora) — **largely superseded by step 3.**
   Verify what (if anything) it still adds beyond T2's resolver `sendInitialState`; likely reconcile-to-a-
   thin-residual or skip. Do NOT merge its strand fix on top of T2's resolver path (double-render risk).

After merges: run the **log-warn window** (HS-4) over a representative traffic cycle before the enforce flip;
land the **realtime `$use` guard** for a structural dimension-1 5; then the flip is the operator's.

---

## Part 4 — What remains (explicitly NOT build)

- **Yours, gated:** the enforce flip (log-warn window first — that's empirical confirmation, not optional);
  the realtime `$use` guard (dimension-1's terminus).
- **Yours, to run:** the coordinated merges (Part 3 order).
- **Field-pending, offshore (HS-3):** the hardware sitting, carrying THREE checklists —
  1. **Revocation joint test** — `DEVICE_JWT_SECRET` rotation, zero black frames / zero wipe
     (`docs/slice0-device-revocation-contract.md`).
  2. **Survivability** — F1/F2/F3, native crash recovery, cold-reboot pulls content
     (`vizora-tv/docs/p0-3-hardware-verification-protocol.md`).
  3. **Increment-5 client behaviors** (`docs/t2-offshore-checklist.md`) — pull fires on real cold-boot
     connect; heartbeat-reconcile self-heals over a real flaky link; reconcile-pull failure holds
     last-known-good. Survivability stays 2.5 until these return.
- **Config:** live keys (HS-2), behind the sandbox smoke.
- **Yours, two steps (HS-1):** the keystore — **verify a copy opens off-machine, THEN relocate.** The verify
  is operator-only; it has outlasted the entire arc (first resolver commit → last reconcile fix) not because
  it's hard but because it was mis-scoped as trivial when it's actually "verify a backup, then move."

**Keyboard follow-ups (non-blocking, ranked):** (1) integration ack round-trip / shared contract type
(prevents the silent-inert class); (2) CI cross-app typecheck gate (prevents the build-break class);
(3) route `sendPlaylistUpdate` through the resolver (all pushes resolver-coherent). Details in
`tasks/pending-decisions.md`.
