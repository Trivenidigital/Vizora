# Product experience / internal UI redesign wave — 2026-08-13

Goal: someone moving from `vizora.cloud` into the authenticated app should feel they stayed
inside the same product. Benchmark = the light "Electric Horizon" marketing homepage.

Full audit + primitive analysis: `tasks/ui-wave-audit-2026-08-13.md` (9-agent audit, all
routes classified A–E, PR batching, measured token/literal pools).
Approved-but-superseded foundation doc: `docs/plans/2026-08-03-full-app-rebrand.md` — its
*mechanics* and 8 traps still hold; its "palette only, not a redesign" non-goal does not.

## Decisions taken (operator, 2026-08-13)

- **Light becomes the default theme; dark stays supported.** Discipline that makes this
  affordable: tokens only, no colour literals — both themes then work by construction
  rather than by double-verifying every page.
- **`/admin/*` (13 routes) and `/dashboard/ops` are out of scope.** They inherit the shell
  and tokens for free; they are not individually redesigned in this wave.

## Verification harness

`scripts/design/audit-surface.mjs` — drives the real app against the seeded synthetic tenant
and measures, per route × theme × viewport: element clipping (by ancestor-overflow walk, so a
working scroller is not flagged but `overflow-x: hidden` is), computed WCAG contrast,
touch-target size, console errors.

```bash
DEMO_TENANT_PASSWORD=… node scripts/design/audit-surface.mjs --tag before
```

Baseline on `main` (36 captures, 9 routes × {1440,390} × {dark,light}):
**166 clipped · 109 contrast failures · 420 touch targets < 44px · 72 console errors.**

## PR queue

### Merged — foundation phase (global surfaces every page inherits)
- #308 brand default `#0284c7` -> Electric Horizon, `--primary-ink`, shell, devices scroller
- #309 device identity + honest timestamps (socket handler no longer erases metadata)
- #310 command palette dismissable (`onOpenChange` had zero call sites)
- #311 dialog focus management (`useDialog`; ~45 call sites unchanged)
- #312 light substrate -> Electric Horizon cool grey
- #313 toast contrast + stacking + icon (58 files render ToastContainer)
- #314 audit recorded  /  #317 restored `tasks/todo.md` after I clobbered it
- #315 `.eh-*` utilities read tokens instead of hardcoding dark
- #319 `.mkt` semantic leak + semantic ink variants + `color-scheme: light`

### Merged — Devices correctness floor (functional truth before visuals)
- #320 stop stating what the backend cannot prove:
      "Currently Playing" -> "Assigned Playlist"; `unknown` state distinct from `offline`;
      homepage alt text corrected.
- #322 one status source per row (badge no longer a second store) + relative Last Seen
      in `<time dateTime>` with exact timestamp on hover.

### Next — Devices visual redesign
The correctness floor is in place, so the redesign can proceed without inventing meaning.
Hard invariant: `assigned != delivered != acknowledged != playing`. Keep the deferred-assignment
copy at `devices/page-client.tsx` ("Non-online devices will update when they come online") - it is
correct and server-backed.
Open design questions the redesign must answer: fleet scannability, bulk-action feedback on
partial failure, responsive table-to-card at 390px (row actions currently need horizontal scroll),
empty/filtered-empty/error/partial states, keyboard operability of row actions.

### Then
Playlists -> Dashboard overview -> Scheduling -> Content/Media -> Analytics -> settings surfaces.
Then Pool C by semantic family (see "Known traps"), not as a mechanical 1,094-literal replace.

### Confirmed backend follow-ups (NOT UI work, keep separate)
1. **Cron-detected offline never reaches an open dashboard.** The gateway broadcasts
   `device:status` to the org room on connect and disconnect (`device.gateway.ts:1401`, `:1777`),
   so the socket path is covered. The hole is when `handleDisconnect` never fires (realtime crash,
   half-open socket) and the middleware cron flips Postgres with no push. The internal push surface
   has `/api/push/playlist`, `/api/push/content`, `/internal/command`, `/internal/device-revoked` -
   **no status push**. Fix the consuming path; do not paper over it with wording.
2. **Redis liveness reads are dead** - `RedisService.getDeviceStatus` (0 callers),
   `HeartbeatService.getDeviceHealth` (0 callers; only a comment at `displays.service.ts:305`).
   Revive deliberately or delete. Do not wire new reads to them assuming they work.

### Locally observed, NOT classified as defects (need production evidence first)
- middleware cron `PrismaClientValidationError: lt: new Date("Invalid Date")`, ~1/min locally.
- `[Socket] join:organization - Not authenticated` on dashboard load locally.
Reproduce in production before treating either as real; otherwise record as local-env only.

### Deferred, recorded so it is not lost
- 52 sub-44px touch targets at 390px across the four auth screens.
- Auth pages show fabricated figures ("2,500+ organizations trust Vizora", and a
  "24 Screens / 148 Content / 99.9% Uptime" panel) that are hardcoded, not tenant data.

## Known traps (measured, not assumed)

- Pool C — **1,094** raw Tailwind semantic literals (`bg-red-500`, `text-amber-400`) across
  89 files — is larger than the neon problem and no token change touches it. Toast,
  TrialBanner, EntitlementBanner and ConfirmDialog are theme-invariant because of it.
- The neon set is **288 real sites, not 778**: the Tailwind namespace prefix *is* the
  classification (`text-[#00E5A0]` must become ink; `bg-`/`shadow-`/gradient stops keep it).
- `ui/DataTable`, `ui/Progress`, `ui/Avatar`, `ui/IconButton`, `ui/Tabs`, `ui/Accordion`,
  `ui/Stepper` have **zero** consumers. `components/Button.tsx` has one; `eh-btn-neon` has 28
  — fix the class, not the component.
- `CommandPalette` declares `onOpenChange` and never calls it: Escape, backdrop click and
  selection all hit dead state. It can only be dismissed by re-pressing ⌘K.

## Out of scope / do not touch

- Marketing `.mkt` routes are the benchmark: in scope for regression checking, not change.
- `feat/design-explorations` — never merge, never deploy.
- Widgets — operator has deprioritised.
- TV/APK work is owned by another session.
