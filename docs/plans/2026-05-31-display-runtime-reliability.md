# Display Runtime Reliability

**Goal:** Close the next customer-1 display reliability slice: unattended display clients should relaunch after reboot, keep screens awake during playback, emit proof-of-play IDs that match current API payloads, and have display unit tests gated in CI.

**New primitives introduced:** none. Reuse Electron main-process lifecycle hooks, Electron `powerSaveBlocker`, OS login/autostart mechanisms, the existing display Jest suite, and the existing CI workflow.

**Hermes-first analysis:**

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Electron display runtime reliability | none applicable | Build in existing Electron main process. |
| Proof-of-play ID mapping | none applicable | Build in existing renderer helper path and realtime payload contract. |
| CI test gating | none applicable | Extend existing GitHub Actions CI workflow. |

Awesome-Hermes-agent ecosystem check: not applicable; this change does not introduce business-agent workflows, MCP tools, AI provider calls, or spend paths.

## Drift Check

- K1/K2 are now closed in this branch: Electron main configures packaged-client auto-start and sleep prevention.
- K3 remains real in backlog: Electron main still only has an update-command stub; auto-update needs separate provider/signing/operator decisions.
- K4 is now closed in this branch: display Jest wiring and unit tests existed, and CI now runs `@vizora/display` tests, typecheck, and build.
- The Electron renderer now uses `getEntityId()` for proof-of-play/error IDs and cache/preload paths, preferring Prisma `id` with `_id` fallback.
- Auto-update is larger because it needs updater dependency, publish provider, signing/release-channel decisions, and operator release process; keep it out of this scoped PR.

## Plan

- [x] Add packaged-display auto-start in Electron main for Windows/macOS and Linux autostart desktops.
- [x] Add packaged-display sleep prevention via `powerSaveBlocker` with shutdown cleanup.
- [x] Add focused Electron main-process tests for auto-start and sleep-prevention behavior.
- [x] Add renderer ID helper and use it for proof-of-play/error payloads.
- [x] Add focused renderer helper tests.
- [x] Gate display unit tests in GitHub Actions CI.
- [x] Gate display typecheck/build in GitHub Actions CI.
- [x] Run multi-agent review before broad verification.
- [x] Run display tests/build and relevant broader checks.

## Review And Verification Evidence

- Electron runtime reviewer: initial packaged-guard and process-listener findings fixed; final re-review CLEAN.
- Customer-readiness/CI reviewer: initial cache ID, AppImage, and docs findings fixed; final re-review found only stale wording, now corrected.
- `pnpm --filter @vizora/display test -- --runInBand` - pass, 6 suites / 124 tests.
- `pnpm --filter @vizora/display typecheck` - pass.
- `pnpm --filter @vizora/display build` - pass.
- `git diff --check` - pass; line-ending warnings only.

## Review Focus

- Avoid changing production middleware/realtime state.
- Keep runtime guards scoped to packaged/production display clients so developer Electron sessions do not unexpectedly register login items.
- Do not introduce updater or release-provider plumbing in this PR.
- Ensure display tests run on Ubuntu CI without Electron GUI launch.
