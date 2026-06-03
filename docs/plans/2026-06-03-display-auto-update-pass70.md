# Display Auto-Update Command Pass 70 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Electron display client's `update` command stub with a real, admin-only, audited updater trigger that is safe to run without production env or release-provider changes.

**Architecture:** Reuse the existing fleet command path (`POST /fleet/commands` -> realtime `/api/commands/broadcast` -> Socket.IO `command`) and the existing Electron main-process command handler. The backend validates and forwards an update feed URL constrained by `DISPLAY_UPDATE_FEED_ALLOWLIST`; the display client validates the same host allowlist again, configures `electron-updater` with a generic feed only when packaged, starts a check/download, and installs after `update-downloaded`.

**Tech Stack:** NestJS DTO/controller/service tests, realtime DTO enum validation, Electron main-process TypeScript, Jest, `electron-updater`.

**New primitives introduced:** one focused Electron updater helper at `display/src/electron/display-auto-updater.ts`.

**Hermes-first analysis:**

| Domain | Hermes skill found? | Decision |
|---|---|---|
| Electron app auto-update | none applicable | Use `electron-updater` in the existing Electron client. |
| Fleet command authorization | none applicable | Reuse existing NestJS fleet controller/service path. |
| Realtime command fanout | none applicable | Reuse existing Socket.IO command delivery and queued-command path. |

Awesome-Hermes-agent ecosystem check: not applicable; this change does not introduce business-agent workflows, MCP tools, AI provider calls, or spend paths.

## Drift Check

- `display/src/electron/device-client.ts` has an `update` command branch, but it only logs "Auto-update not yet configured."
- `display/package.json` does not include `electron-updater`.
- `middleware/src/modules/fleet/dto/send-command.dto.ts` does not allow `update`, so the existing fleet endpoint cannot trigger the display branch.
- `realtime/src/types/index.ts` does not include `update` in `DeviceCommandType`, so realtime validation would reject it on the production broadcast command path.
- `docs/plans/2026-05-31-display-runtime-reliability.md` intentionally deferred auto-update because release-provider/signing decisions were out of scope. Pass 70 keeps those operator decisions out of code by requiring a feed URL per admin command.

## Files

- Modify `display/package.json` and `pnpm-lock.yaml`: add `electron-updater`.
- Create `display/src/electron/display-auto-updater.ts`: URL validation, updater configuration, one-time event listeners, async update check trigger.
- Create `display/src/electron/display-auto-updater.spec.ts`: focused tests for URL safety and updater calls.
- Modify `display/src/electron/device-client.ts`: route `update` commands to the helper instead of the stub.
- Modify `display/src/electron/device-client.spec.ts`: mock the helper and verify `update` executes/negative-acks on helper failure.
- Modify `middleware/src/modules/fleet/dto/send-command.dto.ts`: allow `update` and validate `feedUrl`.
- Modify `middleware/src/modules/fleet/fleet.controller.ts` and spec: make `update` admin-only.
- Modify `middleware/src/modules/fleet/fleet.service.ts` and spec: require/normalize safe update feed URLs and forward only `{ feedUrl }`.
- Modify `realtime/src/types/index.ts`: add `UPDATE = 'update'` to the command enum.
- Modify `realtime/src/dto/internal-api.dto.spec.ts`: assert realtime DTO validation accepts `update`.
- Modify `web/src/lib/api/fleet.ts`: type the optional `feedUrl` payload field.
- Modify `.env.example`, `.env.production.example`, and `CLAUDE.md`: document `DISPLAY_UPDATE_FEED_ALLOWLIST`.
- Modify docs/handoff files after verification: `backlog.md` and `tasks/todo.md`.

## Tasks

- [ ] **Task 1: Red tests for backend command validation and auth**
  - Add middleware tests:
    - `FleetController` rejects `update` from a manager with `ForbiddenException`.
    - `FleetController` allows `update` from an admin.
    - `FleetService` rejects `update` without `payload.feedUrl`.
    - `FleetService` rejects non-localhost `http://` feed URLs.
    - `FleetService` rejects hosts outside `DISPLAY_UPDATE_FEED_ALLOWLIST`.
    - `FleetService` forwards `update` as `{ type: 'update', payload: { feedUrl: 'https://updates.vizora.cloud/display' } }`.
  - Run:
    - `pnpm --filter @vizora/middleware test -- --runTestsByPath src/modules/fleet/fleet.controller.spec.ts src/modules/fleet/fleet.service.spec.ts`
  - Expected before implementation: failures on missing admin-only check and missing update payload behavior.

