# Vizora Authenticated-App Rebrand — Executable Wave Plan

**Basis:** the six route audits + the design benchmark, cross-checked against the repo at `main` (HEAD `a42c9edc`) on 2026-08-13. Every number below marked **[V]** I measured myself; **[A]** is the audit's claim, verified where flagged.

---

## 0. The shape of the work (read this before the matrix)

The audits and `docs/plans/2026-08-03-full-app-rebrand.md` both frame this as "classify 728 neon literals." That framing is wrong, and it is wrong in a way that would cost weeks. The actual work sorts into three pools with completely different economics **[V]**:

| Pool | Size | Files | Fixed by | Cost |
|---|---|---|---|---|
| **A — token-driven** `text-[var(--…)]`, `bg-[var(--…)]`, `border-[var(--…)]` | **3,407 occ** | 170 | one `:root` re-point, ~60 lines of CSS | **near zero** |
| **B — neon literals** `#00E5A0` | **778 occ** (not 728 — it grew) | 126 | namespace-based triage, see below | **medium, mechanical** |
| **C — raw Tailwind semantic ramp** `bg-red-500`, `text-amber-400`, `bg-success-500` | **1,094 occ** | 89 | hand edits only — **no token change touches these** | **the real long tail** |

Pool C is **larger than Pool B and is not mentioned anywhere in the plan doc or the audits.** It is why Toast, TrialBanner, EntitlementBanner, ConfirmDialog and NotificationBell are all rated D/C: they are theme-invariant by construction. Budget for it explicitly.

Pool B does not need hand-classification either. The Tailwind namespace prefix **is** the classification **[V]**:

```
text-[#00E5A0]        211   → MUST become --mint-ink #00745B    (the illegal set)
border-[#00E5A0]       72   → 38 have alpha (decorative, keep); 34 solid → triage
bg-[#00E5A0]          213   → 108 alpha tints + 105 solid fills  → KEEP (legal)
from-/to-/via-         22   → KEEP (gradient)
shadow-/ring-/glow    184   → KEEP (glow)
bare '#00E5A0' in JS   43   → hand-inspect (inline style / chart config / canvas)
```

**So the real mechanical set is ~211 + 34 + 43 = 288 sites, not 778.** A `grep -o 'text-\[#00E5A0\]'` codemod plus eyes on 43 bare-hex sites is the whole of Pool B.

Second correction that changes the plan: **the `.eh-*` "design system" is barely adopted [V].**

```
eh-btn-neon  28 files   eh-heading   28 files   eh-dash-card 20 files
eh-dash-title 13        eh-input     10         eh-gradient  10
eh-btn-ghost  7         eh-badge      5 files   eh-select     5
eh-th          3        eh-empty-state 2        eh-toolbar    1
eh-filter-pill 1        eh-progress    1        eh-skeleton   1
```

Re-tuning the shared `.eh-*` layer is a **cheap, high-leverage, CSS-only PR** that upgrades 20–28 files with zero TSX churn. It is *not* the rebrand. Anyone who believes "fix `.eh-*` and the app follows" will ship one CSS file and discover 100 files unchanged.

---

## 1. Route matrix

Classification: **A** benchmark-grade · **B** sound, cosmetic fixes · **C** structural defects · **D** broken or unusable on the target substrate.
Effort: **S** <½ day · **M** 1–2 days · **L** 3–5 days.
Provenance: **[A]** delivered audit · **[V]** my classification from repo evidence (the audit text for groups 2–6 was truncated in transit; these are measured, not guessed).

### Global chrome & shared primitives

