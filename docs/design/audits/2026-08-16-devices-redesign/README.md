# Devices visual redesign — surface-audit evidence

Raw output of `scripts/design/audit-surface.mjs` for the Devices redesign PR, committed so the
headline numbers are **derivable rather than author-reported**. `report.json` is the harness's own
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
DEMO_TENANT_PASSWORD=… node scripts/design/audit-surface.mjs --tag after-devices
```

**The seed's status spread is load-bearing.** It creates 5 online / 2 offline / 1 error / 1
pairing, two rows with no assigned playlist and one with no location. An all-online fleet exercises
one status presentation, renders 2 fleet-summary chips instead of 5, and never reaches the
"Never"-last-seen or empty-cell branches — so it produces different numbers. Re-running against a
differently-shaped tenant is not a comparison against these files.

Both runs here used identical seeded data. The `before` run was captured by checking out
`origin/main`'s versions of the six changed runtime files into the running dev server
(`page-client.tsx`, `loading.tsx`, `globals.css`, `DeviceStatusIndicator.tsx`,
`PlaylistQuickSelect.tsx`, `FleetCommandDropdown.tsx`) and restoring the branch versions for the
`after` run — so the only variable between the two files is the code.

## Results

| set | clipped | contrast < AA | touch < 44px | console |
|---|---|---|---|---|
| `/dashboard/devices` before | 8 | 19 | 60 | 8 |
| `/dashboard/devices` after | **2** | **1** | **10** | 8 |
| all 9 routes before | 64 | 96 | 300 | 72 |
| all 9 routes after | **58** | **78** | **234** | 68 |

A per-capture diff of all 36 pairs shows zero regressions on clipped / contrast / touch. The
distinct console-message set is identical between the two files (three local-dev messages the wave
doc classifies as local-env only); the raw count varies because the socket error fires once or
twice per capture non-deterministically, on untouched routes as well.

## What this oracle does NOT cover

- **Non-text contrast.** The harness computes WCAG contrast for text runs only, so a UI component
  *boundary* — an `appearance: none` checkbox border, a focus ring on a control that opts out of
  the global ring — can fall below SC 1.4.11's 3:1 and still report zero failures. That blind spot
  hid a real regression during this PR's review (`.eh-check` at ~1.8:1) and is worth re-checking by
  hand on any control that replaces a native one.
- **Keyboard and focus behaviour.** Nothing here observes `document.activeElement`, so a component
  identity bug that destroys focus on re-render is invisible to it. That belongs in Jest/RTL.
- **Caps.** `touch` is capped at 30 entries per capture and `contrast` at 40, so large "before"
  numbers are floors, not exact counts.