- [ ] **Task 2: Red tests for display updater execution**
  - Add `display-auto-updater.spec.ts` with tests for:
    - HTTPS feed accepted only when host is in `DISPLAY_UPDATE_FEED_ALLOWLIST`, updater `setFeedURL`, `checkForUpdates`, and `update-downloaded` -> `quitAndInstall`.
    - Non-localhost HTTP feed rejected.
    - Feed URLs with credentials or query strings rejected.
    - Unpackaged/dev display clients return a no-op result instead of calling `electron-updater`.
  - Add `device-client.spec.ts` tests verifying an `update` command calls the helper with `payload.feedUrl` and negative-acks if the helper throws.
  - Run:
    - `pnpm --filter @vizora/display test -- --runInBand display-auto-updater device-client`
  - Expected before implementation: failures because the helper does not exist and the device branch still logs a stub.

- [ ] **Task 3: Implement backend update command path**
  - Add `feedUrl` to `CommandPayloadDto`.
  - Add `update` to the command enum in middleware DTO and realtime `DeviceCommandType`.
  - Add admin-only guard for `update` in `FleetController`.
  - Add `buildUpdatePayload()` / `normalizeUpdateFeedUrl()` in `FleetService`, enforcing:
    - `feedUrl` is required.
    - host is in `DISPLAY_UPDATE_FEED_ALLOWLIST`, defaulting to `updates.vizora.cloud`, with localhost/loopback allowed for dev.
    - protocol is `https:` unless host is `localhost`, `127.0.0.1`, or `[::1]`.
    - URL credentials and query strings are rejected.
    - trailing slash is stripped before forwarding.
  - Add realtime DTO validation coverage for `DeviceCommandType.UPDATE`.
  - Run middleware focused tests until green.

- [ ] **Task 4: Implement display updater helper and command branch**
  - Add `electron-updater` with `NODE_OPTIONS=--use-system-ca pnpm add --filter @vizora/display electron-updater@6.8.3`.
  - Implement `display-auto-updater.ts`:
    - validate feed URL with the same safety rules as backend and the same `DISPLAY_UPDATE_FEED_ALLOWLIST` default.
    - return a logged no-op for unpackaged display clients so local/dev command tests do not invoke updater internals.
    - configure `autoUpdater.autoDownload = true` and `autoUpdater.autoInstallOnAppQuit = true`.
    - register `update-downloaded` listener once per updater object.
    - call `autoUpdater.setFeedURL({ provider: 'generic', url: feedUrl })`.
    - trigger `checkForUpdates()` asynchronously and log async failures.
    - document that production rollout requires signed display artifacts on the official update feed before operators send the command.
  - Replace the `update` stub in `DeviceClient.handleCommand()` with `triggerDisplayAutoUpdate(command.payload?.feedUrl)`.
  - Run display focused tests until green.

- [ ] **Task 5: Verification, review, and handoff**
  - Run focused and broader checks:
    - `pnpm --filter @vizora/middleware test -- --runTestsByPath src/modules/fleet/fleet.controller.spec.ts src/modules/fleet/fleet.service.spec.ts`
    - `pnpm --filter @vizora/display test:ci`
    - `pnpm --filter @vizora/display typecheck`
    - `pnpm --filter @vizora/display build`
    - `pnpm --filter @vizora/realtime test -- --runTestsByPath src/dto/internal-api.dto.spec.ts`
    - `git diff --check`
    - `pnpm security:no-hardcoded-jwts`
  - Request Claude Code review for display update safety, command authorization, tenant/auth impact, dependency/CI safety, and operator-gated release assumptions.
  - Update `tasks/todo.md` and `backlog.md` with branch/commit/tests/CI/review evidence. Do not claim production auto-update rollout; the remaining operator action is publishing signed display releases to an allowlisted feed host and then providing that feed URL when sending the admin command.
