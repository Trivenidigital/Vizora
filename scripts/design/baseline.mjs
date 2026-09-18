/**
 * LOCAL-ONLY visual baseline harness — the before/after evidence for the
 * full-web redesign (`docs/plans/2026-09-17-full-web-little-worlds-redesign.md`,
 * Phase 0).
 *
 * Captures full-page PNGs of the representative route set at two viewports into
 * `tasks/design-baselines/<label>/`, and diffs two labelled sets pixel-for-pixel.
 *
 * Why this exists rather than reviewing diffs:
 *   Phase 0 and Phase 1 both change files that every route consumes (the token
 *   set, the Tailwind colour map, the root layout). A diff cannot tell you which
 *   of 33 dashboard routes moved; `--compare` can. The August rebrand plan's
 *   central warning is that a restyle passes CI while a screen breaks, and this
 *   is the instrument that answers it.
 *
 * Relationship to the two sibling scripts — they do NOT overlap:
 *   `audit-surface.mjs`          measures contrast / clipping / touch targets.
 *   `measure-nontext-contrast.mjs` measures control boundaries (SC 1.4.11).
 *   this one                      measures "did any pixel change at all".
 * Phase 0 claims zero visual change, which only a pixel comparison can falsify.
 *
 * Usage:
 *   # capture a set (needs the local stack: middleware :3000, web :3001)
 *   DEMO_TENANT_PASSWORD=... node scripts/design/baseline.mjs --label before
 *   # public routes only (no login, no tenant data reachable)
 *   node scripts/design/baseline.mjs --label before --public
 *   # compare two captured sets
 *   node scripts/design/baseline.mjs --compare before after
 *
 * Flags: --label <name> | --compare <a> <b> | --routes a,b | --viewports 1440,390
 *        --public | --out DIR | --settle MS
 *
 * Git Bash on Windows rewrites any argument that looks like a POSIX path, so
 * `--routes /login` arrives as `C:/Program Files/Git/login` and the navigation
 * fails on an unusable URL. Export `MSYS_NO_PATHCONV=1` when passing --routes.
 * The default route set is built inside the script, so a plain run is unaffected.
 *
 * NO NEW DEPENDENCIES. `pixelmatch` is not in the lockfile and `pngjs` is only a
 * transitive dep (not resolvable from the workspace root), so the comparison
 * decodes both PNGs in the Chromium that Playwright already ships and diffs them
 * on a canvas. Same decoder that produced them, and nothing to install.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = nodePath.resolve(nodePath.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = process.env.CAPTURE_BASE_URL || 'http://localhost:3001';
const EMAIL = process.env.DEMO_TENANT_EMAIL || 'demo@vizora.local';
const PASSWORD = process.env.DEMO_TENANT_PASSWORD;

/** The synthetic org seeded by scripts/marketing/seed-demo-tenant.mjs. Nothing else may be photographed. */
const EXPECTED_TENANT = 'Northwind Coffee Roasters';

/** The platform super-admin from the same seed, for the /admin/* surface. */
const PLATFORM_EMAIL = process.env.DEMO_PLATFORM_EMAIL || 'platform@vizora.local';

/**
 * Proof that /admin actually RENDERED for the platform session.
 *
 * `admin/layout.tsx` redirects a non-super-admin to /dashboard, which produces
 * a perfectly clean screenshot of the wrong page — exactly how four admin
 * "baselines" were four copies of the dashboard. Asserting on admin's own
 * heading is what makes the session prove its reach instead of assuming it.
 */
const EXPECTED_ADMIN_HEADING = 'Admin Dashboard';

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')
    ? process.argv[idx + 1]
    : fallback;
}

/**
 * Routes that render no tenant data. Captured without logging in, so a run with
 * no seeded tenant still produces useful evidence for the public surface.
 * `/__not-found__` is a deliberately absent path — it exercises not-found.tsx.
 */
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/privacy',
  '/terms',
  '/sla',
  '/refund',
  '/__not-found__',
];

/**
 * The Vizora PLATFORM surface, captured as a super-admin.
 *
 * Separate from AUTHED_ROUTES because it needs a different session:
 * `admin/layout.tsx` redirects anyone without `isSuperAdmin` to /dashboard, so
 * captured as the tenant admin these four were simply four more copies of the
 * dashboard. The seed provides `platform@vizora.local` for this.
 */
const ADMIN_ROUTES = ['/admin', '/admin/organizations', '/admin/users', '/admin/health'];

/** Routes behind auth. Every one of these photographs the synthetic demo tenant. */
const AUTHED_ROUTES = [
  '/dashboard',
  '/dashboard/devices',
  '/dashboard/content',
  '/dashboard/playlists',
  '/dashboard/schedules',
  '/dashboard/analytics',
  '/dashboard/layouts',
  '/dashboard/widgets',
  '/dashboard/health',
  '/dashboard/settings',
  '/dashboard/settings/team',
  '/dashboard/settings/billing',
  '/dashboard/settings/api-keys',
  '/dashboard/settings/customization',
];

