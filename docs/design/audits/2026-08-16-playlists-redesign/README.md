# Playlists visual redesign — surface-audit evidence

Raw output of `scripts/design/audit-surface.mjs` for the Playlists redesign PR, committed so the
headline numbers are **derivable rather than author-reported**, following the Devices precedent
(`docs/design/audits/2026-08-16-devices-redesign/`). `report.json` is the harness's own
machine-readable output (one object per route × theme × viewport, with every clipped element,
sub-AA text run, undersized target and console message); `SUMMARY.md` is its human-readable render.

## What was measured

9 routes × {1440, 390} × {light, dark} = 36 captures per run, against the synthetic demo tenant
seeded by `scripts/marketing/seed-demo-tenant.mjs`.

## How to reproduce

```bash
docker compose --env-file .env -f docker/docker-compose.yml up -d postgres redis minio
pnpm --filter @vizora/database exec prisma migrate deploy
DEMO_TENANT_PASSWORD=… node scripts/marketing/seed-demo-tenant.mjs
# start middleware (3000), realtime (3002), web (3001)
DEMO_TENANT_PASSWORD=… node scripts/design/audit-surface.mjs --tag after-playlists
DEMO_TENANT_PASSWORD=… node scripts/design/measure-nontext-contrast.mjs
```

**The seed changed in this PR and both runs here used the changed seed.** Two playlists were added
(`Holiday Takeover`, empty; `Order Ahead — Single Card`, one item and no description) and one
content row (`Wifi & Community Board`) became `archived`. Each exists to reach a presentation the
original four playlists cannot: the empty card, the single-thumbnail identity tile, the
missing-description branch, a non-zero Unassigned chip, and the "will be skipped" warning. Without
them those branches are unmeasured, exactly as an all-online fleet leaves the Devices status inks
unmeasured.

Device→playlist assignment was decoupled from `PLAYLISTS.length` in the same change. It used to be
`playlists[i % playlists.length]`, so adding a playlist silently re-dealt every device's assignment
and would have moved the **Devices** numbers as a side effect of a Playlists change. It is now
keyed by playlist NAME, and the mapping is byte-for-byte the one the modulo produced.

Because the seed differs from the Devices PR's, these numbers are internally comparable
(`before-playlists` vs `after-playlists`, identical data) but are **not** comparable to the numbers
in `2026-08-16-devices-redesign/README.md`.

The `before` run was captured by checking out `origin/main`'s version of
`web/src/app/dashboard/playlists/page-client.tsx` into the running dev server and restoring the
branch version for the `after` run — so the only variable between the two files is the code.

## Results

| set | clipped | contrast < AA | touch < 44px |
|---|---|---|---|
| `/dashboard/playlists` before | 20 | 13 | 60 |
| `/dashboard/playlists` after | **2** | **1** | **10** |
| all 9 routes before | 58 | 78 | 244 |
| all 9 routes after | **40** | **66** | **194** |

Per capture, after:

| capture | clipped | contrast | touch |
|---|---|---|---|
| light 1440 | 0 | 0 | 0 |
| light 390 | 1 | 0 | 5 |
| dark 1440 | 0 | 1 | 0 |
| dark 390 | 1 | 0 | 5 |

A per-capture diff of all 36 pairs shows **zero regressions** on clipped / contrast / touch. Console
count moved 71 → 70; the distinct message set is unchanged (the three local-dev messages the wave
doc classifies as local-env only), and the raw count varies because the socket error fires once or
twice per capture non-deterministically, on untouched routes as well.

**All 12 points of the all-route contrast improvement are on `/dashboard/playlists`** (13 → 1); every
other route is unchanged capture-for-capture. An earlier draft of this file claimed the gain
"also reaches `/dashboard/content`" because the `.eh-badge-warning` token fix has a consumer there.
Recomputed from the committed reports, Content is **3 → 3** — its own contrast findings are
elsewhere, and the seeded tenant does not render that badge on it. In a PR whose thesis is "say only
what the evidence proves", the plausible mechanism was not the measurement.

### Re-run after the review fixes — and why it did NOT replace the `after` run

The PR review produced seven code fixes (three-state connection signal, schedules qualifier,
unparseable-date guard, content-status label, unreachable branch removed). The harness was re-run to
check they moved nothing: `verify-after-review-fixes.report.json`.

