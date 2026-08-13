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

- [x] **PR1 — brand truth + ink token + shell** (`feat/ui-shell-foundation`)
      Backend served `#0284c7` as the default brand colour, which the client writes onto
      `--primary` app-wide → every un-customised tenant ran a sky-blue dashboard. Fixed, plus
      a new `--primary-ink` token (neon is a FILL, 1.65:1 as text on white), contrast-safe
      ink derivation for tenant colours, sidebar a11y/targets, and the devices-table scroller
      (row actions were unreachable at 1440px). Devices clipping 23 → 0; dashboard mobile
      touch failures 15 → 5.
- [x] **#309 — dashboard device identity + honest timestamps.** MERGED (`74bfb0fc`).
      Socket handler replaced the stored entry with a metadata-less payload, erasing every
      device's nickname/location/lastSeen on the first status event; `lastSeen` then fell back
      to `new Date()`, so a chronological list was sorted by fabricated timestamps.
- [x] **#310 — command palette dismissable.** MERGED. `onOpenChange` had zero call sites, so Escape,
      backdrop and command-selection all wrote to state nothing read. Guarded the duplicate
      ⌘K listener, which would otherwise double-toggle and stop the palette opening at all.
- [x] **#308 — brand truth + ink token + shell.** MERGED (cf1a1f1d).
- [ ] **#311 — dialog focus management** (useDialog: Escape/scroll-lock/focus-trap/restore; 45 call sites unchanged). CI.
- [ ] **#312 — light substrate re-point** (:root -> Electric Horizon cool grey). CI.
- [ ] **PR-next — .eh-* light repair (P2).** Re-point the light `:root` block to the Electric
      Horizon substrate (currently warm cream `#F0ECE8` vs marketing cool grey `#E9EEEF`),
      and repair the unscoped `.eh-*` utilities for a light substrate. CSS-only; upgrades
      20–28 files with zero TSX churn.
- [ ] **PR3 — `.mkt` semantic leak (live bug).** `.mkt` never redeclares
      `--success/--warning/--error/--info`, so the *dark* values resolve on the light auth
      pages: validation messages render `#ef4444` at ~2.3:1. Affects all four auth screens.
- [ ] **PR4 — Dashboard overview.** Includes the confirmed data bug: the socket handler at
      `DeviceStatusContext.tsx:95` does `{...prev, [id]: data}`, replacing the entry with a
      payload carrying no `metadata` — so every device loses nickname/location/lastSeen on
      the first status event ("Unnamed Device", and `lastSeen` falls back to `new Date()`,
      fabricating a timestamp).
- [ ] **PR5 — Devices.** Preserve the assigned-vs-delivery-deferred distinction.
      `.eh-badge-success` carries Online/Offline truth at 2.09:1 on light — highest
      product-correctness risk in the repo.
- [ ] **PR6 — Playlists.** Also carries the assigned-vs-deferred distinction.
- [ ] **PR7 — Content.** `content/page-client.tsx` is 2,771 LOC — must be split before it is
      restyled, not during.
- [ ] **PR8 — Schedules** (information architecture first, not styling).
- [ ] **PR9 — Settings/billing/team** consistency pass.
- [ ] Global: `<Overlay>` (42 consumers) and `<Banner>` (7 call sites) primitives.
- [ ] Bounded maintenance: B3 `.env.local` modelling gap; typecheck for `scripts/release/**`
      (currently excluded in `scripts/tsconfig.json` with a stated reason).

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