const VIEWPORT_HEIGHT = { 1920: 1080, 1440: 900, 1280: 800, 1024: 768, 768: 1024, 430: 932, 390: 844, 375: 812, 320: 640 };

/**
 * Per-route text substitutions applied just before the shot, for values this
 * harness cannot freeze because *it* is what changes them.
 *
 * `FREEZE` below pins the clock inside the page, which covers everything
 * derived from `Date.now()`. It cannot cover a value the SERVER wrote: logging
 * in updates `users.lastLoginAt`, and `/dashboard/settings/team` renders that
 * column — so two runs of identical code differed by the minutes between them
 * ("Sep 18, 2026, 01:03 AM" vs "01:07 AM", 3550 px). Left alone this is a false
 * positive on EVERY comparison, which is the failure mode that makes a baseline
 * harness worse than none: reviewers learn to ignore it.
 *
 * Substitution rather than Playwright's `mask`, which was tried first and is
 * not sufficient here: a mask paints a box over the element but the element is
 * still laid out from its real text, and that cell is `whitespace-nowrap` in an
 * auto-layout table — so a different timestamp still reflowed the neighbouring
 * columns and 2755 px still moved OUTSIDE the mask. Replacing the text fixes
 * the geometry as well as the pixels.
 *
 * Positional selector because the cell carries no test id or distinguishing
 * class (`page-client.tsx:288`). If that table gains a column, this moves.
 */
const TEXT_SUBSTITUTIONS = {
  '/dashboard/settings/team': [
    { selector: 'table tbody td:nth-child(5)', text: 'Jan 15, 2026, 12:00 PM' },
  ],
};

/**
 * Painted over on EVERY route, because the instability follows the element.
 *
 * The 32x32 gradient brand swatch in both shells (`dashboard/layout.tsx:158`,
 * `admin/components/AdminSidebar.tsx:70`) rasterises its antialiased corners
 * differently between runs — 6 px at a max channel delta of 15, invisible to a
 * human and fatal to an exact-equality comparison. It surfaced on a different
 * route each run (billing, then api-keys), so masking per-route would just move
 * the flake around.
 *
 * COST, stated plainly: the swatch's own fill and radius are no longer covered
 * by the baseline. It is one small element and everything around it — the
 * wordmark beside it, the whole shell — still is. Excluding the routes instead
 * would have cost four entire screens.
 */
const GLOBAL_MASKS = ['a[href="/dashboard"] .bg-gradient-to-br', 'aside .bg-gradient-to-br:has(> span)'];

/**
 * Pin the readiness verdict the dashboard's "System Status" card renders.
 *
 * `/health/ready` reports the LIVE state of the local stack, and it genuinely
 * flaps — CLAUDE.md records that it answers 200 while reporting `degraded`, and
 * a local box with a container still warming does exactly that. Measured across
 * two runs of unmodified code: the card flipped Healthy -> Degraded, repainting
 * a whole gradient tile (56689 px on `/dashboard` at 390, and again on the
 * `/admin/*` routes, which render the same overview).
 *
 * Rewriting the verdict in flight is deliberately preferred over masking the
 * card: a mask would paint over the one tile whose gradient, badge and icon are
 * exactly what a redesign changes. Only the two fields that drive the branch are
 * touched, so the rest of the payload — and the card's real styling — is intact.
 */
