# REDESIGN-REVIEW — Vizora homepage, Little Worlds + Studio

Reviewer handoff for Astra. Implementation is complete, visually inspected,
tested, and evidenced below. Not merged, not deployed, no PR opened.

## Model and authorship

- **This pass ran on the exact requested model: `claude-fable-5` (high effort).**
- History, stated plainly:
  - Iteration 1 (the pre-correction residual-gaps pass, commits up to `a640b889`)
    ran on `claude-fable-5-1` — a substitution against the request.
  - A concurrent session running **Claude Haiku 4.5** committed `2d66f7ad`,
    `73362ad9`, `ff615c53` mid-stream (placeholder sections, a premature review
    doc, and an in-place recolour of the shared `.mkt` scope). Those commits are
    preserved in history; their `.mkt` recolour was reverted byte-identical in
    `57e15bbf`, their placeholder sections were superseded and removed in
    `15a58a94`, and their docs replaced by this file. Its commit message's test
    claim ("122 suites / 1307 tests passing") was a stale copied count, not a run.
  - Everything from `57e15bbf` through `5412cb0b` was authored on `claude-fable-5`.
  - **The diorama rebuild + evidence re-shoot (`29d59af5` → branch HEAD) ran on
    `claude-fable-5-1` as lead with a Claude Opus coder subagent** — again not
    the literal model id the brief names. Stated so the reviewer/owner can
    decide whether that matters; it was not silently substituted.
- All implementation was performed by Claude Code (this session plus its own
  coder/review subagents). No human wrote code; Astra is reviewer only.

## Branch, worktree, base