| Route / surface | File | Cls | Eff | One-line reason |
|---|---|---|---|---|
| `/dashboard/**` app shell | `app/dashboard/layout.tsx` | **C** [A] | L | Fixed banner rail overlays every page's breadcrumbs; no logout below 640px; active nav 2.09:1 on light. |
| all routes — root layout | `app/layout.tsx` | **C** [A] | S | Mounts the dashboard-only ⌘K hint globally as a dark chip on light pages; skip link targets an id only the dashboard has. |
| global — ⌘K palette | `components/CommandPalette.tsx` | **D** [A,V] | M | **Confirmed live bug:** wrapper always passes `open`, `onOpenChange` is declared and never called — Escape/backdrop/select all hit dead internal state. Cannot be dismissed except by re-pressing ⌘K. |
| `/dashboard/**` breadcrumbs | `components/Breadcrumbs.tsx` | **B** [A] | S | Neon hover as text (1.65:1); no `aria-current`; deep paths clip under `overflow-x-hidden`. |
| `/dashboard/**` bell | `components/NotificationBell.tsx` | **B** [A] | S | `bg-red-500` badge at 3.76:1; 40px target; `loading` destructured and unused. |
| `/dashboard/**` notif dropdown | `components/NotificationDropdown.tsx` | **C** [A] | M | Fixed `w-96` overflows a 390px viewport by ~116px; unread + severity are colour-only; rows are click-`div`s inside `role="menu"`. |
| `/dashboard/**` theme toggle | `components/ThemeToggle.tsx` | **A** [A] | S | Zero colour literals; active state via elevation not hue. **This is the reference idiom.** |
| `/dashboard/**` trial banner | `components/TrialBanner.tsx` | **D** [A] | M | Hardcoded dark gradient `#061A21→#0a2a35` (off-palette); text drops to 2.00–3.05:1 composited on light. |
| `/dashboard/**` entitlement banner | `components/EntitlementBanner.tsx` | **D** [A] | M | Three `amber/orange/red-900` gradients + `-100` text — 100% Pool C, follows no theme. |
| `/dashboard` quota card | `components/UpgradeBanner.tsx` | **B** [A] | S | Healthiest banner; only accent literals + missing `role="progressbar"`. |
| global — toasts | `components/Toast.tsx` + `lib/hooks/useToast.tsx` | **D** [A,V] | M | **All four variants fail AA** (2.15–3.76:1); N toasts stack at the same `top-4 right-4`; `error` icon is a trash can. **58 files render `ToastContainer` [V]** — highest blast radius in the app. |
| global — modal | `components/Modal.tsx` | **B** [A] | S | Token-clean, scroll-locked, Escape-handled; `closeButtonRef` created and never focused; no focus trap; hardcoded `id="modal-title"`. |
| global — confirm dialog | `components/ConfirmDialog.tsx` | **C** [A] | M | A second dialog that *regressed* Modal: no Escape, no scroll lock; warning 3.19:1, info 3.43:1. |
| shared — empty state | `components/EmptyState.tsx` | **B** [A,V] | S | Well-adopted (**25 files [V]**); only the `rgba(0,229,160,0.08)` tint and a `rounded-xl` that loses to `.eh-btn-sm` (trap #4, live). |
| shared — skeletons | `components/Skeleton.tsx` | **A** [A] / **see §5** | S | Token-perfect — but **1 real consumer [V]**. Graded on quality, not adoption. |
| shared — spinner | `components/LoadingSpinner.tsx` | **B** [A] | S | Correct a11y; its only colour is raw neon at 1.65:1 — near-invisible on light, and it is the most-rendered indicator in the product (**95 files reference it [V]**). |
| global — error boundaries | `DashboardSectionError.tsx`, `app/error.tsx`, `ErrorBoundary.tsx`, `app/global-error.tsx` | **C** [A] | M | Four implementations of one screen; `global-error.tsx` inline-styles `#061A21` and can never follow the theme. |
| `/404` | `app/not-found.tsx` | **B** [A] | S | 96px `eh-gradient` numeral at 1.65:1/2.46:1 — invisible on light; `<h1>` is the string "404". |

### Auth (inside `.mkt`)

| Route | File | Cls | Eff | Reason |
|---|---|---|---|---|
| `/(auth)` layout | `app/(auth)/layout.tsx` | **C** [A,V] | M | **Confirmed:** `.mkt` (globals.css:191–241) never redeclares `--success/--error/--warning/--info` and never resets `color-scheme`. Dark values leak into light forms. **Live bug, not aspiration.** |
| `/login` | `login-content.tsx` | **B** [A] | M | 2 neon-text sites, `--primary` link text at 2.34:1, `text-amber-400` locked-state at 1.43:1, `tabIndex={-1}` on "Forgot password?". |
| `/register` | `register-content.tsx` | **C** [A] | M | Same palette faults plus the longest form under the `fixed` footer; 6 `var(--error/--success)` sites [V]. |
| `/forgot-password` | `forgot-password-content.tsx` | **B** [V] | S | Same shape at 243 LOC: 2 neon-text, 3 leaked-semantic sites. |
| `/reset-password` | `reset-password-content.tsx` | **B** [V] | S | Same shape: 2 neon-text, **8** leaked-semantic sites — the worst of the four. |

### Dashboard — business value order

| Route | File (LOC) | Cls | Eff | Reason [V] |
|---|---|---|---|---|
| `/dashboard` overview | `page-client.tsx` (716) | **C** | M | 9 neon (4 text); stat cards + quick actions are the pattern-proving surface; no `EmptyState` import. |
| `/dashboard/devices` | `devices/page-client.tsx` (781) | **C** | M | 7 neon (5 text); `.eh-badge-success` carries **Online/Offline truth at 2.09:1 on light** — highest product-correctness risk in the repo. |
| `/dashboard/devices/[id]` | `devices/[id]/page.tsx` (245) | **B** | S | 3 neon; small, token-heavy detail page. |
| `/dashboard/devices/pair` | `devices/pair/page.tsx` (314) | **C** | M | 10 neon (5 text) on the pairing-code screen — the highest neon density per line outside templates. |
| `/dashboard/playlists` | `playlists/page-client.tsx` (994) | **C** | L | 15 neon (8 text); carries the assigned-vs-deferred distinction; 994 LOC single client component. |
| `/dashboard/playlists/[id]` | `playlists/[id]/page.tsx` (424) | **B** | M | Only 2 neon, 0 text — already largely token-driven. |
| `/dashboard/content` | `content/page-client.tsx` (**2771**) | **D** | L | **30 neon**, 16 loading paths, a table, 2 empty states, in one 2,771-line client component. Unreviewable as a single PR — must be split before it is restyled. |
| `/dashboard/schedules` | `schedules/page-client.tsx` (1172) | **C** | L | 14 neon (6 text); calendar surface has its own colour system. |
| `/dashboard/analytics` | `analytics/page-client.tsx` (602) | **B** | M | **0 neon literals** — fully token/chart driven. Charts need a separate palette decision, not a literal sweep. |
| `/dashboard/health` | `health/page-client.tsx` (405) | **B** | S | 8 neon (3 text); uses `EmptyState`. |
| `/dashboard/templates` | `templates/page.tsx` (756) | **C** | M | 9 neon, **all 9 are text**; 2 tables; no `EmptyState`. |
| `/dashboard/templates/[id]` | `templates/[id]/page.tsx` (767) | **C** | M | 22 neon (6 text) — second-densest file in the app. |
| `/dashboard/templates/new` | `templates/new/page.tsx` (410) | **B** | S | 10 neon, 0 text — all fills. Cheap. |
| `/dashboard/templates/[id]/edit` | `edit/page-client.tsx` (377) | **B** | S | **0 neon.** Also the route that drops `id="main-content"` [A] — fix the skip-link there. |
| `/dashboard/layouts` | `layouts/page.tsx` (559) | **B** | S | 6 neon (2 text); uses `EmptyState`. |
| `/dashboard/layouts/[id]` | `layouts/[id]/page.tsx` (536) | **C** | M | 11 neon (2 text); canvas surface with its own substrate assumptions. |
| `/dashboard/widgets` | `widgets/page.tsx` (1049) | **C** | M | 12 neon; 3 empty states. **Operator has deprioritised widgets — schedule last or skip.** |
| `/dashboard/help` | `help/page.tsx` (404) | **A** | S | **Zero neon, zero raw literals.** Nothing to do. |
| `/dashboard/ops` | `ops/page.tsx` (542) | **B** | S | 1 neon; 4 table/scroll regions — internal-only surface. |

### Settings

| Route | File (LOC) | Cls | Eff | Reason [V] |
|---|---|---|---|---|
| `/settings` | `settings/page.tsx` (1039) | **C** | L | 17 neon; 1,039 LOC; no `EmptyState`. |
| `/settings/team` | `team/page-client.tsx` (494) | **B** | M | 11 neon (3 text); table + roles — **role display is product-correctness, verify RBAC copy survives**. |
| `/settings/billing` | `billing/page.tsx` (360) | **C** | M | 11 neon, **7 are text**; billing state must stay unambiguous. |
| `/settings/billing/plans` | (283) | **B** | S | 3 neon. |
| `/settings/billing/history` | (188) | **B** | S | 2 neon; table; uses `EmptyState`. |
| `/settings/billing/cancel` | (42) | **B** | S | 1 neon. Destructive-confirm surface — verify the confirm copy. |
| `/settings/billing/success` | (88) | **B** | S | 4 neon (2 text). |
| `/settings/security` | (245) | **B** | S | 3 neon; MFA surface. |
| `/settings/api-keys` | (425) | **B** | M | 7 neon; 2 tables; secret-reveal surface. |
| `/settings/alerts` | (806) | **C** | M | **19 neon** (4 text) — densest settings file. |
| `/settings/audit-log` | `audit-log/page-client.tsx` (433) | **B** | M | 8 neon; 2 tables; uses `EmptyState`. |
| `/settings/customization` | (471) | **C** | M | 7 neon; **this page sets brand colours at runtime** — it can override the rebrand. Audit its token write path. |
| `/settings/feature-flags` | (162) | **B** | S | 2 neon. |

### Admin (13 routes) — `app/admin/{page,analytics,announcements,backlog,config,health,organizations,plans,promotions,security,support,system-health,users}`

| Group | Cls | Eff | Reason [V] |
|---|---|---|---|
| All 13 admin routes | **C** | L (whole group) | Internal, super-admin-only. `PlanForm.tsx` (17 neon) and `PromotionForm.tsx` (11 neon) are the only dense files. **Explicitly deprioritise to the final wave** — zero customer visibility, and it is the natural place to absorb schedule slip. |

### Marketing (7 `.mkt` routes) — `/`, 5 legal pages, `(auth)` layout

**Out of scope for change. In scope for regression.** These are the benchmark; every CSS PR must prove it did not move them.

---

## 2. Minimum shared primitives — before any page work

Rule applied: **reject anything with fewer than 2 real consumers.** Consumer counts measured, not estimated.

### ACCEPT — 4 items

| # | Primitive | Replaces | Real consumers **[V]** | New file? |
|---|---|---|---|---|
| **P1** | **The light `:root` token block** — promote the `.mkt` base-token reset (globals.css:230–241) into `:root` | The warm-cream `:root` palette (`#F0ECE8`) that makes the app's existing Light mode off-brand | **170 files / 3,407 occurrences** of `*-[var(--…)]` | No — edit `globals.css`. ~60 lines. |
| **P2** | **The unscoped `.eh-*` light repair** — `.eh-btn-neon` → mint, `.eh-btn-ghost`/`.eh-card` un-darken, `.eh-gradient` → the `.mkt` stops, `.eh-badge-success` → ink, `.eh-select` chevron, `--focus-ring-color` | Per-file hand edits to 28 button sites, 20 card sites, 10 gradient sites | `eh-btn-neon` **28**, `eh-heading` **28**, `eh-dash-card` **20**, `eh-gradient` **10**, `eh-btn-ghost` **7**, `eh-badge` **5** | No — edit `globals.css`. Zero TSX churn. |
| **P3** | **`<Overlay>`** — generalise `Modal.tsx` with focus trap, `useId()`, focus restore, one scrim token | `ConfirmDialog` (**29 files**), `CommandPalette`, `PreviewModal`, `DevicePreviewModal` — 5 independent dialog shells | Modal **13 files** + ConfirmDialog **29 files** = **42** | No — generalise `components/Modal.tsx`. |
| **P4** | **`<Banner>`** — promote `EntitlementBanner`'s file-local `BannerShell`/`PayLink`/`DismissButton` to a shared module, tokenised | 3 inline shells in `TrialBanner` + 3 rungs in `EntitlementBanner` + `UpgradeBanner` | 3 files / **7 call sites** | No — extract from `EntitlementBanner.tsx:81–114`. |

### REJECT — and do not let anyone re-propose them

| Rejected | Real consumers **[V]** | Verdict |
|---|---|---|
| `ui/DataTable.tsx` | **0** | Dead. Do not build page work on it. |
| `ui/Progress`, `ui/Avatar`, `ui/IconButton`, `ui/Tabs`, `ui/Accordion`, `ui/Stepper` | **0 each** | Dead. Delete in a housekeeping PR or leave; either way, ignore. |
| `components/Button.tsx` (React) | **1** | Rejected. `eh-btn-neon` has **28**. **Fix the class, not the component.** |
| `ui/Card`, `ui/Badge` | 4, 4 | Rejected as primitives. `eh-dash-card` (20) is the real card; badge folds into P2. |
| `<PageHeader>` / `<PageShell>` | 0 (new) | Rejected for wave 0. This is precisely the "design-system its way out before shipping" trap. Revisit **only after** the Dashboard PR proves the patterns. |
| `<Skeleton>` investment | **1** | Rejected. Praised as grade A on quality; it has one consumer. Do not propagate it in wave 0. |
| A new `<Toast>` primitive | — | Rejected as *new*. `Toast.tsx` is rendered by **58 files** — fix in place, never replace. |

---

## 3. PR batching plan

**Wave 0 — CSS truth (3 PRs, all CSS-only, all independently shippable).** Total < 200 lines. This is not a foundational abstraction; it is the smallest change that makes every later PR cheap.

---

**PR-1 · `fix(web): redeclare semantic colour tokens and color-scheme inside .mkt`**
- Files: `web/src/app/globals.css` (~10 lines).
- Adds `--success/--error/--warning/--info` (+ `-light/-lighter/-lightest`) and `color-scheme: light` to the `.mkt` block.
- Reviewer verifies: on `/login`, `/register`, `/forgot-password`, `/reset-password` — trigger a validation error and confirm the message is a **dark** red (`#dc2626`, 4.13:1+) not `#ef4444`; confirm the remember-me / terms checkboxes and Chrome autofill render **light**.
- Fixes 19 leaked-token sites across 4 routes **[V]**.
- **Risk: LOW.** Additive inside an existing scope. Cannot reach the dashboard.

**PR-2 · `feat(web): re-point :root to the Electric Horizon light substrate`**
- Files: `globals.css` (~60 lines) + `components/providers/ThemeProvider.tsx` (default decision).
- Copies the `.mkt` base-token reset into `:root`, retiring the warm-cream palette. `.dark` untouched. **`.mkt` stays — do not delete it in this PR.**
- **Must also settle the default-theme question** (plan doc §"Open questions"). A re-point with `ThemeProvider` still hardcoding `'dark'` (ThemeProvider.tsx:16,26) ships an invisible change.
- Reviewer verifies: toggle to Light on dashboard overview, devices, a settings page and a modal — substrate is cool grey `#E9EEEF`, cards `#FFFFFF`, body ink `#3E5860`. Then **re-check the homepage and 5 legal pages for zero visual delta**.
- 3,407 token occurrences across 170 files follow for free **[V]**.
- **Risk: MEDIUM-HIGH — the highest-blast-radius PR in the plan.** Mitigation: it is 60 lines and revertible in one commit; ship it alone, on its own deploy.

**PR-3 · `fix(web): repair the unscoped .eh-* layer for a light substrate`**
- Files: `globals.css` (~40 lines).
- `.eh-btn-ghost` (`border:#1B3D47; color:#9A958E` → tokens), `.eh-card` (`rgba(12,34,41,.6)` → `var(--surface)`), `.eh-gradient` (adopt the `.mkt` `#00A171→#0090B4` stops unscoped), `.eh-btn-neon` → `--mkt-mint` fill, `.eh-badge-success` `color: var(--primary)` → ink variant, `.eh-select` chevron data-URI (`%239A958E` is baked into the URL and no token reaches it), `--focus-ring-color` → 3:1-capable ink.
- Reviewer verifies: the brand wordmark in the dashboard header is **legible** (it is currently a 1.65:1/2.46:1 gradient on white); ghost buttons have a light hairline; the 404 numeral is readable; **re-check all 7 `.mkt` routes for zero delta**.
- **Risk: MEDIUM.** Shared layer. Mitigation: `.mkt` overrides win by specificity, so marketing is structurally protected — but verify it, don't assume it (trap #8).

---

**Wave 1 — global chrome (4 PRs). Ship before any page work; every page renders inside these.**

**PR-4 · `fix(web): status badges carry Online/Offline truth on a light substrate`**
- Files: `globals.css` (`.eh-badge-*`), `components/DeviceStatusIndicator.tsx`, `components/fleet/*` (~4 files).
- Reviewer verifies: a device that is **Online** and one that is **Offline**, side by side, in both themes, at 100% and 200% zoom, and in a greyscale screenshot. The two states must be distinguishable **without colour**.
- **Risk: HIGH (product, not visual).** This is the operator's "preserve Online/Offline truth" constraint. `.eh-badge-success { color: var(--primary) }` is 2.09:1 on light today. Give it its own PR and its own sign-off.

**PR-5 · `fix(web): unify overlays on Modal; repair the command palette`**
- Files: `Modal.tsx` (generalise: focus trap, `useId`, focus restore, one scrim token), `ConfirmDialog.tsx` (compose onto it), `CommandPalette.tsx` (call `onOpenChange`), `PreviewModal.tsx`, `DevicePreviewModal.tsx`. ~5 files.
- Reviewer verifies: **⌘K → Escape closes it** (it does not today); ⌘K → select a command → palette closes and navigation happens; Tab inside any dialog never escapes it; closing returns focus to the trigger; a destructive confirm still requires an explicit second action.
- **Risk: MEDIUM.** 42 consumer files. Mitigation: behaviour-only, no visual change; the CommandPalette fix is provably a bug fix (`onOpenChange` is declared at line 21 and never referenced again **[V]**).

**PR-6 · `fix(web): toasts stack, tokenise and meet AA`**
- Files: `Toast.tsx`, `lib/hooks/useToast.tsx`. 2 files.
- Offset stacking, `var(--…)` colours with AA-passing on-fill pairs, `aria-label` on close, one polite live region instead of N assertive ones, `icons.error` → an error glyph not `delete`, hoist `ToastContainer` out of `useCallback`.
- Reviewer verifies: fire three toasts in quick succession — **all three are legible and stacked** (today only the last is). Then fire an error toast and read the glyph.
- **Risk: MEDIUM-HIGH by blast radius — 58 files render `ToastContainer` [V].** Mitigation: no API change to `showToast/success/error/info/warning`; the 58 call sites are untouched.

**PR-7 · `fix(web): dashboard shell — rail, mobile logout, nav a11y`**
- Files: `app/dashboard/layout.tsx`, `app/layout.tsx`, `Breadcrumbs.tsx`, `NotificationBell.tsx`, `NotificationDropdown.tsx`, `LoadingSpinner.tsx`, extract `<Banner>` from `EntitlementBanner.tsx`, consume it in `TrialBanner.tsx`. ~8 files.
- Content column compensates for the rail (measure it, don't `pt-16` twice); logout reachable below 640px; `aria-label`/`aria-expanded`/`aria-controls` on hamburger and user menu; `aria-current="page"` on active nav; notification panel `max-w-[calc(100vw-2rem)]`; spinner reads `--primary`; `id="main-content"` restored on the template-editor branch; scope the ⌘K hint to dashboard routes only.
- Reviewer verifies: at **320 / 375 / 768 / 1440**, with a trial banner active — breadcrumbs are visible, the notification panel is fully on-screen, and logout is reachable. Assert `document.documentElement.scrollWidth === clientWidth` at each width.
- **Risk: MEDIUM.** Every authenticated page renders inside it.

---

**Wave 2 — prove the patterns on one page. THIS IS THE GATE.**

**PR-8 · `feat(web): dashboard overview on the Electric Horizon language`**
- Files: `app/dashboard/page-client.tsx`, `UpgradeBanner.tsx`, `EmptyState.tsx`. 3 files.
- Apply the extracted design language — **not** the homepage's sections: the elevation-not-hue active state (`ThemeToggle` is the reference), the fill-vs-ink discipline, `--mkt-ink-2` for body copy (auth pages currently use the *muted* token for paragraphs, one step too light throughout), the `.eh-dash-card` 16px radius consistently.
- Reviewer verifies: **side-by-side screenshot of `/` and `/dashboard` in one image.** They must read as one product. If they don't, stop — do not proceed to PR-9.
- **Risk: LOW.** One page.

> **GATE. Do not open PR-9 until PR-8's side-by-side is signed off.** Everything after this point is propagation of a proven pattern. If the pattern is wrong, it is wrong once, not eleven times.

---

**Wave 3 — propagation, in the operator's business-value order. One PR per route group.**

| PR | Title | Files | Reviewer verifies | Risk |
|---|---|---|---|---|
| **PR-9** | `feat(web): devices surface` | `devices/page-client.tsx`, `[id]/page.tsx`, `pair/page.tsx`, `DeviceHealthMonitor`, `DeviceGroupSelector` (~6) | Online/Offline unchanged after restyle; pairing code high-contrast and copyable; device table scrolls in its own container | **HIGH** — status truth + pairing |
| **PR-10** | `feat(web): playlists surface` | `playlists/page-client.tsx`, `[id]/page.tsx`, `PlaylistPreview`, `PlaylistQuickSelect` (~5) | **The playlist-assigned vs delivery-deferred distinction is still legible and still says the same thing.** Do not let a badge restyle collapse two states into one | **HIGH** — the distinction is the product |
| **PR-11a** | `refactor(web): split content/page-client.tsx` | `content/` (~6 new) | No behaviour change; tests green | MEDIUM |
| **PR-11b** | `feat(web): content surface` | `content/*` (~6) | Upload, expiry/replacement, folder tree, type badges | MEDIUM |
| **PR-12** | `feat(web): schedules surface` | `schedules/page-client.tsx`, `ScheduleCalendar`, `DaySelector`, `TimePicker` (~4) | Calendar occupancy readable on light; conflicts still visually distinct | MEDIUM |
| **PR-13a** | `feat(web): settings — billing, team, security` | 6 files | **Billing state (trial/past_due/publish_locked/suspended) still unambiguous; roles still correct; destructive confirms still confirm** | **HIGH** — money + RBAC |
| **PR-13b** | `feat(web): settings — alerts, api-keys, audit-log, customization, flags` | 7 files | `customization` must not be able to write a token that defeats the rebrand | MEDIUM |
| **PR-14** | `feat(web): templates, layouts, analytics, health, ops` | ~10 | Charts get a deliberate palette decision, not a literal sweep | LOW |
| **PR-15** | `feat(web): error and 404 surfaces` | 4 error files + `not-found.tsx` | `global-error.tsx` no longer inline-styles `#061A21`; all four error screens agree | LOW |
| **PR-16** | `feat(web): admin surfaces` | 13 routes + `PlanForm`/`PromotionForm` | Internal only | LOW |
| **PR-17** | *(optional)* `feat(web): widgets` | `widgets/page.tsx` | — | LOW — **operator has deprioritised widgets; drop if schedule slips** |

**Deferred deliberately, not forgotten:** `.mkt` scope retirement. Once `:root` is the Electric Horizon light palette, `.mkt` is redundant. Removing it is a *separate, final* PR after the app is proven, because a mistake there regresses the benchmark itself.

---

## 4. Cross-cutting hazards, ranked

**H1 — Theme default. `ThemeProvider` hardcodes `'dark'` as both initial and fallback (ThemeProvider.tsx:16,26); `'system'` is a declared `ThemeMode` unreachable from the UI.** Re-pointing `:root` changes nothing for any user who has never touched the toggle — which is nearly all of them. *Mitigation: PR-2 must ship the default decision with the token change. Whatever the decision, write it into `docs/plans/2026-08-03-full-app-rebrand.md` §"Open questions" in the same PR.*

**H2 — Pool C is invisible to every token change. 1,094 raw-Tailwind semantic occurrences across 89 files [V]**, entirely absent from the plan doc (which lists ~40 hex strays). These are why Toast/TrialBanner/EntitlementBanner/ConfirmDialog are D-rated. *Mitigation: add an ESLint rule banning `(text|bg|border)-(red|green|amber|yellow|orange|blue|emerald|rose)-\d{2,3}` in `web/src/**`, warn-only, with an allowlist that shrinks each PR. Without it the pool regrows faster than it drains.*

**H3 — `.eh-badge-success { color: var(--primary) }` carries device Online status [V].** The palette work and the operator's "preserve Online/Offline truth" constraint intersect at exactly one CSS declaration. *Mitigation: PR-4 isolates it; verify in greyscale.*

**H4 — Source order (trap #4), live today.** `.eh-btn-neon.eh-btn-sm` sets `border-radius:8px` (globals.css:741) and beats `rounded-xl` in `EmptyState.tsx:35` because it is defined after `@tailwind utilities`. *Mitigation: whenever a utility "does nothing", grep `globals.css` for the class before debugging React. Never add a Tailwind radius/padding utility to an element that already carries an `.eh-*` class.*

**H5 — `.mkt` must survive PR-2 and PR-3 unharmed.** It is the benchmark. Specificity protects it (`.mkt .eh-gradient` beats `.eh-gradient`), but PR-2 puts identical values in `:root` and `.mkt`, so a later "dedupe" looks safe and is not. *Mitigation: every CSS PR's checklist ends with "screenshot `/` + 5 legal pages, diff against `main`." Retire `.mkt` only in a dedicated final PR.*

**H6 — Dark mode doubles verification.** If dark stays supported (plan doc, unanswered), every PR needs both themes. *Mitigation: answer it in PR-2. If dark stays, add a Playwright fixture that renders each touched route in both themes and asserts computed `background-color` on `<body>` — cheaper than manual double-checking on 15 PRs.*

**H7 — `.mkt-dark-panel` (globals.css:289–308) is an inversion of an inversion.** It exists so the auth `ValuePanel` (13 neon literals **[V]** — the densest component in the app) can be dark inside a light scope. After PR-2 it becomes the only deliberately dark surface in the product. *Mitigation: decide in PR-2 whether ValuePanel stays dark. Do not carry the escape hatch forward by inertia; a single dark island next to a light form is either a deliberate design statement or a bug, and it must be named as one.*

**H8 — Tailwind scans raw file text including comments (trap #6).** Writing `#00E5A0` into a "don't use this" comment regenerates the rule. *Mitigation: in comments write the token name, never the hex.*

**H9 — `overflow-x: hidden` hides clipping (trap #7).** `main` is `overflow-x-hidden` (layout.tsx:313), so breadcrumbs and tables are silently sliced, not scrollable, and `scrollWidth - clientWidth === 0` cannot detect it. *Mitigation: assert on the **element's** bounding box vs its container, not on scrollWidth. Every wide surface gets its own `overflow-x: auto` container.*

**H10 — Colours baked into data URIs.** `.eh-select`'s chevron is `fill='%239A958E'` inside a `background-image` URL **[V]**. No token reaches it; it will stay a mid-grey taupe on the new cool-grey substrate. *Mitigation: grep for `%23` in `globals.css` during PR-3. There may be others.*

**H11 — Inline `style` beats class-based `hover:`/`focus:` (trap #5),** and there are **43 bare-hex `'#00E5A0'` occurrences in JS/TS [V]** that are exactly the inline-style/chart-config population. *Mitigation: hand-inspect all 43; they are the only part of Pool B a codemod must not touch.*

**H12 — Prod deploy OOM.** The `web` build OOMs the 3.7G VPS. *Mitigation: the proven sequence — stop ClickHouse → pull → detached build at `--max-old-space-size=2048` (**not** 4096) → restart CH → `npx tsx scripts/ops/pm2-guard.ts app-reload --env production`. Verify from the box's own self-curl, and check `curl https://vizora.cloud/api/v1/docs` returns 404.*

**H13 — Test breakage is small but real: 8 of 112 web test files assert on hex values or `.eh-*` classes [V]** (`billing/__tests__/components.test.tsx`, `customization/__tests__/page.test.tsx`, `marketing-sections.test.tsx`, `FolderTree.test.tsx`, +4). *Mitigation: fix them in the PR that breaks them. Do not batch test fixes.*

**H14 — `settings/customization` writes brand tokens at runtime [V]** (`brandLogo`/`brandName` are already consumed in `dashboard/layout.tsx`). If it can write colours, it can defeat the rebrand for a tenant. *Mitigation: audit its write path in PR-13b before restyling it.*

---

## 5. What the audits get wrong

**W1 — "728 neon usages must all be classified" is the single most expensive error in the plan.** It is now **778 [V]**, and the Tailwind namespace already performs the classification: 211 `text-`, 34 solid `border-`, 43 bare-hex-in-JS = **288 sites needing judgement**; the other 490 (`bg-`, gradient stops, `shadow-`/glow) are legal on light by the fill-vs-ink rule and need no review at all. The plan calls this "the bulk of the work." It is roughly a third of what it claims.

**W2 — Pool C is missing entirely.** The plan lists four off-palette hex strays at ~40 occurrences. The actual off-token population is **1,094 raw-Tailwind semantic occurrences across 89 files [V]** — 27× larger, and the direct cause of four of the six D ratings. Any schedule built on the plan's numbers under-estimates by more than the neon work costs.

**W3 — The audits over-credit the `.eh-*` layer.** The narrative that these are "shared utilities the dashboard consumes" is true for `eh-btn-neon` (28), `eh-heading` (28) and `eh-dash-card` (20) and **false** for `eh-badge` (5), `eh-th` (3), `eh-empty-state` (2), `eh-toolbar` (1), `eh-filter-pill` (1), `eh-progress` (1), `eh-skeleton` (1) **[V]**. Re-tuning `.eh-*` is a cheap high-leverage PR, not the rebrand.

**W4 — Skeleton's grade A is a quality grade masquerading as an adoption grade.** The audit calls it "the reference implementation the rest of the shell should be measured against." It has **one real consumer** (`templates/page.tsx`) **[V]**, while **15 files hand-roll `animate-pulse`** and 95 reference `LoadingSpinner`. Consequently, several route audits' "loading_state: skeletons" claims should be read as spinners until verified per route. Do not schedule Skeleton propagation in wave 0.

**W5 — The Toast remount claim is directionally right but mechanically overstated.** The audit says the `useCallback` `ToastContainer` remount "restarts the fade/dismiss timers of already-visible toasts." What actually happens **[V]**: remount resets `Toast`'s internal `isVisible` to `true` and restarts its internal `useEffect` timer — but `useToast.showToast` holds an independent `setTimeout(removeToast, 5000)` fixed at creation, so total lifetime is still bounded at 5s. The visible symptom is a **cancelled exit animation**, not an immortal toast. **The stacking defect is fully confirmed and is the serious one**: every toast renders at `fixed top-4 right-4` with no offset, so N simultaneous toasts occupy one box and only the last is legible.

**W6 — `--primary` as text is a smaller problem than the audits imply.** They read as though `--primary`-coloured text is everywhere. It is **41 occurrences across 15 files [V]** — a half-day sweep, not a theme. The 211 `text-[#00E5A0]` literals are the real population, and they are a different fix.

**W7 — `.eh-btn-neon` is not broken on light, only off-brand.** Several audits list "hand-rolled `bg-[#00E5A0] text-[#061A21]`" CTAs as contrast failures. They are fill + on-fill and pass on any substrate **[V]**; unscoped `.eh-btn-neon` is likewise `#00E5A0` on `#061A21`. The defect is that they will not adopt `.mkt`'s mint and will look like a different button from the homepage's. Real, but cosmetic — do not let it be triaged as a contrast bug and jump the queue ahead of H3.

**W8 — `.eh-dash-card` and `.eh-input` are already correct.** The audits treat the whole unscoped `.eh-*` block as dark-hardcoded. Verified **[V]**: `.eh-dash-card` is `var(--surface)`/`var(--border)` with the dark fill correctly scoped to `.dark .eh-dash-card`; `.eh-input`/`.eh-select` are fully token-driven. The genuinely dark-hardcoded unscoped rules are only **`.eh-btn-ghost`** (`#1B3D47` border, `#9A958E` text) and **`.eh-card`** (`rgba(12,34,41,.6)`) — 7 and 4 files respectively. PR-3 is smaller than the audits suggest.

**W9 — The three-palette problem is over-stated as a blocker.** The `.mkt` block at globals.css:230–241 is already a complete, tested, twelve-token light reset. Promoting it to `:root` is a copy-paste of eleven declarations. The plan treats "unify the palette" and "promote `.mkt` to root" as two steps (§Approach 1 and 2); they are **one 60-line PR**, and doing them separately means shipping an intermediate state where a fourth palette exists.

**W10 — Corrections that hold.** I checked the load-bearing claims and these are confirmed exactly as written: the CommandPalette controlled-state deadlock (`onOpenChange` declared line 21, never invoked **[V]**); `.mkt` omitting `--success/--error/--warning/--info` and `color-scheme` **[V]**; the fixed banner rail at `top-16` over content at `pt-16` **[V]**; no logout below 640px (`hidden sm:flex`, layout.tsx:174) **[V]**; `.eh-badge-success { color: var(--primary) }` **[V]**. Build the plan on these.