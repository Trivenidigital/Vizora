# Marketing product screenshots

`dashboard-fleet.png` is a **real capture of the running application**, not a CSS
reconstruction. It is rendered on the homepage by
`web/src/components/landing/FeatureShowcasesSection.tsx` (Showcase 1,
"Live fleet command center"), where it replaced a hand-built mock whose device
names, latencies and statuses were invented.

## What is in the shot

A synthetic demo tenant — "Northwind Coffee Roasters", nine displays across six
Seattle-area locations (only the first seven rows are visible in the crop). **No real customer, organisation or person appears in
it**, and the homepage caption says so ("Actual product UI — demo workspace,
synthetic data") so the shot can never be read as a production claim.

## Regenerating it

The seed deletes and recreates its own org (`slug = northwind-demo`) and touches
nothing else.

**Both scripts refuse to run unless `DEMO_TENANT_PASSWORD` is set, and the seed
additionally refuses any `DATABASE_URL` whose host is not local.** That is
deliberate: the seed creates a loginable `role: 'admin'` user and calls
`organization.delete`, which cascades across every org relation — pointed at a
real database (easy to do on a box where prod env is already exported) it would
be destructive. There is no default password to fall back to.

```bash
export DEMO_TENANT_PASSWORD='<choose a throwaway local value>'

# 1. infrastructure
docker compose --env-file .env -f docker/docker-compose.yml up -d postgres redis minio
pnpm --filter @vizora/database db:generate
(cd packages/database && npx prisma migrate deploy)

# 2. synthetic tenant
node scripts/marketing/seed-demo-tenant.mjs

# 3. services — order matters, see note below
npx nx serve @vizora/realtime      # must be first
npx nx dev   @vizora/web
(cd middleware && DOTENV_CONFIG_PATH=../.env node -r dotenv/config dist/main.js)

# 4. capture
node scripts/marketing/capture-product-shots.mjs
```

### Service start order is load-bearing

`@vizora/realtime` and `@vizora/middleware` both depend on `@vizora/database:build`,
which copies the generated Prisma client into `packages/database/dist/generated`.
On Windows the running process holds a lock on the Prisma engine there, so
whichever service starts **second** fails its dependency build with
`EPIPE … being used by another process`. Start realtime first, then run the
already-built middleware bundle directly (as above) so Nx does not try to
rebuild the package a second time.

### Why realtime must be running

The devices header renders a live-socket pill. Without the gateway on `:3002` it
reads a very unmarketable amber **"Offline"**; with it, **"Live"**. The capture
script asserts on this and logs `realtime pill live: YES/NO` — if it reports
`NO`, do not ship the resulting image.

## What the capture script strips, and why

Only non-product chrome, never data or status:

- `<nextjs-portal>` — the Next.js **dev-tools overlay**, i.e. the red
  "N · 1 Issue" pill. It exists solely in `next dev` and never renders in a
  production build. This is what made the previous repo captures unusable; it
  was never a real product issue.
- the floating support-chat launcher, which otherwise covers the device table.
  It is a genuine feature, hidden only so it does not occlude the subject.

## Asset notes

Captured at 1440×900 with `deviceScaleFactor: 2`, so the file is 2880×1800 and
stays sharp on retina displays. `next/image` is given those intrinsic dimensions
plus `sizes`, and serves downscaled AVIF/WebP variants — the 408 KB PNG is the
source, not what a visitor downloads.
