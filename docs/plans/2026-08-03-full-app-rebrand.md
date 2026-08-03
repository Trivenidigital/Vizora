# Full-app rebrand — align the authenticated app with the light homepage

**Status:** APPROVED, not started. Decision taken 2026-08-03. Scoped here so it can be picked up cold.

**Supersedes** the "dashboard and auth stay dark" clause of the marketing scoping contract. The *mechanic* warnings in that contract still hold — see "Traps" below — only the **goal** changed.

---

## The decision

The entire site should match the homepage. Today the marketing surface is light ("Electric Horizon on a light substrate") and the authenticated app is dark, so there is a visual discontinuity at login.

## Why the app wasn't included the first time

Not an oversight. `.eh-*` utilities are **shared** between marketing and the app, so recolouring them in place would have restyled the dashboard as a silent side effect of a marketing change — with no test failing. The rebrand therefore introduced a `.mkt` scope that re-tunes those utilities *only* under `.mkt`, and applied it to seven routes (`/`, five legal pages, the auth layout). That was the right call for shipping marketing safely. This document is the deliberate version of the change it avoided.

## Current state — there are three palettes, not two

| | Background | Character | Applies to |
|---|---|---|---|
| Dark (`.dark`) | `#061A21` | deep teal | the app today |
| Light (`:root`) | `#F0ECE8` | **warm cream** | the app's existing Light toggle |
| Marketing (`.mkt`) | `#E9EEEF` | cool grey | the 7 public routes |

The app **already has a working light theme** (the Light/Dark toggle in the dashboard header). It simply points at the older cream palette. So the gap is not "the app has no light mode" — it is "the app's light mode is off-brand."

That materially lowers the cost: this is largely a **token re-point plus a contrast audit**, not a ground-up restyle.

## Surface area (measured 2026-08-03)

| Item | Count |
|---|---|
| Dashboard route files | 42 |
| Admin route files | 24 |
| Component files/dirs | 52 |
| `eh-btn-neon` consumers | 28 files |
| `eh-heading` consumers | 28 files |
| `eh-dash-title` consumers | 13 files |
| `eh-gradient` consumers | 10 files |
| `eh-input` consumers | 10 files |
| `eh-card` consumers | 4 files |

### The real cost driver

Colour literals outside the marketing scope:

| Literal | Occurrences | Meaning |
|---|---|---|
| `#00E5A0` | **728** | neon — **the whole problem** |
| `#061A21` | 122 | deep ink (≈40 are on-fill button text, theme-agnostic) |
| `#00CC8E` | 84 | neon hover |
| `#00B4D8` | 44 | cyan |
| `#1F2937`, `#1a1a2e`, `#0f3460`, `#374151` | ~40 | **not in the Electric Horizon palette at all** — pre-existing drift, decide whether to fold in |

**Neon `#00E5A0` is 1.65:1 on the light substrate.** Every one of those 728 usages must be classified:

- **fill / glow / icon** → keep (correct on light)
- **text / border** → must become the ink variant (`--mkt-mint-ink` `#00745B`, 5.75:1)

That classification is the bulk of the work. It is the same trap the marketing rebrand already solved once, at roughly a tenth of the scale.

## Approach

Recommended shape, in order:

1. **Unify the light palette.** Re-point `:root` light tokens to the Electric Horizon light substrate so the app's existing Light mode *is* the brand. Largest visual win for the least code.
2. **Promote the `.mkt` token family to the root scope** (or alias it), so one palette serves both surfaces and `.mkt` stops being a special case. Removes the three-palette problem permanently.
3. **Audit the 728 neon usages** against the fill-vs-text rule. Mechanical but must be done by hand or with a very careful codemod plus visual diff.
4. **Fold in the off-palette strays** (`#1a1a2e`, `#0f3460`, …) or consciously leave them.
5. **Decide the default theme** — see open questions.

### Open questions to settle before starting

- **Does dark mode remain supported**, or does light become the only theme? If dark stays, every change needs checking in both, which roughly doubles verification.
- **What is the default for existing users?** Flipping the default changes the product's appearance for everyone who never touched the toggle.
- Do the off-palette colours get folded in, or left as known drift?

## Traps — all of these cost real rework already

1. **Never recolour unscoped `.eh-*` rules casually.** The reason inverts here (we now *want* the app to change), but the mechanic stands: those rules are shared, so every change must be verified on both surfaces, deliberately. Silent breakage passes CI.
2. **Neon is fills and glows only on light.** 1.65:1 as text. Use `--mkt-mint-ink` for small text.
3. **`font-[var(--x)]` types as font-WEIGHT and is silently dropped.** Use the named `font-sora` utility. Colour namespaces (`text-`, `bg-`, `border-`) are safe with bare `var()`; other namespaces are not.
4. **A class defined after `@tailwind utilities` beats the utility** at equal specificity — this is why `.eh-input` beat `pl-10`. Suspect it whenever a utility "does nothing".
5. **Inline `style` beats class-based `hover:`/`focus:`** variants, silently killing interactive states.
6. **Tailwind scans raw file text including comments** — writing an anti-pattern literal into a comment regenerates the rule in the bundle.
7. **`overflow-x: hidden` hides clipping**; `scrollWidth - clientWidth === 0` cannot detect an element sliced at the viewport edge.
8. **Verify computed styles in a browser, not the compiled CSS alone.** A rule existing in the bundle does not prove any element receives it.

## Verification plan

- Computed `font-family`/`color`/`background` on representative pages in **both** themes: marketing, auth, dashboard overview, a data-table route, a settings route, a modal, and a chart.
- Contrast check every changed pairing against WCAG AA 4.5:1. Compute it — four of six numbers in an earlier hand-written comment were wrong.
- Responsive pass at 320 / 375 / 768 / 1440 / 1920 with `scrollWidth === clientWidth` asserted.
- Full web suite, tsc, eslint, production build.
- Deploy with the OOM-safe sequence (stop ClickHouse → detached build at **2048MB** → restart CH → reload) and verify from the box's own self-curl.

## Non-goals

- Not a redesign. Same layout, same information architecture — palette and contrast only.
- Not a component-library migration.
- `feat/design-explorations` remains **never merge, never deploy**.

## Related

- `docs/plans/2026-08-02-persistent-offline-monitoring.md` — unrelated, but the same "record the boundary" convention.
- `tasks/lessons.md` (2026-08-03) — where traps 3–6 above were learned.
- `tasks/session-handoff-2026-08-02.md` §3 — the original `.mkt` scoping contract this supersedes in intent.