async function pinReadiness(ctx) {
  await ctx.route('**/api/v1/health/ready*', async (route) => {
    try {
      const res = await route.fetch();
      const body = await res.json();
      const target = body && typeof body === 'object' && 'data' in body ? body.data : body;
      if (target && typeof target === 'object') {
        target.status = 'ok';
        delete target.message;
      }
      await route.fulfill({ response: res, json: body });
    } catch {
      // Middleware unreachable: let the app see that rather than inventing health.
      await route.fallback();
    }
  });

  /*
   * Pin the notification bell's unread count, for the same reason.
   *
   * The badge is part of the shell, so it sits on every dashboard and admin
   * route. Its value is live state that the seed and the login itself produce,
   * and it flipped between "no badge" and a red "2" across two runs — 276 px on
   * seven shots, at a channel delta of 700, which is as loud as a real
   * regression looks. Zero is the state that renders no badge at all; the count
   * is not what a redesign is being reviewed for.
   */
  /*
   * Pin the live telemetry on /admin/health.
   *
   * That page renders real uptime, Redis memory and per-service latency and
   * refreshes every 30s, so two captures of identical code disagreed by 707 px
   * — and the numbers change width, which reflowed the layout and changed the
   * full-page width from 517 to 512. Pinned rather than masked because these
   * values are scattered across the page: masking each would blank most of it,
   * while fixing the payload leaves every card, badge and label fully covered.
   * Only the volatile numerics are touched; statuses are left alone.
   */
  const VOLATILE = new Set(['uptime', 'latency', 'memory', 'maxMemory', 'responseTime', 'timestamp']);
  await ctx.route('**/api/v1/admin/health*', async (route) => {
    try {
      const res = await route.fetch();
      const body = await res.json();
      const pin = (node) => {
        if (!node || typeof node !== 'object') return;
        for (const [k, v] of Object.entries(node)) {
          if (VOLATILE.has(k) && typeof v === 'number') node[k] = k === 'uptime' ? 86_400 : 1;
          else if (VOLATILE.has(k) && typeof v === 'string') node[k] = '2026-01-15T12:00:00.000Z';
          else pin(v);
        }
      };
      pin(body);
      await route.fulfill({ response: res, json: body });
    } catch {
      await route.fallback();
    }
  });

  await ctx.route('**/api/v1/notifications/unread-count*', async (route) => {
    try {
      const res = await route.fetch();
      const body = await res.json();
      const target = body && typeof body === 'object' && 'data' in body ? body.data : body;
      if (target && typeof target === 'object') target.count = 0;
      await route.fulfill({ response: res, json: body });
    } catch {
      await route.fallback();
    }
  });
}

const slug = (route) => (route === '/' ? 'root' : route.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-'));
const setDir = (label, out) => nodePath.join(out, label);

/* ══════════════════════════════════════════════════════════════════════════
   COMPARE MODE
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Decode two PNGs and count differing pixels, in-browser.
 *
 * Exact equality, not a perceptual threshold: Phase 0's acceptance bar is "zero
 * changed pixels", and a tolerance would quietly absorb a one-shade token slip —
 * the exact class of regression this harness exists to catch. Later phases DO
 * expect change, so the output is a count per route rather than a pass/fail.
 */
const DIFF_IN_PAGE = async ([aDataUrl, bDataUrl]) => {
  const load = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('decode failed'));
      img.src = src;
    });
  const [a, b] = await Promise.all([load(aDataUrl), load(bDataUrl)]);
  if (a.width !== b.width || a.height !== b.height) {
    return { sizeMismatch: true, a: `${a.width}x${a.height}`, b: `${b.width}x${b.height}` };
  }
  const draw = (img) => {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, img.width, img.height).data;
  };
  const da = draw(a);
  const db = draw(b);
  let changed = 0;
  let maxDelta = 0;
  for (let i = 0; i < da.length; i += 4) {
    const d =
      Math.abs(da[i] - db[i]) +
      Math.abs(da[i + 1] - db[i + 1]) +
      Math.abs(da[i + 2] - db[i + 2]) +
      Math.abs(da[i + 3] - db[i + 3]);
    if (d !== 0) {
      changed++;
      if (d > maxDelta) maxDelta = d;
    }
  }
  return { sizeMismatch: false, changed, total: da.length / 4, maxDelta, width: a.width, height: a.height };
};

async function compare(labelA, labelB, out) {
  const dirA = setDir(labelA, out);
  const dirB = setDir(labelB, out);
  for (const [label, dir] of [[labelA, dirA], [labelB, dirB]]) {
    if (!fs.existsSync(dir)) throw new Error(`No such baseline set: "${label}" (expected ${dir})`);
  }

  const pngs = (dir) => fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
  const filesA = pngs(dirA);
  const filesB = pngs(dirB);
  const onlyA = filesA.filter((f) => !filesB.includes(f));
  const onlyB = filesB.filter((f) => !filesA.includes(f));
  const both = filesA.filter((f) => filesB.includes(f));

  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  const rows = [];
  try {
    for (const file of both) {
      const toDataUrl = (dir) =>
        `data:image/png;base64,${fs.readFileSync(nodePath.join(dir, file)).toString('base64')}`;
      const r = await page.evaluate(DIFF_IN_PAGE, [toDataUrl(dirA), toDataUrl(dirB)]);
      rows.push({ file, ...r });
    }
  } finally {
    await browser.close();
  }

  console.log(`\n${labelA} -> ${labelB}   (${both.length} shots compared)\n`);
  const width = Math.max(...both.map((f) => f.length), 10);
  let identical = 0;
  for (const r of rows) {
    if (r.sizeMismatch) {
      console.log(`  ${r.file.padEnd(width)}  SIZE CHANGED  ${r.a} -> ${r.b}`);
    } else if (r.changed === 0) {
      identical++;
      console.log(`  ${r.file.padEnd(width)}  identical`);
    } else {
      const pct = ((r.changed / r.total) * 100).toFixed(4);
      console.log(`  ${r.file.padEnd(width)}  ${r.changed} px changed (${pct}% of ${r.total}, max channel delta ${r.maxDelta})`);
    }
  }
  for (const f of onlyA) console.log(`  ${f.padEnd(width)}  ONLY IN ${labelA}`);
  for (const f of onlyB) console.log(`  ${f.padEnd(width)}  ONLY IN ${labelB}`);

  const changedShots = rows.filter((r) => r.sizeMismatch || r.changed > 0);
  console.log(
    `\n  ${identical}/${both.length} identical · ${changedShots.length} changed` +
      (onlyA.length || onlyB.length ? ` · ${onlyA.length + onlyB.length} unpaired` : ''),
  );
  // Exit 1 on any difference so a caller can gate on it; the per-route numbers
  // above are the actual deliverable.
  process.exitCode = changedShots.length || onlyA.length || onlyB.length ? 1 : 0;
}

