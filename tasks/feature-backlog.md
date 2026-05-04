# Vizora Feature Backlog

Long-lived parking lot for ideas we've evaluated but consciously deferred. Each entry should explain **what**, **why deferred**, and **what triggers a revisit** so future-us doesn't have to redo the analysis.

Not a sprint tracker — see `todo.md` for in-flight work.

---

## Adopt shift-agent / Hermes patterns for Vizora business agents (evaluation)

**Opened:** 2026-05-03
**Status:** Open evaluation — does this fit Vizora?
**Trigger to revisit:** Whenever the next business-agent design lands, or when scaling pain on the existing ones forces the question.

### What this is

`shift-agent` (Sri's sister project, 15 agents in production on Hermes Agent + Kimi K2 via OpenRouter) demonstrates a mature, opinionated multi-agent architecture with strong maintainability properties:

- Per-agent directory shape (`skills/`, `scripts/`, `templates/`, `runbook.md`, `config.yaml.template`, `systemd/`)
- Shared platform layer (`safe_io.py`, `schemas.py`, audit helpers, sender-context resolution)
- Hard rules: dispatcher-first routing, identity-by-metadata, fail-closed, helper-scripts-own-IDs, templates-not-LLM-text, input sanitization, dual-source audit, hardened outbound
- Required out-of-band alerts (dead-man + watchdog + heartbeat)
- Disciplined build order (infra-and-safety first, agent logic last)
- Heavy doc discipline: PLAN.md → DESIGN.md → runbook.md → code

The framework is proven on the shift-agent side. **The open question is fit:** does Vizora's current agent landscape benefit enough from porting these patterns to justify the work?

### What Vizora has today

| Layer | Count | Pattern fit notes |
|---|---|---|
| `.claude/agents/*.md` (dev-time Claude Code subagents) | 8 | Already in SKILL.md shape. Match the pattern by accident. **No change needed.** |
| `scripts/ops/` (PM2 cron, deterministic) | 7 | Predictable cron jobs. Not LLM-shaped. Most discipline rules don't apply. Dead-man + watchdog parts of the triad now landed (PR #38: heartbeat in `health-guardian` + new `ops-watchdog`). External healthchecks.io leg pending env-var configuration on prod (see "Enable external healthchecks.io heartbeat" entry below). |
| `scripts/agents/` (business agents, mixed) | 6 (2 live, 4 scaffolds) | The 2 live ones (`customer-lifecycle`, `support-triage`) are doing LLM-shaped work. The 4 scaffolds are unwritten. Zod schema validation at the `AgentStateService` boundary now active (PR #38). |

### Companion docs (landed via PR #37)

- `docs/agents-architecture.md` — synthesis of shift-agent's `DESIGN.md` (979 lines, v2 post-review). Distills the 8 hard rules, the per-agent file shape, the `safe_io` pattern, required alerts, build order, testing stages, and security posture. Read when designing or maintaining a Vizora business agent.
- `docs/agents-mcp-server-design.md` — proposed Vizora MCP server module (`middleware/src/modules/mcp/`). Read-only v1 with 13 tools, token-based auth with per-token scope, rate limiting, audit, observability. Estimate: ~6.5 dev-days for the full server + first agent migration. **Design only — implementation gated on a real consumer.** Would unlock Hermes-side adoption with one stable tool surface.

### What's already landed from this evaluation

- **PR #37 (merged 2026-05-03):** Architecture and MCP design docs above; backlog evaluation entry.
- **PR #38 (merged 2026-05-04):** Two of three "immediate wins" from the architecture review:
  - Win 1 — Zod schema validation at `AgentStateService` boundaries (fail-soft on schema mismatch, sentinel passthrough preserved, 86/86 agents tests green).
  - Win 2 — Dead-man + watchdog + heartbeat triad: `pingHeartbeat()` in `alerting.ts`, integrated into `health-guardian`'s success path; new `ops-watchdog` (15-min cron, per-agent SLA, Slack alert on stale, self-records to `ops-state.json`).
  - Win 3 — Prompt sanitizer documented as N/A (D13 pattern eliminates the risk by construction; sanitizer becomes worth building when first agent path needs raw text in a prompt).
- **PR #39 + #40 (merged 2026-05-04):** CLAUDE.md hygiene sweep + ops-watchdog row.

### The decision question

Two parts, each independently answerable:

1. **Should the 4 business-agent scaffolds be designed (per the architecture doc) before any production logic lands?** Sri's instinct says yes — they're proven patterns. Confirm or adjust.
2. **Should Vizora build the MCP server?** It's the highest-leverage move regardless of whether Vizora itself adopts Hermes — it gives any future agent (Vizora-internal, Hermes-sidecar, customer-built) one stable read surface and removes per-agent integration code.

### Open considerations

- **Cross-language friction.** Hermes is Python; Vizora is TypeScript/NestJS. Full Hermes adoption means a sidecar repo (`vizora-business-agents/` per the architecture doc), with HTTPS as the boundary. shift-agent already proves this works (it talks to QuickBooks the same way). Cost is mostly the second runtime to operate.
- **Discipline cost vs payoff.** The shift-agent discipline is heavy — per-agent runbooks, PLAN.md / DESIGN.md before code, build order, staged testing. Worth it when you have 15 agents (shift-agent) or 6+ (Vizora business agents). Maybe overkill if Vizora ends up consolidating to 2–3.
- **Existing investments.** Vizora's `scripts/ops/lib/` already does some of what `safe_io.py` does. The shift-agent patterns are an extension, not a rewrite.

### What would unblock action

A decision on the MCP server v1 (yes / no / not yet). The agent-discipline patterns can be adopted incrementally per agent; the MCP server is a focused 6.5-day effort that needs an explicit go.

---

## Enable external healthchecks.io heartbeat on prod

**Opened:** 2026-05-04
**Status:** Operational follow-up — code shipped, env var not set
**Trigger to revisit:** Whenever the dead-man triad needs its third (external) leg active. Realistic deadline: before any whole-VPS-down outage where you'd have wanted external alerting.

### What this is

PR #38 added `pingHeartbeat()` to `health-guardian`'s success path. When `HEALTHCHECKS_HEALTH_GUARDIAN_URL` is set, every successful `health-guardian` cycle POSTs to that URL. If the pings stop arriving, healthchecks.io alerts independently — the external dead-man that survives the entire VPS being dead.

**Today the env var is unset on prod**, so this leg is no-op. The in-VPS `ops-watchdog` (the second leg) is active and verified. The first leg (`health-guardian` itself) has been running for months.

### To activate

1. Create a check at https://healthchecks.io with a 5-minute schedule and a 10-minute grace period (matches our 5-min cron + tolerance for one missed cycle)
2. Configure the alert channel on the healthchecks.io side (Slack / email / SMS — owner's choice)
3. Paste the ping URL into `/opt/vizora/app/.env` as `HEALTHCHECKS_HEALTH_GUARDIAN_URL=https://hc-ping.com/...`
4. `pm2 reload ops-health-guardian` to pick up the env var
5. Verify: a successful `health-guardian` run within 5 min should show as a successful ping in the healthchecks.io UI

### Why deferred

Operational, not technical. Required: a healthchecks.io account / project decision and an alert channel configuration on their side. ~10 minutes once you sit down to do it.

---

## PR #38 deferred review polish

**Opened:** 2026-05-04
**Status:** Low-priority cleanup
**Trigger to revisit:** Bundle with the next ops-related touch-up, OR when a reviewer flags the same items again.

### What this is

The PR #38 multi-agent review surfaced a few items that scored below the 80-confidence auto-post threshold. Real but not load-bearing:

| Score | Item | Disposition |
|---|---|---|
| 73 | `.env.example` and JSDoc for `pingHeartbeat` don't explicitly document the `/fail` URL variant | Worth a one-line clarification in the JSDoc + `.env.example` comment when convenient |
| 62 | `slaOverride` NaN diagnostic gap in `ops-watchdog.ts` — invalid values fall through to `slaDefault` silently | Today this is intended behavior (log + ignore). Revisit only if alert fatigue from misconfigured envs becomes a real problem |

### Why deferred

Sub-80 score by an automated review rig with the explicit framing "keep this commit scoped to bug-fixes." No production impact; both are clarity / DX nits.

---

## Add per-agent decision-quality metric (dispatcher accuracy)

**Opened:** 2026-05-04
**Status:** Gap noted in `docs/agents-architecture.md` — no metric exists today
**Trigger to revisit:** First time a business agent's classification quality is questioned in production (e.g. support-triage ticket-category drift, customer-lifecycle nudge mistargeting), OR when adding the second LLM-driven business agent (signal that quality variance across agents needs comparable measurement).

### What this is

shift-agent ships `dispatcher-accuracy-report` (10 KB script in `src/platform/scripts/`) that measures whether its dispatcher routes inbound messages to the correct handler. Vizora has no analogous metric for any of its business agents. Today, `support-triage` (the only live LLM-shaped one) classifies tickets into the v2 taxonomy with no ongoing measurement of whether the classifications are right — drift would be invisible until a customer escalation surfaced it.

### Why this matters

Agent quality silently degrades as the world drifts (new ticket categories appear, prompt template assumptions go stale, model-side behavior changes). Without a measurement, you find out about it from a customer complaint instead of a metric.

### Possible shapes

- **Daily sample audit** — randomly sample N classifications/day, write to a file, label by hand once a week. Cheap, manual.
- **Hold-out fixture** — maintain a fixed set of ~50-100 known-correct classifications (`packages/database/__tests__/fixtures/`); run them through the live agent every night; alert if accuracy drops below threshold.
- **Production echo** — for every classification, do a second classification via a different model (heuristic vs LLM, or two LLMs); flag disagreements for review.

### Why deferred

The taxonomy-v2 work has its own measurement gate at **2026-05-24** (`tasks/hermes-backlog.md`). That gate is the natural moment to decide whether ongoing-accuracy measurement is in scope.

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
