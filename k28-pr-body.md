# fix(ops): schedule-doctor must not read the alerting-suppression list as an existence oracle

Backlog **K28**. Branch `fix/schedule-doctor-existence-oracle`.

> **CI is externally blocked** (GitHub is not creating workflow runs for this repo — control-plane/quota, not our code). Everything below was run locally.

## The defect

`schedule-doctor.ts` check 2 (`orphan_schedule`) **could never be a true positive, and could be a damaging false one.**

`Schedule.displayId` carries `ON DELETE CASCADE` to `devices(id)` (`schema.prisma:222-223`, and the init migration's FK), and `DisplaysService.remove()` (`displays.service.ts:452-455`) is a hard `deleteMany` — so a schedule pointing at a *deleted* display cannot exist. **Verified on prod: that row count is 0.**

What it *could* do was mistake a merely **disabled** display for a deleted one. `:165` rebound `displays = displays.filter(d => d.isDisabled !== true)`, so `displayIds` (`:181`) was built from the **alerting-suppression** list and then used at `:286` as the **existence oracle**. #259's rationale (`:159-162`) is about paging noise; it says nothing about existence. Reusing one for the other is the category error. The consequence: an active schedule targeting a disabled display was PATCHed to `isActive: false` (`:296`), raised a **critical** incident claiming the display "no longer exists" (`:327`), and fired an inline Slack alert (`:309`).

**Second path, worse:** `scanComplete` gated only incident **resolution** (`:444`) — the four checks ran unconditionally. A truncated display walk (>500 in an org) therefore made **every** active schedule targeting a display beyond the cap look orphaned, and mass-deactivated them in one run.

## Prod state at fix time (read-only, operator-verified)

| Fact | Value |
|---|---|
| Orphan rows (schedule → nonexistent display) | **0** — cascade confirmed |
| Disabled displays | **5**, all in the ops principal's own org — the precondition is **ARMED** |
| Active schedules currently targeting a disabled display | **0** — so it has never fired (0 incidents, 0 remediations, 0 log mentions) |
| `SLACK_WEBHOOK_URL` on prod | **UNSET** — had it fired, the write-site alert was a no-op and the operator would have been told nothing |

## What changed

### 1. Stop rebinding — two bindings whose names carry their meaning

`allDisplays` is the **existence universe**, straight from the scan. `alertableDisplays` is that list minus `isDisabled`, and exists **only** to suppress paging. `displayIds` is now built from `allDisplays`; **check 4 keeps iterating `alertableDisplays`** so #259's contract still holds. A comment at the binding site and in the file docblock states why they must not be merged.

### 2. Gate check 2 on `scanComplete`

A truncated walk cannot prove **nonexistence**, exactly as a partial scan cannot prove recovery. The file already applies that reasoning to incident resolution; `content-lifecycle` applies it to its destructive archive path. The skipped branch logs `SKIP absent-display check` rather than passing silently.

### 3. Make check 2 non-mutating and downgrade it

The PATCH and the inline alert are **gone**. Severity `critical` → `warning`. The message says the display is *"absent from this complete scan"* and explicitly frames it as a fault in **this agent's view** (org scope, response-shape drift, page walk), not as broken tenant data — never as a deletion.

**The check is kept, not deleted.** With the oracle fixed, a surviving fire is a genuine signal that the agent's view of the tenant is wrong — a useful invariant monitor. It is just worth nothing at all to auto-"fix": mutating customer schedules on the strength of a view we have *just declared unreliable* is the entire K28 damage.

## Also: `fleet-manager` `cluster_offline` (non-mutating, wording + honesty)

`orgDisplays` is grouped from the already-filtered list, then the incident asserted *"All N displays in organization X are offline"* — quantifier, count **and** the `< 3` gate all over the subset, naming a fleet size that does not exist.

**Judgment on the gate: it should keep counting the ENABLED subset.** The threshold exists because "one screen is dark" is ordinary and "the whole fleet is dark" is infrastructure — so what it is really counting is **independent agreeing signals**, and a disabled display emits none (it is excluded from `allOffline` too). Counting disabled displays toward the gate would let a fleet of one live screen and two shelved ones raise a critical outage — the exact shape #259's own test forbids.

What was *not* defensible was the silence and the wording. Fixed:
- message now reads `All N enabled display(s) … (M total, K operator-disabled and not evaluated)`;
- an org pushed **below** the threshold *by disabling* is now logged (`below the cluster-outage threshold on ENABLED displays (N of M; K operator-disabled) — not evaluated`) instead of silently dropping out of outage coverage.

## Tests

The fixture server in `schedule-doctor-resolution.test.ts` now **RECORDS PATCH bodies**. It answered PATCHes but kept no log, and "no mutation happened" is the load-bearing assertion in every case here — an incident-only assertion stays green for a rewrite that keeps the write and drops the finding (proven by mutation **M3** below).

New behavioural cases (spawn-harness):
- **KEY** — an active schedule targeting a **disabled** display is neither flagged nor deactivated: no `orphan_schedule` incident **and zero PATCHes**, exit 0.
- **Truncation** — 500 displays with `meta.total` 600, one active schedule targeting a display on the unseen page → zero PATCHes, no incident, `scan-truncated` raised, `SKIP absent-display check` logged.
- **Don't over-block (#259 guard)** — a disabled display with no playlist and no schedule raises **no** `coverage_gap`.
- **Past-end still deactivates** — an active schedule with a past `endDate` against an **enabled** display still PATCHes `{isActive:false}`, proving the new gate was scoped to check 2.

New source-scan file `schedule-doctor-orphan-gate.test.ts` (6 cases, mirroring `content-lifecycle-archive-gate.test.ts`): no `api.patch`/`post`/`put`/`delete`/`sendInlineAlert` anywhere in the check-2 block; no `critical`; no "no longer exists"/"nonexistent" wording; the `scanComplete` gate encloses the oracle read; `displayIds` is built from `allDisplays`; check 4 iterates `alertableDisplays`; `allDisplays` is never narrowed in place.

Plus 3 cases in `fleet-manager-disabled.test.ts` for the `cluster_offline` wording, the not-silent below-threshold log, and the gate arithmetic.

## Mutation table (every row run; results read from output)

| # | Mutation | Result |
|---|---|---|
| M1 | `displayIds` built from `alertableDisplays` again (the K28 defect, oracle only) | **RED** — `K28: a schedule targeting a DISABLED display…` (incident assertion) + `the existence oracle is built from allDisplays…` |
| M2 | M1 **+** the check-2 `api.patch` restored | **RED** — the above **+** `check 2 issues NO write of any kind` |
| M3 | M2 **+** the check-2 incident push deleted (keep the write, drop the finding) | **RED** on the **PATCH assertion** of the KEY test: `the agent must not write ANYTHING here. Recorded: [{"path":"/api/v1/schedules/sched-on-disabled","body":{"isActive":false}}]` |
| M4 | check-2 `scanComplete` gate removed | **RED** — `K28: a truncated display walk cannot mass-deactivate schedules` + `check 2 runs only under a complete scan` |
| M5 | check 4 iterates `allDisplays` | **RED** — `K28 must not over-block…(#259)` + `check 4 keeps iterating the FILTERED list (#259)` + `K24: skips that CARRY evidence still resolve their incidents` |
| M6 | past-end auto-fix no longer writes | **RED** — `K28: check 1 still auto-deactivates a past-end schedule` |
| M7 | `cluster_offline` message reverted to the bare `All ${orgList.length} displays in organization` | **RED** — `the cluster_offline message reports enabled AND total, not a bare "All N"` |

**Note on M1 vs the spec.** The task asked for a single mutation ("build `displayIds` from the filtered list again") that turns the KEY test red on **both** assertions. It cannot, and the reason is the fix itself: with the PATCH removed, restoring only the broken oracle re-raises the finding but writes nothing — M1 is red on the incident assertion only. M2 restores the write alongside it and turns both red; **M3 is the one that matters**, because it isolates the PATCH assertion — it keeps the write, drops the incident, and is caught *only* by the recorded-PATCH assertion. That is precisely the "kept the write, dropped the finding" rewrite the incident assertion alone would wave through.

## Gates

| Gate | Result |
|---|---|
| `pnpm test:ops` | **582 / 582 pass, 0 fail** (baseline 569 + 13 new) |
| `pnpm typecheck:ops` | **exit 0** |
| Protected files byte-unchanged | `health-guardian.test.ts`, `tv-download-surface.test.ts`, `incident-resolution.test.ts` — **untouched** (`git status` clean for all three) |
| `fleet-manager-*.test.ts` | green (inside the 582) |

## Docs / backlog

- **K28 → READY FOR PR** with the full disposition recorded.
- **New K29** (Low, OPEN): a schedule deactivation writes **no `AuditLog` row** — there are zero `auditLog.create` calls under `middleware/src/modules/schedules/`, and `Schedule` has no `updatedBy`. So an agent-authored deactivation is indistinguishable from an operator's except by timing, which is exactly why retro-detecting whether this defect ever fired on prod needed a heuristic instead of a query. Residual risk is smaller now that check 2 writes nothing, but any future agent write to schedules should land with the audit row.
- `CLAUDE.md`: schedule-doctor row rewritten (the "known false positive, NOT fixed (K28)" note is replaced by the two-bindings invariant, the non-mutating gate, and the K29 audit gap); fleet-manager row gains the `cluster_offline` quantifier note.

## Not done / out of scope

- No `middleware/` or `web/` changes.
- K29 itself is recorded, not implemented.
- Deployment: none. This changes an ops agent that runs on prod every 15 min; it takes effect on the next deploy of `scripts/`.
