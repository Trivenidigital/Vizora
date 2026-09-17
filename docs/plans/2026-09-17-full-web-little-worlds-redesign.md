# Full-web redesign — every surface on the Little Worlds design system

**Status:** PLAN — awaiting owner decisions (§3). Nothing here is started.
**Date:** 2026-09-17 · **Owner:** Sri · **Design director:** Astra
**Depends on:** `feat/homepage-light-redesign` merging first (it carries the `.lw` tokens, Fraunces, and the asset slots).

**Drift-check tag:** extends-Hermes — closest permitted value; this is frontend design-system work entirely outside the Hermes substrate (no agent, trigger, cron, MCP tool or backend).

**New primitives introduced:** a root-scope Little Worlds token set (light + dark), a Tailwind colour map onto CSS variables, a source-scan "no raw colour" ratchet test, a Playwright visual-baseline harness.

## Hermes-first capability checklist

| Step | Tag | Effort |
|---|---|---|
| 1. Promote the homepage `.lw` palette to root-scope light + dark tokens | `[net-new]` — CSS design tokens; no Hermes capability covers UI theming | S |
| 2. Map Tailwind colours to CSS variables; collapse 4 token copies to 1 | `[net-new]` — build config | S |
| 3. Re-skin shared `.eh-*` utilities and UI primitives | `[net-new]` — React/CSS | M |
| 4. Codemod ~2.3k hard-coded colour sites to tokens | `[net-new]` — source transform + review | L |
| 5. Route-by-route polish in six waves | `[net-new]` — React/CSS | L |
| 6. Charts, calendar, command palette, toasts, consent | `[net-new]` — library theming | M |
| 7. Emails, TV installer page, display pairing screen | `[net-new]` — inline-HTML templates | S |
| 8. Visual-baseline harness + contrast computation + ratchet test | `[net-new]` — Playwright/jest tooling | M |

| Domain | Hermes skill found? | Decision |
|---|---|---|
| UI theming / design tokens | none found | build from scratch |
| Visual regression testing | none found | build on the existing Playwright config |

8/8 net-new triggered the red-flag re-check: no step ingests, extracts, routes, approves, audits, messages or persists per-VPS state, so the capability list does not intersect. awesome-hermes-agent ecosystem: not applicable to a web front end. Receipt: `tasks/.hermes-check-receipts/full-web-little-worlds-redesign.json`.

## Drift-rule self-checks

- ✅ Read `docs/plans/2026-08-03-full-app-rebrand.md` (whole file) — **an approved, never-started full-app rebrand already exists.** This plan supersedes its target palette and its "not a redesign" scope, and inherits its measurements and its eight traps.
- ✅ Read `web/src/app/globals.css` (`.lw` block, lines 545–594) — the homepage tokens this plan promotes, and the fact that `.lw` already re-points the base tokens (`--background`, `--surface`, `--primary`, …) — i.e. the promotion mechanism is proven on one page.
- ✅ Read `web/src/lib/customization.ts` (`applyCSSVariables`, lines 165–206; `readableInk`, 132–160) — white-label sets `--primary` and derives `--brand-ink-light` against a hard-coded `#FFFFFF`.
- ✅ Read `web/src/components/providers/ThemeProvider.tsx` (whole file) — default theme is `'dark'` when no preference is saved (line 26).

---

## 1. What "100% matching" means — and what changed since the August plan

The August plan aimed the app at the *old* marketing look (cool grey `#E9EEEF` + neon mint `#00E5A0`) and declared itself "not a redesign — palette and contrast only". Both are now out of date: the homepage moved to **Little Worlds** (ivory `#f5f1e8`, limestone, deep forest `#1f4230`, warm ink `#23261f`, restrained brass/coral, Fraunces display serif over DM Sans, mono kickers, soft raised cards, calm spacing), and the owner wants the whole site to match it.

One thing got *easier*. August's biggest cost was hand-classifying 728 neon usages as fill-vs-text, because neon is 1.65:1 on light. **Forest `#1f4230` on ivory is high-contrast as both text and fill**, so most of that classification disappears: neon → forest almost everywhere, with brass/coral reserved for fills and their `-ink` variants for small text.

"Matching" is defined as five layers, in this order of leverage:

1. **Tokens** — colour, radius, shadow, focus ring.
2. **Type** — Fraunces for page titles/section heads only; DM Sans for all UI; JetBrains Mono for kickers, codes and tabular figures. (A serif on table cells and form labels would hurt a working tool.)
3. **Primitives** — buttons, inputs, cards, tables, badges, modals, tabs, toasts, empty states, skeletons.
4. **Shell** — sidebar, header, breadcrumbs, banners, command palette.
5. **Per-route polish** — charts, calendar, editors, bespoke layouts.

