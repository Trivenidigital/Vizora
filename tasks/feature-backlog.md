# Vizora Feature Backlog

Long-lived parking lot for ideas we've evaluated but consciously deferred. Each entry should explain **what**, **why deferred**, and **what triggers a revisit** so future-us doesn't have to redo the analysis.

Not a sprint tracker — see `todo.md` for in-flight work.

---

## Atelier Homepage Redesign

**Opened:** 2026-04-30
**Last touched:** 2026-05-01
**Status:** Active design exploration — **parked from production** until Sri explicitly approves
**Branch:** `feat/design-explorations` (HEAD `caa0e7a`, 10 commits ahead of `main`)
**Trigger to deploy:** Sri's explicit approval. Until then, **DO NOT MERGE** to `main` and **DO NOT** `git pull` this branch on the VPS.

### Why this exists

Customers told Sri during demos that the current frontend (Electric Horizon — dark teal + neon green + glassmorphism + animated neural-grid background) reads as *AI-generated*. That look is the v0 / Lovable / Cursor preset every AI startup ships in 2025. Vizora's customer base — retail, hospitality, F&B, corporate display ops — wants to see *signage software*, not *another AI dev-tool wrapper*.

### What's been built (on the branch only)

**1. Static design exploration set — 7 directions, deployed to VPS side ports** (`/var/www/vizora-designs/`, served by nginx on dedicated ports — entirely separate from the live app at `:3001`):

| URL | Direction | Mood |
|---|---|---|
| `vizora.cloud:8090` | Editorial Confidence | Cream paper, oxblood serif, broadsheet |
| `vizora.cloud:8091` | Industrial Operator | Charcoal + mono + amber, ops console |
| `vizora.cloud:8092` | Warm Hospitality | Cream + terracotta + sage, illustrated |
| `vizora.cloud:8093` | Signage Studio | White + Klein blue, Figma-like canvas |
| `vizora.cloud:8094` | Cinematic Premium | Almost-black + champagne, atmospheric |
| `vizora.cloud:8095` | Swiss Grid | White + utility yellow, brutalist |
| `vizora.cloud:8096` | **Atelier (Studio + Cinematic hybrid — current pick)** | Dark warm-black + champagne + Cormorant italic |

**2. Cycler review tools** (also on side ports — for design review only):
- `:8097` — palette cycler (5 backgrounds, 15 s each)
- `:8098` — accent cycler (champagne / copper / oxblood / sage / teal on bone)
- `:8099` — split-layout cycler (full dark / full light / half-half hard seam)

These side-port deploys are authorized to keep running. They serve from `/var/www/vizora-designs/` and do not touch the live Vizora app.

**3. Vizora homepage refactor — on the branch, NOT in production:**