- Worktree: `C:\projects\vizora-homepage-redesign-20260915`
- Branch: `feat/homepage-light-redesign`, base `main` @ `a8df6c16`
- Redesign commits (on top of iteration 1's 8):
  - `2d66f7ad`, `73362ad9`, `ff615c53` — concurrent-session commits (see above)
  - `57e15bbf` — restore shared `.mkt`; add homepage-only `.lw` scope
  - `368c1bb0` — Places / Pipeline / Workspace / Final CTA / Footer sections
  - `15a58a94` — page assembly; pricing/FAQ/metadata truth pass; retire 14 components
  - `151c1f37` — hero + code-native CSS-3D diorama (`WorldsScene`)
  - `04b0648b` — both landing test suites rewritten (26 tests, mutation-verified)
  - `9fd09835` — QA evidence archive (`tasks/redesign-evidence/`)
  - `38ea8593` — both review passes landed (a11y, palette drift, scene polish)
  - `5412cb0b` — first handoff + refreshed post-fix evidence
  - `29d59af5`, `c4178f74`, `d232fe42` — diorama rebuild round 1: wall/plinth
    mass, one lighting model, large legible signage, props, scene-dominant hero
    grid, dedicated mobile arrangement; hover-state flattening bug fixed
  - `95f97c61` — round 2: `wallX` geometry fix, visible sync thread, retail
    alcove/shelves, foliage, stronger cast shadows, single column < 1200px
  - `8c994569` — all evidence re-shot on the production build, consent banner
    dismissed; interaction recording added
  - branch HEAD — this handoff
- Changed surface: `web/src/app/{page,layout,globals.css}` +
  `web/src/components/landing/**` + the two landing test suites +
  `tasks/redesign-*`. Nothing else. Deleted: Stats/AIFeatures/Solutions/
  Security/FeatureShowcases/HowItWorks/DemoVideo/Testimonials/MidPageCTA/
  StickyBottomBar + the four concurrent-session placeholders.

## Page narrative (all copy verified against the repository)

1. **Nav** — serif lowercase `vizora` wordmark, centred links (Places / How it
   works / Pricing / FAQ), Sign in, forest "Get started" pill. Accessible
   mobile menu (aria-expanded/controls, Escape, real anchors).
2. **Hero** — "Your world. / *Perfectly in sync.*" over a code-native 3D
   diorama: café, hotel, retail on limestone plinths, signage screens lit,
   joined by an animated forest sync thread. Place buttons preview a vignette
   and jump to the explorer. CTAs: Start free → `/register`; See how it works
   → `#how-it-works`. Trust line = the real trial terms.
3. **`#places`** — the board's proposed interaction as live HTML: 01 explore a
   location → 02 reveal its screens → 03 preview its content (real menu/
   welcome/promo boards + now-playing schedule). Captioned "Illustrative
   workspace — synthetic example data, not customer telemetry."
4. **`#how-it-works`** — Create → Organize → Schedule → Display, each sentence
   checkable: byte-level upload validation, playlists, per-display timezone
   schedules with next-ten-runs preview, code pairing, cached offline playback.
5. **`#product`** — the real dashboard capture (demo workspace, synthetic data;
   provenance `web/public/product/README.md`) framed in a forest bezel, four
   verified strengths, and the real 1:45 tour video in an accessible dialog.
6. **`#pricing`** — live `/api/geo-pricing` contract untouched; monthly/annual
   and USD/INR toggles with aria-pressed; bullets trimmed to what plans grant.
7. **`#faq`** — six answers rewritten from shipped behavior (the AI question is
   gone; the offline answer honestly says cached playback continues).
8. **`#start`** — deep-forest final CTA; `/register` + `mailto:sales@`.
9. **Footer** — limestone, anchors + account + legal links, support mailto.

Material design decisions: warm ivory/limestone substrate with deep forest,
ink, restrained brass/coral (text only via darker `-ink` variants); Fraunces
(next/font, SOFT/opsz axes) for display type over DM Sans body and JetBrains
mono kickers; one `.lw` scope layered over `.mkt` so legal/auth pages are
untouched (pinned by test); every fictional count/certification/AI claim from
the old page removed rather than restyled.

## Preview

```bash
cd C:\projects\vizora-homepage-redesign-20260915
NEXT_PUBLIC_API_URL=https://vizora.cloud NEXT_PUBLIC_SOCKET_URL=https://vizora.cloud \
BACKEND_URL=https://vizora.cloud npx nx build @vizora/web
cd web && NODE_ENV=production npx next start -p 3105   # → http://localhost:3105/
```

## Screenshots (committed in `tasks/redesign-evidence/`)

- `final-1440.png`, `final-768.png`, `final-390.png`, `final-320.png` — full
  pages, production build, **re-shot after the diorama rebuild with cookie
  consent pre-seeded** (the first set had the consent banner covering the
  Places heading / mobile scene — a defect in the evidence, now fixed).
  Horizontal overflow (`scrollWidth − clientWidth`) measured **0 at 1440,
  1366, 1280, 1024, 768, 390 and 320**.
- Hero close-ups: `lw-hero-1440.png`, `lw-hero-390.png`,
  `lw-scene-active-hotel.png` (active-place state).
- `lw-consent-banner-1440.png` — unseeded load, proving the consent banner
  still appears and "Accept All" persists `vizora_cookie_consent=all`.
- **Recording: `lw-interaction.webm`** (1280×800, ~28 s, 2.75 MB): load → hover
  each place → Hotel jumps to `#places` → switch screen → pricing annual + INR
  → FAQ → tour dialog, Escape.
- Interaction states: `lw-int-places-hotel.png` (explorer on Horizon Hotel →
  Events board), `lw-int-pricing-annual-inr.png`, `lw-int-faq-open.png`,
  `lw-int-tour.png` (dialog + video), `lw-int-menu-390.png`,
  `lw-int-reduced-1440.png` (reduced-motion full page).
- Cross-scope regression proof: `lw-check-privacy.png`, `lw-check-login.png`
  (legal + auth pages unchanged on the shipped cool palette).

## Verification (exact commands, actual results)

| Check | Command | Result |
|---|---|---|
| Focused suites | `cd web && npx jest landing marketing-sections --ci` | 2 suites / **27 tests pass** (re-run after the rebuild) |
| Full web suite | `cd web && npx jest --ci` | **123 suites / 1323 tests pass, exit 0** — re-run at `95f97c61` after the diorama rebuild (baseline before redesign: 122/1307 — no pre-existing failures) |
| Production build | `npx nx build @vizora/web` (prod env, twice: pre- and post-review-fixes) | **exit 0**, re-run after the rebuild; only pre-existing warnings (`middleware`→`proxy` convention, TS project references) |
| Types | web is type-checked by ts-jest (above) + the Next build's TS pass; repo-wide `tsc --noEmit` is a documented no-op and was not used as a gate | covered |
| Whitespace | `git diff --check` on every commit | clean |
| Interaction QA | `node lw-interact.mjs http://localhost:3105` (script in `C:\projects\vizora-homepage-qa-20260915\`) | places explorer aria-pressed + preview + story ✓ · hero→#places handoff ✓ · pricing annual ₹317/₹483 then USD ✓ · FAQ disclosure ✓ · tour dialog opens/Escape-closes, video only mounted while open ✓ · 390 menu open/navigate/Escape ✓ · reduced motion: screen glow, lamp glow, thread flow, vignette + ring transitions all `none`, reveals visible ✓ · **active place (hover AND keyboard focus): exactly one vignette lifted `translateZ(30px)` with its ring on, all three keep `transform-style: preserve-3d` and `opacity: 1`** ✓ |
| Keyboard | first tab stop = visible on-top "Skip to main content"; every probed stop shows a 2px forest focus ring | ✓ |
| Dev overlay "1 Issue" | React dev-mode `eval()` probe blocked by the app's own CSP (no `unsafe-eval`, correct for prod); 24/24 frames framework, zero app frames; absent on the production build | pre-existing, not landing code |
| Console | production pages log exactly one error: 401 from `GET /api/v1/organizations/current` — fired by the ROOT layout's CustomizationProvider on every public page against the prod API; pre-existing, unrelated to this branch | noted |
| Mutation controls | five pins proven red-without-fix: burger aria-expanded, tour `<source>`, hero claim string, places aria-pressed, hero-driven screen reset | ✓ |

Independent review passes (deep-reasoner subagents, read-only):
functional/accessibility/regression → **APPROVE-WITH-FIXES**, and visual/
responsive vs the brief → **APPROVE-WITH-FIXES**. Every SHOULD-FIX from both
was implemented and re-verified (see the review-fixes commit); NITs landed
too, except two explicitly declined: hero place buttons remain a
preview+jump affordance rather than carrying selected state (they navigate
away on click, so a persistent pressed state would be stale), and the
dark-theme product capture was framed rather than re-captured (below).

## Scene implementation

- **Code-native CSS 3D** — no Three.js, no canvas, no image: real DOM planes
  under `preserve-3d`. Zero new runtime dependencies; the only added asset
  weight is the Fraunces font via `next/font`.
- **Mass and light (rebuilt after an internal audit judged the first scene a
  "wireframe of the idea"):** walls are slabs with thickness, plinths are
  two-tier limestone drums built from stacked ellipse layers, every solid has
  a lit top / mid front / dark side under one upper-left key light, with
  directional cast shadows + contact shadows. Signage is large and CSS-drawn:
  café latte board + priced menu, hotel landscape "Welcome", retail
  "Style Moves People" totem. Props: counter, pastry case, machine, stools,
  table + chairs, awning; fluted brass desk, lamps, armchair, luggage, rug;
  metal frame, garment rail, tailor's bust in a lit alcove, stocked shelves.
- **Two real bugs found only by rendering:** (1) the old hover state put
  `opacity:.42` on `preserve-3d` groups, which forces `transform-style: flat`
  — the whole diorama collapsed onto the ground plane on hover. Replaced by
  lift + screen glow + a plinth ring (opacity only on a leaf). (2) `wallX`
  hinged on the wrong origin, so every box's side face hung *below* the deck
  (source of the spike artifacts and of the missing third lighting tone).
- Each vignette composites in its own perspective layer with an identical
  camera (asserted at every breakpoint) so planes from different places can
  no longer depth-sort through each other.
- **Sizing:** 762×522 at 1440 (bleeds right of the text wrap, overflow 0);
  single column below 1200px; a dedicated ≤640px arrangement on a taller
  canvas — 350×363 at 390, 280×290 at 320, nothing clipped, all three
  signage headlines legible. Container-query scaling
  (`scale(tan(atan2(100cqw, …)))`) with a stepped `@supports` fallback.
- Motion: screen-glow breathe, lamp-glow breathe, thread-flow dash — all
  stopped under `prefers-reduced-motion`, as are selection transitions.
- Performance: **318 scene nodes**, CSS-only animation, no JS per frame, no
  `filter: blur`, reserved aspect ratio (no layout shift); the 48 MB tour
  video mounts only while its dialog is open.

## Owner feedback round (after first review of the local build)

- **Spacing** (`ec5296a9`): one `--lw-sec-y` token; gap between sections at
  1440 went 202px → 132px (1920: 208 → 136; 390: 112 → 80); page 6015 → 5583px.
- **Board alignment** (`2cfea7e9`, `c88615a2`): hero is now the board's
  left-to-right panorama (904×407 at 1440, ~70% of the hero); place buttons
  became on-scene coral pin + leader + serif label at ≥1200px (pill row
  below); thin solid thread with a travelling highlight; both headline lines
  upright forest serif; two-line kicker; editorial margin note; warmer
  palette. The board's Product/Solutions/Resources/About + search were NOT
  copied — no real destinations exist for them.
- **Your locations panel** (`ad975149`): three cards under the hero, real
  "View screens" (selects the place, scrolls to `#places`), captioned as
  example content. Counts read 3 online / 0 offline (not the board's 5/1) so
  they cannot contradict the Places section beneath. "Add location" omitted.
- **Hybrid decision (owner + Astra): the photoreal look depends on three
  prerendered scene images that DO NOT EXIST YET.** Slots are built:
  `worldAssets.ts` (all `null` today → CSS vignettes render), 4:3
  aspect-reserved `next/image` slots, `object-fit: contain`, mixed mode,
  optional ivory matte, thread/labels in page space so they overlay either
  mode; pinned by jest and checked visually with a throwaway placeholder
  (not committed). Generation spec + acceptance checklist:
  `tasks/redesign-reference/WORLD-ASSETS-SPEC.md`; drop point + provenance
  table: `web/public/landing/worlds/README.md`. **Until those assets are
  delivered and integrated, the visual match to the board is incomplete.**
- Re-verified after this round: full web jest **124 suites / 1333 tests,
  exit 0**; prod build exit 0; overflow 0 at 1440/1280/768/390/320; scene
  nodes 308 + 60 (minis); evidence re-shot (`9d6517ba`).

## Asset provenance

No new binary asset was added. Reused, with existing provenance:
`web/public/product/dashboard-fleet.png` (real capture of the app against a
synthetic demo tenant; `web/public/product/README.md`) and
`web/public/videos/vizora-demo.mp4` + poster (existing 1:45 tour). The
concept board lives at `tasks/redesign-reference/06-little-worlds.png` as
reference only — it is not used on the page, whole or cropped.

## Unverified behavior / claims needing confirmation

1. **Android TV availability** (FAQ + workspace copy): the TV client exists
   (standalone `vizora-tv` repo, `deploy/tv/` install surface) but the public
   APK URLs 404 until an approved APK is published. The page does not link a
   download; still, confirm the wording is acceptable before ship.
2. **Out-of-scope surfaces still carry old claims**: the auth ValuePanel and
   register/help pages render "AI-powered", "256-bit", "99.9% uptime",
   "2,500+" style copy, and the root layout mounts the ⌘K command palette on
   marketing pages. Pre-existing; flagged, untouched per the dashboard-out-of-
   scope rule. The new repo-walk test will fail if those strings ever reach
   `web/src/components/landing/`.
3. The product capture is the app's **dark** theme (that is the real product
   today); a light-theme re-capture via `scripts/marketing/` would sit better
   on the ivory page — needs the local stack + demo seed, deferred.
4. Scene judgement calls left for the reviewer: on mobile the sync thread
   reads café → retail → hotel (the hotel sits directly behind the other two,
   so no open ground runs between them); at 1200–1300px the two-column scene
   (713×488 at 1280) is slightly smaller than the single-column one below
   1200px; the café A-board's chalk lines do not read at desktop size. It is a
   stylised diorama, not a photoreal render like the concept board — by
   design (no binary assets), but it is the reviewer's call whether it is
   rich enough.
5. Not verified in this environment: real screen-reader pass, Safari/Firefox,
   Lighthouse, and a cold-cache font-loading pass.