**Not changing:** information architecture, routes, behaviour, API contracts, copy other than claims that are false (see W1).

## 2. Surface area (measured 2026-09-17 on `feat/homepage-light-redesign`)

| Item | Measured |
|---|---|
| Dashboard routes | 33 pages + 20 `loading` + 6 `error`; biggest: content 2771 LOC, devices 1234, playlists 1175, schedules 1172, widgets 1049, settings 1039 |
| Admin routes | 13 areas |
| Public non-homepage | 4 auth pages, 4 legal pages, backlog, error / not-found / global-error |
| Token-driven utilities already in place (`text-[var(--x)]` etc.) | **3365** — these re-theme for free |
| Hard-coded colour sites to convert | hex literals **1265**, Tailwind `[#…]` **973**, raw palette classes (`bg-gray-100`…) **1331** (hex and `[#` overlap) |
| `.eh-*` usages | 640 (dashboard+admin 378) |
| Raw `<button>` elements in `src/app` | 326 — `components/Button.tsx` is imported by exactly one page |
| Raw `<table>` elements | 16 — `ui/DataTable` is imported by zero pages |
| Badge implementations | 3 separate ones |
| Copies of the token set | **4** — `globals.css`, `tailwind.theme.cjs` (hard-coded hex), `theme/colors.ts`, `theme/tokens.ts` |
| Charts | recharts, 5 wrappers, colours in `theme/chartConfig.ts`; one consumer (analytics) |
| Tests pinning style | 15 `toHaveClass` in 5 files; colour asserts in ~6 files (13 of them pin the brand-ink algorithm — keep) |
| Visual regression | 5 Playwright baselines total — effectively none |

**Reading:** roughly 60% of colour usage is already variable-driven, so Phase 1 alone moves most of the app. The remaining ~2.3k hard-coded sites are the long pole, and the lack of visual baselines is the biggest *risk*, not the biggest cost.

## 3. Decisions needed before starting

| # | Decision | Recommendation | Why |
|---|---|---|---|
| D1 | Does dark mode stay? | **Keep it, redesigned as a "forest night" theme; light becomes the default.** | The default is dark today (`ThemeProvider.tsx:26`), so every existing user who never touched the toggle lives in dark; signage is often managed from dim back-of-house. Dropping dark cuts verification ~35% but removes something users have. |
| D2 | What do existing users with no saved preference see after launch? | **Light, with a one-time dismissible "New look — switch to dark" notice.** | "Match the homepage" means light. Silent flips are the thing to avoid; saved preferences are always respected. |
| D3 | White-label tenant colours | **Keep working exactly as today**: tenant `--primary` overrides forest for accents/fills; ink derived by `readableInk`. | It is a shipped feature. Fix one latent bug on the way: ink is derived against `#FFFFFF`, must become the new card surface. |
| D4 | Admin area in scope? | **Yes, last wave, tokens + primitives only** (no bespoke polish). | Internal surface; it re-themes mostly for free. |
| D5 | Emails + TV installer page + display pairing screen | **Yes, final wave, separate PRs** (email is a middleware deploy). | Customers see these; they still carry `#061A21` / neon. |
| D6 | Converge on shared primitives, or restyle 326 raw buttons in place? | **Re-skin `.eh-*` in place first (fast, global), then migrate raw markup to primitives opportunistically per wave** — no big-bang component migration. | Gets the look everywhere early; avoids a rewrite with no visual payoff. |
| D7 | Customer content surfaces (template library designs, `display/ContentRenderer`) | **Out of scope — must stay neutral.** | That is customers' content, not Vizora chrome. |

## 4. Phases

Each phase is independently shippable and leaves the app coherent. Sizes are relative (S/M/L), not calendar promises.

### Phase 0 — Safety net and single source of truth *(no visible change)* — M
- **Visual baseline harness**: Playwright script that logs into a seeded demo tenant (`scripts/marketing/` already seeds one, local-only) and captures ~30 representative routes × {light, dark} × {1440, 390}. This is the before/after evidence for every later PR; without it, review is guesswork.
- **Collapse 4 token copies to 1**: CSS variables are the source; `tailwind.theme.cjs` colours become `var(--…)` references; `theme/colors.ts` / `tokens.ts` / `chartConfig.ts` read the variables instead of restating hex.
- **Ratchet test**: a source-scan jest test that counts raw hex / `[#` / palette classes outside an allowlist and fails if the count goes *up*. The number only ratchets down.
- Move Fraunces loading from the homepage wrapper to the root layout.
- Delete dead `global.css` (501-line Nx leftover, imported nowhere) and empty `page.module.css`.