/* ══════════════════════════════════════════════════════════════════════════
   CAPTURE MODE
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Freeze everything that changes between two runs of the same code.
 *
 * Injected before any app code runs. Without this, a rerun differs from itself
 * and every route reports thousands of changed pixels — which makes the harness
 * worse than useless, because the noise hides the real regression.
 *
 * Covers: wall-clock (relative "last seen"/"2 minutes ago" labels, the clock
 * widget), `Math.random` (chart demo series, skeleton shimmer offsets) and
 * `crypto.randomUUID` (React keys that leak into rendered ids).
 */
const FREEZE = () => {
  const FIXED_MS = Date.UTC(2026, 0, 15, 12, 0, 0); // 2026-01-15T12:00:00Z
  const RealDate = Date;
  // eslint-disable-next-line no-global-assign
  Date = class extends RealDate {
    constructor(...args) {
      // `new Date()` with no args is the only non-deterministic form.
      if (args.length === 0) super(FIXED_MS);
      else super(...args);
    }
    static now() {
      return FIXED_MS;
    }
  };
  Date.UTC = RealDate.UTC;
  Date.parse = RealDate.parse;
  Object.defineProperty(Date, 'name', { value: 'Date' });

  // Deterministic PRNG (mulberry32) — a constant 0.5 would collapse every
  // generated series to a flat line, which hides layout differences instead of
  // stabilising them.
  let seed = 0x9e3779b9;
  Math.random = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  if (globalThis.crypto) {
    let n = 0;
    try {
      globalThis.crypto.randomUUID = () =>
        `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    } catch {
      /* read-only in some contexts; the ids it feeds are not rendered text */
    }
  }

  try {
    localStorage.setItem('vizora_cookie_consent', 'all');
    // Same reason as the consent bar: a one-time overlay would otherwise sit on
    // top of all 26 authenticated routes and make every diff about the overlay.
    localStorage.setItem('vizora_new_look_seen', '1');
  } catch {
    /* private mode */
  }
};

/**
 * Suppress the remaining non-determinism that must be handled in CSS, and strip
 * dev-server chrome that is not part of the product surface.
 *
 * `animations: 'disabled'` on the screenshot call finalises CSS animations, but
 * it does not stop a caret blinking or a `<video>` decoding a different frame.
 */
/**
 * Jump to the bottom and back. DELIBERATE — do not "fix" this to a stepped scroll.
 *
 * A single jump does not bring below-fold elements *through* the viewport, so on
 * its own it would never trigger a `loading="lazy"` image. That hazard is real,
 * and it is why a naive probe against these pages must scroll in steps or it
 * will conclude an image never loads. It does NOT apply here, because the
 * warm-up has already fetched every `/_next/image` variant to completion: the
 * images are in cache and paint on capture regardless of how we scrolled. The
 * warm-up substitutes for the scrolling.
 *
 * Stepped scrolling was tried and MEASURED WORSE: 47/52 determinism, and on the
 * homepage specifically the scene tiles were missing from two of three
 * consecutive captures — i.e. usually wrong, not merely unstable. The loss
 * happens between the readiness check and the shot (all 7 images and all 3
 * tiles reported loaded at check time), and neither `loading='eager'` nor
 * `decode()` closed it. Jump-scroll plus warming reaches 52/52 with the tiles
 * present, so that is the configuration that ships.
 */
async function sweepScroll(page) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await page.evaluate(() => window.scrollTo(0, 0));
}

const STABILISE_CSS = `
  *, *::before, *::after {
    animation-play-state: paused !important;
    transition: none !important;
    caret-color: transparent !important;
  }
  video { visibility: hidden !important; }
  nextjs-portal { display: none !important; }
`;

async function capture(label, routes, viewports, out, settleMs, publicOnly) {
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE)) {
    throw new Error(`Refusing to capture against non-local target: ${BASE}`);
  }

  const dir = setDir(label, out);
  fs.mkdirSync(dir, { recursive: true });

  /*
   * Pin text rasterisation. Without these, subpixel positioning and hinting
   * vary run to run and the Vizora mark in the sidebar drifted by 6 px (max
   * channel delta 15) between two captures of identical code — invisible, but
   * enough to make an exact-equality comparison report a change.
   */
  const browser = await chromium.launch({
    args: [
      '--force-color-profile=srgb',
      '--disable-lcd-text',
      '--disable-font-subpixel-positioning',
      '--font-render-hinting=none',
      '--hide-scrollbars',
    ],
  });
  /**
   * Sign in and return the resulting session.
   *
   * `assertText` is the identity guard, and it is not a formality: it is what
   * stops this ever photographing something other than the synthetic fixture.
   * For the tenant it asserts the org name; for the platform operator it asserts
   * that /admin actually RENDERED rather than bouncing to /dashboard, which is
   * the precise failure that made the previous admin baselines worthless.
   */
  async function signIn({ email, landing, assertText, label }) {
    console.log(`login (${label})…`);
    const bootstrap = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const bp = await bootstrap.newPage();
    await bp.addInitScript(FREEZE);
    await bp.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    // Wait for hydration before typing: the fields are React-controlled, so
    // input typed before the handlers attach updates the DOM value but never
    // the component state, and the form then rejects itself with "Email is
    // required" while visibly containing an email. Same reason as
    // audit-surface.mjs — do not replace with a bare fill().
    await bp.waitForSelector('#email:not([disabled])', { timeout: 60_000 });
    await bp.waitForTimeout(1500);
    await bp.locator('#email').pressSequentially(email, { delay: 15 });
    await bp.locator('#password').pressSequentially(PASSWORD, { delay: 15 });
    await bp.click('button[type="submit"]');
    await bp.waitForURL(/\/dashboard/, { timeout: 90_000 }).catch(() => {});
    if (!/\/dashboard/.test(bp.url())) {
      throw new Error(`Refusing to capture: login did not reach the dashboard (at ${bp.url()}).`);
    }
    if (landing) await bp.goto(`${BASE}${landing}`, { waitUntil: 'domcontentloaded' });
    const found = await bp
      .waitForFunction((t) => document.body.innerText.includes(t), assertText, { timeout: 30_000 })
      .then(() => true)
      .catch(() => false);
    if (!found) {
      throw new Error(
        `Refusing to capture: the ${label} session did not show "${assertText}" ` +
          `(at ${bp.url()}). Re-seed with scripts/marketing/seed-demo-tenant.mjs.`,
      );
    }
    console.log(`  ${label} verified: ${assertText}`);
    const state = await bootstrap.storageState();
    await bootstrap.close();
    return state;
  }

  /**
   * Which session captures which routes. One entry when unauthenticated, two
   * otherwise — the admin surface is unreachable from the tenant session.
   */
  let sessions;

  if (publicOnly) {
    console.log('public mode — no login, no tenant data reachable');
    sessions = [{ label: 'public', storageState: undefined, routes }];
  } else {
    if (!PASSWORD) {
      throw new Error(
        'Set DEMO_TENANT_PASSWORD (same value used to seed the demo tenant), or pass --public.',
      );
    }
    const tenantRoutes = routes.filter((r) => !ADMIN_ROUTES.includes(r));
    const adminRoutes = routes.filter((r) => ADMIN_ROUTES.includes(r));

    sessions = [];
    if (tenantRoutes.length) {
      sessions.push({
        label: 'tenant',
        storageState: await signIn({
          email: EMAIL,
          assertText: EXPECTED_TENANT,
          label: 'tenant',
        }),
        routes: tenantRoutes,
      });
    }
    if (adminRoutes.length) {
      sessions.push({
        label: 'platform',
        storageState: await signIn({
          email: PLATFORM_EMAIL,
          landing: '/admin',
          assertText: EXPECTED_ADMIN_HEADING,
          label: 'platform',
        }),
        routes: adminRoutes,
      });
    }
  }

  /*
   * Warm-up pass — visit every route once before capturing anything.
   *
   * Measured: three consecutive captures of `/` gave r1 != r2 == r3, differing
   * by 11792 px. The harness was not at fault; the FIRST visit is. Under
   * `next dev` the route compiles on demand and its images and font faces are
   * uncached, so the cold run photographs placeholder tiles and fallback type.
   * Two labelled sets taken either side of a code change are both "first runs"
   * in their own process but only one of them follows an edit that invalidated
   * the dev cache — so without this the before/after diff reports compile
   * artefacts as visual regressions.
   */
  for (const session of sessions) {
    const warm = await browser.newContext({
      ...(session.storageState ? { storageState: session.storageState } : {}),
      viewport: { width: viewports[0], height: VIEWPORT_HEIGHT[viewports[0]] || 900 },
      colorScheme: 'light',
    });
    await warm.addInitScript(FREEZE);
    await pinReadiness(warm);
    const wp = await warm.newPage();
    /*
     * Record every on-demand image-optimiser URL the pages ask for, so they can
     * be fetched to completion below. Waiting for `complete` on the page is not
     * enough on its own: a variant that is still being generated when the page
     * closes is never cached, so the next visit pays the same cost again.
     */
    const optimiserUrls = new Set();
    wp.on('request', (r) => {
      if (r.url().includes('/_next/image')) optimiserUrls.add(r.url());
    });
    process.stdout.write(`warm-up ${session.label} (${session.routes.length} routes)…`);
    for (const route of session.routes) {
      await wp.goto(`${BASE}${route}`, { waitUntil: 'load', timeout: 90_000 }).catch(() => {});
      /*
       * Let the images actually FINISH here, not just start.
       *
       * `next/image` optimises on demand in dev and caches the result under
       * .next/cache/images. A warm-up that closes the page while a variant is
       * still being generated leaves it uncached, so the real capture pays the
       * same cost and can miss it — and a run right after `rm -rf .next` then
       * differs from one on a warm tree with no code change between them. That
       * is exactly how a Phase 0 comparison produced two homepage "regressions"
       * (5877 px and 25825 px) that were nothing but a cold optimiser cache.
       * Scroll first so the lazy ones are requested at all.
       */
      // Jump-scroll is safe here BECAUSE of the optimiser warming below — see
      // sweepScroll. This only needs to provoke the requests; the warming is
      // what guarantees they finish and cache.
      await sweepScroll(wp).catch(() => {});
      await wp
        .waitForFunction(
          () =>
            Array.from(document.images).every((i) =>
              !i.getAttribute('src') && !i.currentSrc ? true : i.complete && i.naturalWidth > 0,
            ),
          null,
          { timeout: 20_000 },
        )
        .catch(() => {});
      process.stdout.write('.');
    }
    process.stdout.write('\n');
    /*
     * Fetch each optimiser URL to completion, which is what actually populates
     * .next/cache/images. Verified: warming the homepage's seven variants this
     * way turned a run that was losing scene tiles into one byte-identical to
     * the reference set, on the same code.
     */
    /*
     * NOT redundant with the stepped scroll above — tested, on purpose.
     *
     * Stepped scrolling fixes the "never requested" half of the problem: it
     * brings lazy elements through the viewport so the request is issued at all.
     * It does nothing about the "requested but slow" half — next/image still has
     * to generate each variant, and an abandoned generation is never cached.
     * With this block disabled and stepped scrolling in place, the homepage
     * scene tiles were still MISSING from the capture while the reference set
     * had them. Both mechanisms are load-bearing; do not delete this one on the
     * assumption that the scroll covers it.
     */
    if (optimiserUrls.size) {
      let warmed = 0;
      for (const u of optimiserUrls) {
        const res = await wp.request.get(u, { timeout: 120_000 }).catch(() => null);
        if (res && res.ok()) {
          await res.body().catch(() => {});
          warmed++;
        }
      }
      console.log(`  image optimiser: ${warmed}/${optimiserUrls.size} variants cached`);
    }
    await warm.close();
  }

  const manifest = [];
  for (const vw of viewports) {
    const height = VIEWPORT_HEIGHT[vw] || 900;
    const isMobile = vw <= 500;
    for (const session of sessions) {
    const ctx = await browser.newContext({
      ...(session.storageState ? { storageState: session.storageState } : {}),
      viewport: { width: vw, height },
      // Phase 0 predates the light-only decision (plan §3 D1) but the app still
      // ships a dark default, so pin the scheme rather than inheriting the host's.
      colorScheme: 'light',
      deviceScaleFactor: 1,
      hasTouch: isMobile,
      isMobile,
      reducedMotion: 'reduce',
    });
    await ctx.addInitScript(FREEZE);
    await pinReadiness(ctx);

    for (const route of session.routes) {
      const page = await ctx.newPage();
      const consoleErrors = [];
      page.on('console', (m) => {
        if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200));
      });
      const file = `${slug(route)}__${vw}.png`;
      try {
        await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
        // networkidle is unreliable with a live socket open, so settle on a
        // budget instead; fonts are awaited explicitly because a late-swapping
        // webfont reflows the whole page.
        await page.waitForLoadState('load', { timeout: 60_000 }).catch(() => {});
        await page.evaluate(() => document.fonts.ready).catch(() => {});
        await page.waitForTimeout(settleMs);
        await page.addStyleTag({ content: STABILISE_CSS });
        await page.evaluate(() => {
          document.querySelectorAll('nextjs-portal').forEach((n) => n.remove());
        });
        // Sweep so anything gated on IntersectionObserver (`.eh-reveal`) fires,
        // then return to the top. Jump, not stepped — see sweepScroll.
        await sweepScroll(page);
        /*
         * Wait for every <img> to finish decoding.
         *
         * Scrolling only *starts* the lazy loads. The homepage's scene art is
         * ~100 KB per tile and landed inside the settle budget on one run and
         * not the next — a placeholder rounded-rect in one shot and the artwork
         * in the other, 5915 px apart, with nothing wrong in the code.
         * Bounded, because a genuinely broken image must not hang the capture.
         */
        /*
         * Wait for the image set to be both COMPLETE and STABLE.
         *
         * "All images loaded" is not enough on the landing page. Its sections
         * mount their art as they are revealed, so at the moment of the check
         * the tile's <img> is not in the document at all and the condition
         * passes vacuously — then the element appears and the next capture
         * disagrees with this one. Three separate runs each lost a DIFFERENT
         * tile this way, which is the signature of a race rather than a bug in
         * the page. Requiring the count to hold steady across consecutive polls
         * closes it. `naturalWidth > 0` is also needed: an <img> with no src
         * assigned yet reports complete === true.
         */
        const imagesSettled = await page
          .waitForFunction(
            () => {
              const imgs = Array.from(document.images);
              const ok = imgs.every((i) =>
                !i.getAttribute('src') && !i.currentSrc ? true : i.complete && i.naturalWidth > 0,
              );
              const w = window;
              if (!ok) {
                w.__baselineStable = 0;
                return false;
              }
              if (w.__baselineCount !== imgs.length) {
                w.__baselineCount = imgs.length;
                w.__baselineStable = 0;
                return false;
              }
              w.__baselineStable = (w.__baselineStable || 0) + 1;
              return w.__baselineStable >= 4;
            },
            null,
            { timeout: 30_000, polling: 250 },
          )
          .then(() => true)
          .catch(() => false);
        // Not fatal: the 30s cap then acts as a long fixed settle, which the
        // homepage needs anyway. Logged because a route that never settles is
        // the first place to look if its shot ever starts flapping.
        if (!imagesSettled) console.log(`      (image set never went quiet on ${route}; fell back to the 30s cap)`);
        /*
         * Re-await fonts AFTER the scroll and the image wait.
         *
         * `document.fonts.ready` resolves once the fonts pending *at that
         * moment* have settled — a face whose load is triggered by content that
         * renders later is not pending yet, so the promise resolves early and
         * lies. The homepage headings were captured in the fallback sans on one
         * run and in Fraunces on the next. `status === 'loaded'` is the check
         * that holds once nothing further is outstanding.
         */
        await page
          .waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 20_000 })
          .catch(() => console.log(`      (fonts still loading after 20s on ${route})`));
        await page.waitForTimeout(300);
        for (const sub of TEXT_SUBSTITUTIONS[route] || []) {
          await page.evaluate(
            ([sel, text]) => {
              document.querySelectorAll(sel).forEach((n) => {
                n.textContent = text;
              });
            },
            [sub.selector, sub.text],
          );
        }
        /*
         * Grow the viewport to the content and take a NORMAL shot, rather than
         * asking for `fullPage`.
         *
         * `fullPage` uses Chromium's capture-beyond-viewport, which re-renders
         * the document outside the visible box. That re-evaluates
         * `loading="lazy"`, and a scene tile that was verifiably loaded moments
         * earlier can come out blank — measured repeatedly on the homepage, in
         * every scroll configuration, and unfixed by `loading='eager'` or
         * `decode()`. Resizing means every pixel captured was genuinely inside
         * the viewport and genuinely painted, so there is nothing left to
         * re-evaluate. It is also why fidelity has to be eyeballed: two blank
         * tiles diff to zero just as happily as two correct ones.
         */
        const contentHeight = await page.evaluate(() =>
          Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.offsetHeight,
          ),
        );
        await page.setViewportSize({ width: vw, height: Math.min(contentHeight, 20000) });
        // Let the enlarged viewport settle: the resize itself triggers the lazy
        // loads for everything now on screen, and they must finish before the shot.
        await page
          .waitForFunction(
            () =>
              Array.from(document.images).every((i) =>
                !i.getAttribute('src') && !i.currentSrc ? true : i.complete && i.naturalWidth > 0,
              ),
            null,
            { timeout: 30_000 },
          )
          .catch(() => {});
        await page.waitForTimeout(600);
        await page.screenshot({
          path: nodePath.join(dir, file),
          animations: 'disabled',
          mask: GLOBAL_MASKS.map((sel) => page.locator(sel)),
          maskColor: '#ff00ff',
        });
        const bytes = fs.statSync(nodePath.join(dir, file)).size;
        /*
         * Record where the browser actually ENDED UP.
         *
         * A route that redirects still produces a perfectly good-looking
         * screenshot — of a different page. All four `/admin/*` routes do
         * exactly this: `admin/layout.tsx` sends a non-`isSuperAdmin` user to
         * `/dashboard`, and the seeded demo admin is not one, so those four
         * shots are duplicates of the dashboard and the admin surface is NOT
         * baselined. Unlabelled, that reads as "admin covered" on a review
         * checklist. Naming it is the difference between a gap and a lie.
         */
        /*
         * Record horizontal overflow explicitly.
         *
         * `fullPage` used to capture past the right edge, which is how the admin
         * routes' mobile overflow was spotted (full-page widths of 512/485/459
         * against a 390 viewport). A viewport-sized shot clips that instead, so
         * the defect would become invisible in the image. Measuring scrollWidth
         * keeps the signal — arguably better, since it names the number rather
         * than leaving a reviewer to notice an unusually wide PNG.
         */
        const overflow = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        const overflowsX = overflow.scrollWidth > overflow.clientWidth + 1;
        const landed = new URL(page.url()).pathname;
        const redirected = landed !== route && !(route === '/__not-found__' && landed === route);
        manifest.push({
          route,
          session: session.label,
          landedOn: landed,
          redirected,
          overflowsX,
          scrollWidth: overflow.scrollWidth,
          viewport: vw,
          file,
          bytes,
          consoleErrors,
        });
        console.log(
          `  ${String(vw).padStart(4)}px ${route} -> ${file} (${(bytes / 1024).toFixed(0)} KB)` +
            (redirected ? `  [REDIRECTED to ${landed} — this is not a baseline of ${route}]` : '') +
            (overflowsX ? `  [OVERFLOWS-X ${overflow.scrollWidth}px in a ${vw}px viewport]` : ''),
        );
      } catch (err) {
        manifest.push({
          route,
          session: session.label,
          viewport: vw,
          file: null,
          error: String(err).slice(0, 300),
          consoleErrors,
        });
        console.log(`  ${String(vw).padStart(4)}px ${route} -> ERROR ${String(err).slice(0, 140)}`);
      }
      await page.close();
    }
    await ctx.close();
    }
  }

  await browser.close();

  fs.writeFileSync(
    nodePath.join(dir, 'manifest.json'),
    JSON.stringify(
      {
        label,
        base: BASE,
        publicOnly,
        capturedAt: new Date().toISOString(),
        // The fixture's epoch. Time-bearing screens are only comparable between
        // two sets seeded with the SAME value — see the SEED_EPOCH note in
        // scripts/marketing/seed-demo-tenant.mjs. Check this first when a diff
        // makes no sense.
        seedEpoch: process.env.DEMO_SEED_EPOCH || null,
        shots: manifest,
      },
      null,
      2,
    ),
  );

  const ok = manifest.filter((m) => m.file).length;
  const totalKb = manifest.reduce((s, m) => s + (m.bytes || 0), 0) / 1024;
  console.log(`\n  ${ok}/${manifest.length} captured · ${(totalKb / 1024).toFixed(1)} MB · ${dir}`);
  if (ok !== manifest.length) process.exitCode = 1;
}

