# Hermes Agent — Skills Inventory

**Date:** 2026-04-23
**Purpose:** Verify whether the skill collections cited in planning (`vizora-skills-v3`, `agency-skills-v4`, ~56 skills total) exist as shippable artifacts that could be ported to Hermes Agent.
**Method:** `skills-inventory-search.sh` + targeted `gh api` peeks into candidate repos.

## Context for a cold reader

Before running this inventory, a Hermes Agent integration plan had been sketched. It assumed two skill bundles — `vizora-skills-v3` (Vizora-platform domain skills, ~28) and `agency-skills-v4` (ethnic-SMB agency work, ~28) — existed as artifacts that could be *ported* to Hermes' runtime shape. The plan's week-1 gate was "audit which of the 56 skills map cleanly; port the portable subset."

Four outcomes were possible going in, framed as branches of a decision tree:

1. **Bundles exist and port cleanly.** Proceed with the port-over-author plan.
2. **Bundles exist but need rework.** Classify effort (1h/4h/16h buckets), decide scope.
3. **Skills are notes/ideas, not artifacts.** Rescope to author-from-scratch.
4. **Skills exist but are Vizora-internal ops logic, not transferable domain knowledge.** Portable to Hermes-in-Vizora (Path B), not to the agency business.

This document records which branch won.

---

## Finding

**The named skill bundles do not exist.** "vizora-skills-v3" and "agency-skills-v4" returned zero hits on local filesystem, in plugin caches, on GitHub, and in any visible Claude config location. What exists instead is a small amount of adjacent material, none of which is domain-knowledge shaped for agency / ethnic-SMB work.

**Branch 3 wins, arguably stronger than Branch 3** — because the named bundles were not even notes-flattened-to-fake-names. They were memory compression of planning discussions. A Claude auto-memory record had summarized "we discussed building these" as "these exist."

## What actually exists

### In the Vizora repo — 4 developer-tooling skills
`.claude/skills/` contains:
- `content-validator/` — runs the 30-rule deployment readiness check
- `performance/` — performance optimization helper
- `support-agent/` — `/support` slash command orchestration
- `vizora-dev/` — Vizora-specific dev workflow

**Shape:** All four are developer-facing Claude Code skills for working *on* Vizora. None encode customer-facing domain knowledge. Not portable to Hermes — wrong audience and wrong runtime shape.

### In `Trivenidigital/claude-config` (private) — 2 generic dev skills
`skills/git-workflow/` and `skills/testing/`. Generic developer helpers, not domain skills. Not relevant to Hermes.

### In `Trivenidigital/Hisaku` — empty
Just a README. No content.

### In `Trivenidigital/hisaku-website` — Next.js website
`.claude/` contains `CLAUDE.md`, `launch.json`, `settings.local.json`. No `skills/` directory. It's a website project, not a skill bundle.

### Across other local projects — 19 skill-shaped `.md` files, wrong domain
- BTC15MinuteBot: 5 agent definitions + 5 skills (agent-design, deploy, dev-workflow, monitor, skill-creator)
- coinpump-scout: 3 agents (ingestion, mirofish, scorer)
- gecko-alpha: 6 agents (db, ingestion, mirofish, qa, safety, scorer)

**All crypto/trading domain.** None for Vizora, agency work, ethnic SMB, or signage.

## What this means for the Hermes plan

The revised plan's week-1 gate ("port portable subset of 56 skills") was resting on a number that doesn't correspond to shippable artifacts. The plan does not collapse, but its shape changes:

**Before:** "Port 12-ish of 56 existing skills to Hermes format — 2-3 weeks foundational work."

**After:** "Author the first 5-8 domain skills from scratch, shaped specifically for Hermes' event-response runtime — 2-3 weeks authoring work."

Net timeline roughly similar, but the work is **authoring, not translation**. That matters for three reasons:

1. **Design freedom is higher, anchor is lower.** No existing shape to preserve means every skill gets designed from scratch for its actual use case. Good. Also means no inherited consistency — first 5 skills will set the pattern for all future ones, so getting the first two right matters disproportionately.

