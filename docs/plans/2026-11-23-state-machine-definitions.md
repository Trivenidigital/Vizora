# State-machine definitions: one declared vocabulary per lifecycle

**Status:** approved 2026-11-23 (operator said go on the approach below). Steps 1 and 2 done 2026-11-23; steps 3 and 4 not started.

**New primitives introduced:** `packages/database/src/lib/state-machines.ts` (pure
data + three tiny helpers), `scripts/ops/state-machine-conformance.test.ts`.

## Hermes-first analysis

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Declaring an app's own status vocabularies | not checked — no agent capability is being built; this is internal type/constant data | build in tree |

Ecosystem check: not applicable for the same reason. Verdict: Hermes-first governs agent
capabilities; this change gives existing agents a truthful vocabulary and builds none.

## Why

A sweep on 2026-11-22 found about 50 implicit state machines. No status column is a
database enum; each is a free `String`, a boolean or a nullable timestamp, and the list
of legal values is retyped at every consumer. The copies have drifted, and the drift has
already produced defects confirmed by reading source:

- `scripts/ops/fleet-manager.ts:399` PATCHes `status: 'inactive'`; the display DTO accepts
  only `online|offline|error`, so the error reset can never succeed.
- `scripts/agents/support-triage.ts` writes `urgent`/`normal` into
  `SupportRequest.priority`, whose ladder is `critical|high|medium|low`.
- `web/src/app/admin` checks `subscriptionStatus === 'trialing'`; the backend stores
  `trial`, so "Extend Trial" never renders.
- `scripts/ops/ops-reporter.ts` compares the stored system status with a recompute that
  `recordAgentRun` has already stored, so status-change alerts effectively never fire.

## Goals

- One declared definition per important machine: its states, a human label, a one-line
  meaning, a display tone, and the transitions the code performs today.
- Every existing copy pinned to that definition by a CI test, so new drift fails the build.
- The same data is what users see (labels), what developers read (one file), and what
  agents are told (MCP schemas, ops scripts).

## Non-goals (this change)

- No schema migration. Columns stay `String`.
- No runtime transition enforcement. The transition tables are DESCRIPTIVE: they record
  what the write sites do today, each entry cited to a file:line. Nothing consults them
  at runtime yet.
- No production import of the new module in step 1. Middleware jest maps
  `@vizora/database` to a hand-written mock, and web has no workspace dependencies; both
  make "just import it" a behaviour-affecting change. Step 1 pins copies by source scan.

## Anti-goals

- A definition that describes the system as someone wishes it were. Where the code
  permits `any -> archived`, the table says so.
- A conformance test that passes vacuously. It must prove its reach: each pinned copy
  must be found and parsed (a missing file or a zero-value extraction FAILS), and a
  control with a deliberately wrong value must fail.

## Approaches considered

1. **Postgres/Prisma enums.** Strongest guarantee, but needs migrations over live data,
   is expensive to revert, and rows already holding off-ladder values (`urgent`) would
   block the migration. Rejected for now; the definitions make it possible later.
2. **A state-machine library or runtime guards now.** Changes behaviour on billing and
   device paths that work today. Rejected for step 1; possible per machine later.
3. **Declared definitions + conformance ratchet (chosen).** Additive, no runtime change,
   catches the class of bug above at CI time. Known drift is listed explicitly with a
   reason, and the list may only shrink.

## Design

`packages/database/src/lib/state-machines.ts`, dependency-free, re-exported from the
package index. Five machines in step 1: `displayStatus`, `subscriptionStatus`,
`contentStatus`, `supportRequestStatus` + `supportRequestPriority`, `opsIncidentStatus`.

Each machine: `{ name, entity, field, states: Record<S, { label, description, tone,
written }>, transitions: Record<S, readonly S[]> }` plus derived `values`, `is(v)`,
`canTransition(from, to)`. `written: false` marks a value that is accepted or displayed
but that no server path writes (for example content `processing`).

`scripts/ops/state-machine-conformance.test.ts` (runs under `pnpm test:ops`, already in
CI) holds a manifest of known copies: file, how to extract the literal list, and the
required relation (`equal` or `subset`). Existing drift goes in an explicit
`KNOWN_DRIFT` list with file, value and reason; an entry that no longer reproduces fails
the test, so the list can only shrink.

## Order of work

1. Definitions + conformance test, no behaviour change.
2. The four confirmed defects, one commit each, each with a test, each removing its
   `KNOWN_DRIFT` entry where it has one.
3. Verify the unconfirmed sweep findings before acting on any.
4. Separately approved later: runtime guards, web flow cleanups, enum migration.

## Left to the builder

Exact extraction regexes, the per-state wording, and which copies are `equal` versus
`subset` — decided from the code, recorded in the manifest.