- `web/src/app/globals.css` — new `.theme-atelier` scoped token block (champagne accent + warm paper text + Cormorant typography utilities). Does not affect any route outside the `.theme-atelier` wrapper.
- `web/src/app/layout.tsx` — Cormorant Garamond font added via `next/font`.
- `web/src/app/page.tsx` — rewritten to a lean 5-section home (nav · hero+canvas · "Selected for —" italic strip · invitation · footer). Background gradient kept (Electric Horizon dark teal — Sri's choice, not flipped to navy).
- `web/src/app/product/page.tsx` (new) — deep-dive page with AI Features, How It Works, Feature Showcases, Pricing, Security, FAQ, final invitation, footer.
- `web/src/components/landing/HeroSection.tsx` — atelier hero with workspace mockup (three-pane Figma-like editor) showing a *Saffron House — Lamb Biryani* canvas composition in champagne italic serif on a warm-vignette gradient.
- `web/src/components/landing/NavigationSection.tsx` — atelier app-chrome (italic Vizora wordmark, `// ATELIER` tag, refined menu, champagne "Begin a private trial" CTA).
- `web/src/components/landing/FooterSection.tsx` — italic *L'écran considéré*, journal link.
- `web/src/components/landing/SelectedForStrip.tsx` (new) — italic Cormorant customer band, replaces the heavy TestimonialsSection.
- `web/src/components/landing/FinalCTASection.tsx` — rewritten in atelier voice (single quiet CTA, no avatar pile).
- 11 mid-section files (AIFeatures / HowItWorks / FeatureShowcases / Pricing / Security / FAQ / etc.) — token-swapped (167 substitutions: `#00E5A0 → #c9a576`, `eh-btn-neon → at-btn-gold`, etc.) via `web/scripts/atelier-token-swap.mjs`.

**Sections cut from home** (removed from the lean home; files left in repo on the branch in case they're needed elsewhere): DemoVideoSection, StatsSection, MidPageCTASection, SolutionsSection, TestimonialsSection (replaced by SelectedForStrip), StickyBottomBar.

### Verification status

Verified locally with Playwright at 5 viewports (1920 / 1440 / 1280 / 1024 / 720) for both `/` and `/product` — zero horizontal overflow on either route. Test rig at `design-explorations/test-local-homepage.mjs` on the branch.

### Why deferred / parked

Sri wants to keep iterating on the design before committing. *"I want to continue this as separate work, until we finalize everything. NEVER EVER MERGE OR DEPLOY."* — 2026-05-01.

The static side-port previews stay running so customers and Sri can keep reviewing. The app-code refactor stays on the branch only.

### Companion safeguards

- `design-explorations/README.md` on the branch — top-level "NEVER MERGE OR DEPLOY" warning.
- Sri-side memory rule at `~/.claude/projects/C--projects-vizora/memory/design_explorations_no_merge.md` — prevents future Claude sessions from accidentally merging or deploying this branch.
- `MEMORY.md` index entry under "Hard Rules — Don't Merge / Don't Deploy".

### Next iterations (when Sri picks them up)

- Tighter mid-section voice on `/product` — currently token-swapped only, would land better with proper atelier-voice rewrites.
- Possible accent revisit (champagne is current; oxblood / deep teal were the runners-up at `:8098`).
- "Selected for —" customer roster currently lists generic luxury hospitality names (Norden Hotels, Maison Berthe, etc.) — may want Indian-restaurant brands now that the canvas content is Saffron House.
- Skip-to-content link in `web/src/app/layout.tsx` still uses `#00E5A0` (out of homepage-only scope; needs a layout-level fix when this lands).
- `viewport.themeColor` in layout.tsx is `#00E5A0` (mobile address bar color) — same scope concern.

---

## Synchronized Video Walls

**Opened:** 2026-04-30
**Status:** Deferred — may or may not build
**Trigger to revisit:** A pilot customer explicitly asks for a single canvas spanning multiple panels (one image/video tiled across N screens with frame-level sync). Menu-board-style use cases (independent adjacent playlists) do NOT count — see "cheaper adjacent path" below.

### What's missing today

Vizora supports portrait orientation per display (`Display.orientation`), orientation-aware templates (`Content.templateOrientation`), and DisplayGroups for fleet-level scheduling. What it does **not** support: treating N adjacent screens as one logical canvas with frame-synchronized playback. The realtime gateway's `playlist:update` event (`realtime/src/gateways/device.gateway.ts:583`) is fire-and-forget — fine for liveness, not for "all tiles show the same frame at the same wall-clock instant."

### Components required if we build it

1. **Schema** — `VideoWall` (grid rows × cols, total resolution, bezel mm) + `WallTile` (display → row/col). Sits on top of existing `DisplayGroup`.
2. **Time sync** — shared clock across tiles. NTP (~10ms drift) is enough for stills/slow video; PTP (<1ms) needed for true frame-accurate motion video and assumes LAN-level network support.
3. **Coordinated playback protocol** — replace fire-and-forget `playlist:update` with "play content X at wall-clock T+N seconds" + mandatory pre-buffer ack from every tile before T fires.
4. **Tile-aware renderer** — vizora-tv / Electron client knows its tile coords and crops/scales a logical canvas to its slice (CSS transform or canvas crop). Bezel compensation layered on top.
5. **Wall designer UI** — drag displays onto a grid in the dashboard, calibrate bezels, preview.
6. **Content pipeline** — either pre-slice video server-side (FFmpeg per-tile transcode; expensive server, cheap clients) or stream full-res to every tile and let it crop (simpler server, beefier client decode).

### Phasing if we ever build it

- **MVP (~3–4 weeks):** Schema + NTP sync + CSS-transform crop + basic 2×2 / 3×1 designer. Acceptable for stills and slow-motion content.
- **Production-grade (months):** PTP sync, server-side slicing, bezel calibration, tile-failover, "wall as one canvas" authoring.

### Cheaper adjacent path (build this first if pressure shows up)

A **menu-board composer** — UI that emits N coordinated *independent* portrait playlists for adjacent screens, no sync layer. The burger-menu reference image (3 portrait panels, each its own menu section) is solved by this, not by true sync. Estimated ~1 week on top of existing primitives. True video-wall sync is only justified when one logical image/video must span multiple panels.

### Alternative path: integrate, don't build

Hardware video-wall controllers (Userful, Datapath, Christie Pandoras Box) handle sync at the hardware layer. Vizora could feed them content via existing playlist APIs and skip building 2–6 entirely. Worth pricing if/when a customer brings one of these controllers to the table.

### Why deferred

No customer ask. The bulk of the "vertical screen" market (menu boards, wayfinding, lobby displays) is solved by today's portrait + DisplayGroups + per-screen playlists. Real video-wall sync serves a much smaller slice (stadium displays, broadcast studios, premium retail) and competes against entrenched hardware-layer players. Build only on a concrete pull.