2. **Hours-per-skill is higher.** Authoring a skill from a blank page is maybe 8-16h vs. 2-4h for translation. The 1h/4h/16h bucket column we discussed becomes mostly "16h" for the first few and "4h" once a template settles.

3. **Path B MVP shifts.** The original framing ("port skills, then ship conversational surface") had skills as pre-existing inventory. The real framing is "design the conversational surface first, let it tell you which 5 skills to author, then author those." Surface-driven skill selection beats skill-inventory-driven surface design, because 28 of 56 portable skills would have tempted us to ship every one of them on day 1.

## What does NOT change

- The Path B surface choice (read-mostly, failure-to-adopt is informative — "explain why this screen shows X" style).
- The write-capability constraint ("mutations route through OpsApiClient; Hermes memory is derivative cache, never authoritative").
- The multi-tenant isolation gap (D8 query guard does not cover Hermes memory + skills registry; still needs per-org namespacing).
- The recommendation to drop support-triage as the pilot surface.

## Recommended next step

**Status of Step 3 cloud check: not yet run.** The finding above stands either way — local filesystem and GitHub are the higher-confidence surfaces, and both are empty. Step 3 can only *reduce* authoring hours by turning up substantive material; it cannot re-validate the "56 skills" number.

Time-boxed 20-minute manual check across: claude.ai Projects, Cowork, Notion, Google Drive. If any surface turns up a prompt library or scratch file with substantive agency or signage domain content, append findings to this doc as an `## Update — 2026-04-XX` section and re-estimate authoring hours. If all four come back empty, no update needed.

Step 3 is not a blocker for starting Path B surface design (the 5 canonical questions). Those can proceed in parallel.

## Artifacts

- Search script: `skills-inventory-search.sh` at repo root
- Raw findings: `skills-inventory-findings.txt` at repo root (gitignored candidate — transient search output)
- This summary: `docs/hermes/skills-inventory-2026-04-23.md`

## Calibration note

The premise "56 skills exist across vizora-skills-v3 + agency-skills-v4" came from Claude's auto-memory, which compressed planning-discussion into artifact-describing language. This file is the ground-truth correction. Saved as a standing rule: `~/.claude/projects/C--projects-vizora/memory/feedback_memory_calibration.md` — verify named artifacts / numeric claims before building plans on top of them.

---

## Update — 2026-04-24 — script broadening + adjacent planning material

Rerunning the script with broadened scan (2000 files per root, excluded `node_modules`/`.git`/`.next`/`dist`) surfaced **688 skill-shaped `.md` files** vs 19 in the original run. Breakdown:

- **627 false-positive matches**: Claude auto-memory files under `~/.claude/projects/*/memory/*.md`. These use the same `name:` YAML frontmatter that skills do. Not skills. Script now excludes `.claude/projects/*/memory/*` to kill the noise.
- **43 agent-definition files** under various `.claude/agents/` dirs (other projects — crypto/trading).
- **19 actual skill-shaped files** — same set as the original run. Finding unchanged.

### Candidate source material flagged in the noise

The memory-file false-positives include a handful of files whose **names suggest substantive planning material** for this exact work. Not shippable skills, but potential reference material that could reduce authoring hours if they contain real content:

- `~/.claude/projects/C--projects/memory/project_hermes_agent.md` — prior Hermes planning notes
- `~/.claude/projects/C--projects/memory/feedback_hermes_local_first_dev.md`
- `~/.claude/projects/C--projects/memory/feedback_hermes_skill_triggers.md` — notes on Hermes skill trigger design
- `~/.claude/projects/C--projects/memory/project_smb_agents_phase0.md` — SMB agents planning
- `~/.claude/projects/C--projects/memory/project_apex_agent.md` — adjacent agent project

**Step 3 addendum:** Review the contents of those 5 files before authoring skills from scratch. They are exactly the "scattered prompt fragments across Claude projects" category flagged in the original pushback. If any contains substantive skill-shaped content, classification of that material reduces authoring time. If they contain only brief notes, the author-from-scratch plan stands.