**All four `/dashboard/playlists` captures are identical to `after-playlists.report.json`,
capture-for-capture.** Three captures on routes this PR never touches did move — analytics light
1440 `15→14` contrast, analytics light 390 `14→2`, settings light 390 `3→0` contrast and `22→4`
touch — because the re-run happened after the local stack was stopped and restarted, and those pages
rendered fewer elements against the restarted API.

That is exactly why the re-run is committed as a **verification artifact rather than as the `after`
run**. The `before`/`after` pair was captured in one session against one running stack, with the
only variable being the code; swapping in a file captured against a different environment state
would silently corrupt the comparison on three routes that had nothing to do with this change. The
headline table above is unchanged and still comes from that pair.

### What the residual findings are

All four are pre-existing and shared with the already-shipped Devices route, none are in the
Playlists card system:

- **1 clipped at 390 (both themes)** — `div.flex.items-center.gap-4`, 14px over, in the app shell.
  `/dashboard/devices` reports the same single element at the same width.
- **1 contrast at dark 1440** — `demo@vizora.local` in the sidebar account block at 3.91:1. Present
  on every route in both runs.
- **5 touch at 390 (both themes)** — the top-bar icon buttons, the theme switch and the footer
  version link, all in the shell.

## Non-text contrast — the blind spot this oracle cannot see

`audit-surface.mjs` computes WCAG contrast for TEXT runs only, so a control that draws its own
boundary under `appearance: none` is scored as zero failures no matter how invisible it is. That is
how `.eh-check` shipped at ~1.8:1 during the Devices redesign under a clean report.

`scripts/design/measure-nontext-contrast.mjs` (added in this PR) reads the live computed boundary
off the real node, resolves the first opaque colour behind it by compositing the ancestor chain, and
computes the ratio. It measures the boundary and the fill **against the backdrop outside the
control** and takes the better of the two, because either alone identifies the control.

Raw stdout of that run is committed as `nontext-contrast.after-playlists.txt`, so these six figures
are derivable like the rest rather than transcribed by the author.

Measured on `/dashboard/playlists`, 1440, both themes:

| probe | light | dark | verdict |
|---|---|---|---|
| `.eh-check` box border, unchecked | 5.06:1 | 5.76:1 | PASS |
| `.eh-check` box, checked (border = fill) | 4.56:1 | 7.87:1 | PASS |
| `.eh-fleet-chip` border, **pressed** | 4.35:1 | 10.8:1 | PASS |
| `.eh-select-inline` chevron glyph | 5.27:1 | 6:1 | PASS |
| `.eh-select-inline` resting border | 1.20:1 | 1.53:1 | see below |
| `.eh-fleet-chip` resting border | 1.20:1 | 1.53:1 | see below |

The two low numbers are the `--border` hairline, unchanged from the shipped Devices implementation
of both primitives. They are recorded rather than "fixed" here:

- SC 1.4.11 exempts text, and both controls carry a visible text label that meets 1.4.3, so the
  hairline is not the only thing identifying either control. The select additionally has a 5.27:1 /
  6:1 chevron glyph.
- The criterion's other half — **states** — is what the pressed chip carries, and that measures
  4.35:1 / 10.8:1.
- Repainting `--border` on these two primitives would restyle the Devices summary strip and its
  pagination footer, i.e. a just-merged surface, from inside a Playlists PR. That is a wave-level
  call for the operator, not a side effect of this one.

## What this oracle still does NOT cover

- **Keyboard and focus behaviour.** Nothing here observes `document.activeElement`, so a component
  identity bug that destroys focus on re-render is invisible to it. That belongs in Jest/RTL —
  `playlists-page.test.tsx` pins it, holding the ORIGINAL node reference rather than re-querying
  (a re-query finds the replacement and passes either way).
- **Caps.** `touch` is capped at 30 entries per capture and `contrast` at 40, so the "before"
  playlists figure of 60 touch targets is two capped captures — a floor, not a count. The real
  before-number is higher; the after-number of 10 is exact.
- **Thumbnail mosaic.** The seeded content carries no `thumbnail`, so every card renders the
  icon identity tile and the 1-up / 2×2 image branches are exercised only by unit tests, not by
  these captures. Seeding fake image URLs would exercise the `onError` placeholder path, not the
  real one, so it was not done.
