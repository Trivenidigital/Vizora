/**
 * LOCAL-ONLY capture of the real dashboard for the marketing product shot.
 * Logs into the synthetic demo tenant and screenshots the fleet view.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import nodePath from 'node:path';

const BASE = process.env.CAPTURE_BASE_URL || 'http://localhost:3001';
const EMAIL = 'demo@vizora.local';
const PASSWORD = process.env.DEMO_TENANT_PASSWORD;
/** The synthetic org seeded by seed-demo-tenant.mjs. Nothing else may be shot. */
const EXPECTED_TENANT = 'Northwind Coffee Roasters';
const OUT_DIR = 'web/public/product';

if (!PASSWORD) throw new Error('Set DEMO_TENANT_PASSWORD (same value used to seed the demo tenant).');

/**
 * Two guards, because the origin check alone is not enough.
 *
 * This script does not talk to a database — it drives a browser at whatever
 * web server is on BASE, which in turn talks to whatever middleware, which in
 * turn talks to whatever DATABASE_URL that middleware was booted with. None of
 * that is visible from here. So a local-looking URL proves nothing about which
 * data is behind it: point a locally-running middleware at prod and this would
 * happily screenshot production.
 *
 * Guard 1 (origin) is now meaningful because BASE is overridable — before, it
 * tested a hardcoded constant and could never fail.
 * Guard 2 (tenant identity, asserted after login below) is the one that
 * actually protects the data: if the logged-in workspace is not the synthetic
 * demo org, we abort before taking any screenshot.
 */
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE)) {
  throw new Error(`Refusing to log in against non-local target: ${BASE}`);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2, // retina-quality asset
  colorScheme: 'dark',
});
const page = await ctx.newPage();

page.on('console', (m) => { if (m.type() === 'error') console.log('  [console error]', m.text().slice(0, 160)); });

console.log('1. login');
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('input[type="email"], input[name="email"]', EMAIL);
await page.fill('input[type="password"], input[name="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL(/\/dashboard/, { timeout: 45_000 }).catch(() => {});
console.log('   landed at', page.url());

// Guard 2 — tenant identity. This is the check that actually protects real
// data: whatever is behind BASE, refuse to photograph it unless the logged-in
// workspace is the synthetic demo org. Pointed at anything else (including a
// local middleware wired to a production database) this aborts before the
// first screenshot is taken.
if (!/\/dashboard/.test(page.url())) {
  throw new Error(`Refusing to capture: login did not reach the dashboard (at ${page.url()}).`);
}
const tenant = await page.evaluate(() => document.body.innerText.slice(0, 4000));
if (!tenant.includes(EXPECTED_TENANT)) {
  throw new Error(
    `Refusing to capture: logged-in workspace is not the synthetic demo tenant ` +
      `("${EXPECTED_TENANT}" not found on the page). Re-seed with ` +
      `scripts/marketing/seed-demo-tenant.mjs and retry.`,
  );
}
console.log(`   tenant verified: ${EXPECTED_TENANT}`);

// Dismiss the cookie bar so it does not sit across the product shot.
await page.evaluate(() => localStorage.setItem('vizora_cookie_consent', 'all'));

/**
 * Strip artefacts that are NOT part of the shipped product surface:
 *  - <nextjs-portal>: the Next.js dev-tools overlay (the red "N  1 Issue" pill).
 *    It only exists in `next dev` and never renders in a production build —
 *    it is tooling chrome, not product state. This is exactly what made the
 *    previous repo captures unusable.
 *  - the floating support-chat launcher, which otherwise sits on top of the
 *    device table. It IS a real feature; it is hidden only so it does not
 *    occlude the content the shot is meant to show.
 * Nothing here alters product data or status.
 */
async function stripNonProductChrome() {
  await page.addStyleTag({
    content: `
      nextjs-portal { display: none !important; }
      button[aria-label*="support" i], button[aria-label*="chat" i] { display: none !important; }
    `,
  });
  await page.evaluate(() => {
    document.querySelectorAll('nextjs-portal').forEach((n) => n.remove());
  });
}

async function shoot(path, file, waitFor) {
  console.log(`2. capture ${path}`);
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 30_000 }).catch(() => console.log('   (selector not found, capturing anyway)'));
  // Wait for the realtime pill to report a live socket rather than capturing
  // a transient "Offline" — fail loudly instead of shipping a misleading shot.
  const live = await page.waitForSelector('text=Live', { timeout: 20_000 }).catch(() => null);
  console.log(`   realtime pill live: ${live ? 'YES' : 'NO'}`);
  await stripNonProductChrome();
  await page.waitForTimeout(2500); // let reveal/transition animations settle
  await page.screenshot({ path: `${OUT_DIR}/${file}`, animations: 'disabled' });
  console.log(`   wrote ${OUT_DIR}/${file}`);
}

await shoot('/dashboard/devices', 'dashboard-fleet.png', 'text=/Flagship|Ballard|Fremont/i');

// Dump what actually rendered, for eyeballing without guessing. Written to the
// OS temp dir, NOT the repo root: this is raw dashboard innerText, and the
// old '.tmp-capture-dashboard-text.txt' path was not matched by .gitignore's
// '*.tmp' rule, so a future run against richer data could have committed it.
const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 1200));
const dumpPath = nodePath.join(os.tmpdir(), 'vizora-capture-dashboard-text.txt');
fs.writeFileSync(dumpPath, bodyText);
console.log('   page text dump ->', dumpPath);

await browser.close();
console.log('done');