### Phase 1 — Tokens — S, biggest visual jump
- Promote the `.lw` palette to `:root` (light) and author the matching `.dark` forest-night set; status colours (success/warning/error/info) re-tuned for ivory with **computed** AA contrast.
- `.mkt` and `.lw` scopes become thin aliases, then go away — one palette, not three.
- Flip the default theme per D1/D2. Fix `readableInk` background per D3.
- Re-skin the unscoped `.eh-*` utilities (now *deliberately* — the August trap was doing it by accident).

### Phase 2 — Shell, type and primitives — M
Sidebar, header, breadcrumbs, trial/entitlement banners; type scale; Button, inputs/select/check, Card, Badge (3 → 1), Table styles, Modal/ConfirmDialog, Tabs, Toast, EmptyState, Skeleton, Tooltip, focus ring; command palette; consent bar; recharts palette; react-big-calendar skin.

### Phase 3 — Colour-debt codemod — L
Mapping table (old literal/class → token) applied by codemod **per directory**, each run reviewed against the Phase 0 screenshots. Off-palette strays (`#1a1a2e`, `#0f3460`, `#1F2937`…) are folded in here. Ratchet count drops toward zero.

### Phase 4 — Route waves — L
| Wave | Routes | Note |
|---|---|---|
| W1 | auth (login/register/forgot/reset + ValuePanel/MiniDashboard), legal ×4, error/not-found/global-error | Public and highest-visibility. **Also removes the false claims flagged in the homepage handoff** that still live here: "AI-powered", "256-bit", "99.9% uptime", "2,500+". |
| W2 | dashboard overview, devices (+detail, pair), content, playlists (+editor), schedules | Daily-driver screens; ~6.5k LOC. |
| W3 | analytics, health, ops, templates (+editor chrome only), layouts, widgets | Charts + editors. |
| W4 | settings/* and billing/* | Includes the customization page — verify white-label live. |
| W5 | admin/* | Tokens + primitives only (D4). |
| W6 | display pairing screen, `mail.service.ts` templates, `deploy/tv` installer page | Separate PRs; email needs a middleware deploy. |

After W2: **re-capture the homepage's product screenshot in the new light theme** — closes the open item in `REDESIGN-REVIEW.md` (the homepage currently frames a dark capture).

### Phase 5 — QA and rollout — M
- Contrast computed for every token pairing, both themes (never hand-asserted — August's doc records that 4 of 6 hand-written ratios were wrong).
- Responsive pass 320 / 390 / 768 / 1440 / 1920; keyboard + focus-visible; reduced motion.
- White-label matrix: three test tenants (dark brand colour, light brand colour, neon) × both themes.
- Full web jest, prod build, Playwright critical path; before/after screenshot set attached to each PR.
- Deploy via the **CI-artifact path** (proven 2026-08-18, avoids the on-box build OOM), guarded PM2 reload, `await-readiness` gate, then `deploy-verify`.

## 5. Delivery shape

- ~14–18 PRs, **each based on `main`, merged in sequence** — not a stacked chain (stacked PRs only trigger the Security Audit job in this repo's CI, so they'd merge unverified).
- Every PR ships with: before/after screenshots from the Phase 0 harness, ratchet delta, computed contrast for any new pairing, and both-theme verification.
- Implementation by the `coder` subagent per the model-tiered workflow; design review by Astra per wave; the lead reviews rendered output, not diffs alone.
- A long-lived redesign branch is deliberately avoided: token work touches files every other workstream edits, and a months-old branch would rot.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Silent regressions — a restyle passes CI while a screen breaks (the August doc's central warning) | Phase 0 baselines first; per-PR before/after; computed-style checks in a browser, not the CSS bundle |
| White-label tenants get unreadable accents on ivory | `readableInk` against the real surface; 3-tenant matrix; the 13 existing ink tests stay green |
| Default-theme flip surprises users | D2 notice; saved preferences untouched |
| Codemod maps a colour wrongly where it carried *meaning* (status red/green, chart series) | Status and chart colours are mapped by hand, never by the codemod |
| Known CSS traps recur | Inherit the August list verbatim: class after `@tailwind utilities` beats utilities; inline `style` kills `hover:`; `font-[var()]` is parsed as weight; Tailwind scans comments; `overflow-x:hidden` hides clipping |
| Prod build OOM | CI-artifact deploy path |
| Scope creep into IA / features | Non-goals in §1; anything structural becomes a backlog item, not a redesign PR |

## 7. Out of scope
`vizora-tv` and `vizora-mobile` repos · customer content (template designs, display renderer) · IA or feature changes · a component-library swap · `feat/design-explorations` (still never merge, never deploy).

## 8. First three concrete steps once D1–D7 are answered
1. Merge the homepage branch (after Astra's review of the slot tuning).
2. Phase 0 PR: baseline harness + token consolidation + ratchet test — zero visual change, fully reviewable.
3. Phase 1 PR: root tokens + default theme — the single biggest visible step; reviewed screen-by-screen against the baselines.