/* ══════════════════════════════════════════════════════════════════════════ */

const OUT = arg('out', nodePath.join(REPO_ROOT, 'tasks', 'design-baselines'));
const compareIdx = process.argv.indexOf('--compare');

if (compareIdx !== -1) {
  const [a, b] = process.argv.slice(compareIdx + 1, compareIdx + 3);
  if (!a || !b) throw new Error('Usage: --compare <labelA> <labelB>');
  await compare(a, b, OUT);
} else {
  const label = arg('label', null);
  if (!label) throw new Error('Usage: --label <name>   (or --compare <a> <b>)');
  const publicOnly = process.argv.includes('--public');
  // ADMIN_ROUTES is a separate list because it needs a separate session, but it
  // is still part of the default set — leaving it out would silently shrink the
  // baseline from 26 routes to 22 and drop the admin surface entirely, which is
  // the opposite of why it was split out.
  const defaultRoutes = publicOnly
    ? PUBLIC_ROUTES
    : [...PUBLIC_ROUTES, ...AUTHED_ROUTES, ...ADMIN_ROUTES];
  const routes = arg('routes', defaultRoutes.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
  const viewports = arg('viewports', '1440,390').split(',').map((s) => parseInt(s.trim(), 10)).filter(Boolean);
  const settleMs = parseInt(arg('settle', '3500'), 10);
  await capture(label, routes, viewports, OUT, settleMs, publicOnly);
}
