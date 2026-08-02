# Vizora homepage — design handoff

**Deliverable:** `design-samples/05-homepage.html` — a complete, production-quality homepage in the
chosen direction. Open it directly in a browser; it is self-contained apart from Google Fonts.

**Direction:** Sample A (*Intelligent Operations*) for the hero and brand voice, Sample B's
conversion skeleton below the fold, Sample C/D's layered object demoted to the "How it resolves"
section where explaining is the job.

---

## 1. What changed vs. the current homepage

| | Current | Proposed |
|---|---|---|
| Substrate | Hard-coded dark gradient (`#061A21 → #0A222E`) inline in `page.tsx` | Light porcelain (`#E9EEEF`), same Electric Horizon accents |
| Hero | Two-line headline + CSS dashboard mockup | Three-beat headline + signal-fibre object, dashboard moved to its own section |
| Explanation | None — features are asserted, never shown | New "Four layers. One screen." section that shows the scheduling model |
| Product proof | Mockup inside the hero | Mockup as its own full-width section with feature captions |
| Trust | Stats band only | Stats band + security section + real compliance badges |

Everything else — AI systems, solutions, security, pricing, FAQ, final CTA — keeps the existing
section order and copy.

## 2. The light/dark decision

This is the one genuinely load-bearing choice and it is **page-level, not theme-level**:

- `ThemeProvider` (`web/src/components/providers/ThemeProvider.tsx`) defaults to `dark` and governs
  the **dashboard**. Nothing here changes that — the app stays dark.
- The marketing homepage does **not** use the theme. `web/src/app/page.tsx` sets an inline
  `background: linear-gradient(180deg, #061A21 …)` with `color: '#F0ECE8'`. Going light means
  changing that one wrapper plus the section components' colour usage.

So light marketing + dark product is a coherent, common pairing, and it is reversible by editing a
single wrapper.

## 3. Section → component map

`web/src/app/page.tsx` renders from `web/src/components/landing/`. Each section of the mockup maps
to an existing component:

| Mockup section | Component | Work |
|---|---|---|
| Nav | `NavigationSection.tsx` | Recolour; centre the links (3-col grid); keep the `Monitor`-tile + gradient wordmark as-is |
| Hero | `HeroSection.tsx` | **Largest change.** New headline, CTA row, left rail, right statement, fibre object, corner video chip |
| Stats | `StatsSection.tsx` | Recolour only. Numbers unchanged |
| How it resolves | `HowItWorksSection.tsx` | **Exists but is not mounted today.** Repurpose it — this is its natural home. Add to `page.tsx` |
| Platform + dashboard | `FeatureShowcasesSection.tsx` | Recolour; promote the dashboard mock out of the hero into here |
| AI engine | `AIFeaturesSection.tsx` | Recolour. All six names/headlines are already correct |
| Solutions | `SolutionsSection.tsx` | Recolour. Four verticals + footnote unchanged |
| Security | `SecuritySection.tsx` | Recolour; badges unchanged |
| Pricing | `PricingSection.tsx` | Recolour. It already has monthly/annual **and** USD/INR via `/api/geo-pricing` — the mockup's toggle is a simplification, keep the real one |
| FAQ | `FAQSection.tsx` | Recolour. **Verify the real questions** — the mockup's six are written from known facts, not copied from the live page |
| Final CTA | `FinalCTASection.tsx` | Recolour; copy unchanged |
| Footer | `FooterSection.tsx` | Recolour; tagline and `support@vizora.cloud` unchanged |
| — | `StickyBottomBar.tsx` | Not in the mockup. Keep or drop — it duplicates the final CTA |

## 4. Token mapping

The mockup's `:root` block is written to port directly. Light-mode values already exist in
`globals.css`; the mockup mostly **darkens text tokens for contrast** rather than inventing colours.

| Mockup token | Value | Existing app token |
|---|---|---|
| `--page` | `#E9EEEF` | near `--bg-light` `#F0ECE8` (mockup is cooler; either works) |
| `--ink` | `#0A222E` | brand deep teal, existing |
| `--ink-2` | `#3E5860` | body copy — 6.4:1 |
| `--muted` | `#4E656C` | micro labels — 5:1 |
| `--mint` | `#00B27C` | fills/buttons only |
| `--mint-ink` | `#00745B` | **new** — mint as small text. `#00E5A0` is 1.8:1 on light and must never be used for text |
| `--cyan` / `--violet` / `--amber` | `#00B4D8` / `#8B5CF6` / `#F59E0B` | unchanged for fills |
| `--cyan-ink` / `--violet-ink` / `--amber-ink` | `#00697F` / `#5B32C9` / `#8A5A00` | **new** — text-safe variants |

**The one rule to carry over:** the neon `#00E5A0` reads beautifully on dark and fails contrast on
light. Use it for glows, dots and gradient fills; use `--mint-ink` whenever it is text.

## 5. Two implementation gotchas found while building

1. **The 3D layer object overshoots its own box by ~130px upward.** `translateZ` + `rotateX` project
   well outside the element's layout box, so a normal grid gap is not enough clearance — the object
   collides with the copy above it when the layout stacks. The mockup reserves `padding-top:144px`
   on `.lyr-holder` below 980px. Sizing by the element box instead of the projection is the bug.
2. **The same projection causes horizontal overflow on phones.** At `width:380px` the object
   projects to ~496px, which overflowed a 375px viewport by 46px. Fixed by sizing with
   `min(58vw,380px)`. Re-check `scrollWidth - clientWidth === 0` after any change to that object.

## 6. What is deliberately NOT in the mockup

- **Real customer logos or testimonials.** `TestimonialsSection.tsx` exists with three named quotes;
  I did not surface them because I cannot verify they are real, attributable customers. Confirm
  before publishing — attributed quotes are the highest-risk copy on the page.
- **A real product screenshot.** `vizora-dashboard-overview.png` and friends at the repo root are a
  demo tenant showing `0 devices / 0 content / 0 playlists`, "No recent activity yet" and a red
  "1 Issue" badge. Unusable as proof. The CSS mock with realistic data is used instead — the same
  approach the live site already takes. **Capture a populated dashboard and swap it in**; for
  signage the product shot is the strongest proof you have.
- **The Bodoni Moda serif accent** from samples C/D. Direction A is all-sans and a single serif
  section would read as inconsistent across a full page. It remains available if you want more
  editorial warmth.
- **Working links.** Every `href` is `#`. Wire to `/register`, `/login`, `#anchors` and
  `mailto:sales@vizora.cloud` on integration.

## 7. Verified

Checked in Chrome via Playwright at 1440×900, 834×1100 and 390×844:

- 0 console errors, 0 warnings
- 0 horizontal overflow, 0 elements outside the viewport at 375px
- Pricing toggle: `$6→$5`, `$8→$7`, notes swap, `aria-pressed` flips, reverses cleanly
- Mobile menu: opens/closes, `aria-expanded` and `aria-label` track state, closes on link tap
- Layer object clearance: 33px (tablet), 52px (mobile)
- Reduced-motion: all animation disabled under `prefers-reduced-motion: reduce`
- Keyboard: skip link, visible focus rings, `<details>` FAQ is natively accessible

**Not verified:** real-browser screen-reader pass, Lighthouse, and cross-browser (Safari/Firefox).
The layer-isolate hover uses CSS `:has()` — supported in current Chrome/Safari/Firefox, but it is a
progressive enhancement and the section reads fine without it.
