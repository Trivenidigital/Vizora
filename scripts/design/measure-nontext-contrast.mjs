/**
 * LOCAL-ONLY non-text contrast measurement — the blind spot `audit-surface.mjs`
 * cannot see.
 *
 * `audit-surface.mjs` computes WCAG contrast for TEXT runs only. A control that
 * replaces a native element with `appearance: none` draws its own boundary, and
 * that boundary is governed by SC 1.4.11 (3:1 against the adjacent colour) — a
 * criterion with no text in it, so the surface audit scores a failing control as
 * zero failures. That is exactly how `.eh-check` shipped at ~1.8:1 in the Devices
 * redesign under a clean report.
 *
 * This script reads the LIVE computed boundary colour off the real node (border,
 * or `::before`'s border when the visible box is a pseudo-element), resolves the
 * first opaque background behind it by walking ancestors, and computes the ratio.
 * Nothing here is asserted by hand.
 *
 * It is deliberately a separate, explicitly-targeted script rather than another
 * page-wide scanner: which element IS a control boundary is a judgement about
 * intent, and a scanner that guessed would report every decorative hairline in
 * the app as a 1.4.11 failure.
 *
 * Usage:
 *   DEMO_TENANT_PASSWORD=... node scripts/design/measure-nontext-contrast.mjs \
 *     [--route /dashboard/playlists] [--themes light,dark] [--viewport 1440]
 */
import { chromium } from 'playwright';

const BASE = process.env.CAPTURE_BASE_URL || 'http://localhost:3001';
const EMAIL = process.env.DEMO_TENANT_EMAIL || 'demo@vizora.local';
const PASSWORD = process.env.DEMO_TENANT_PASSWORD;
const EXPECTED_TENANT = 'Northwind Coffee Roasters';

if (!PASSWORD) throw new Error('Set DEMO_TENANT_PASSWORD (same value used to seed the demo tenant).');
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE)) {
  throw new Error(`Refusing to log in against non-local target: ${BASE}`);
}

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

const ROUTE = arg('route', '/dashboard/playlists');
const THEMES = arg('themes', 'light,dark').split(',').map((s) => s.trim()).filter(Boolean);
const VIEWPORT = parseInt(arg('viewport', '1440'), 10);

/**
 * The probes.
 *
 * `selector` picks the node; `pseudo` names the box that actually paints the
 * boundary (`.eh-check` hides the element and paints a 20px `::before`);
 * `prepare` is an in-page step that has to run before the control exists or
 * before it reaches the state being measured.
 */
const PROBES = [
  {
    name: 'sort select (.eh-select-inline) border, on the page background',
    selector: 'select.eh-select-inline',
  },
  {
    // The select's other identifying carrier. A hairline that loses to the
    // background does not fail 1.4.11 on its own if a graphical part of the same
    // control clears 3:1 — so measure it rather than assume either way.
    name: 'sort select chevron glyph, on the page background',
    selector: 'select.eh-select-inline + svg',
    graphic: true,
  },
  {
    name: 'summary chip (.eh-fleet-chip) border, unpressed',
    selector: '.eh-fleet-chip[aria-pressed="false"]',
  },
  {
    name: 'summary chip (.eh-fleet-chip) border, pressed',
    selector: '.eh-fleet-chip[aria-pressed="true"]',
  },
  {
    name: 'assign-modal checkbox (.eh-check) box border, unchecked',
    selector: 'input.eh-check:not(:checked)',
    pseudo: '::before',
    prepare: 'openAssignModal',
  },
  {
    name: 'assign-modal checkbox (.eh-check) box border, checked',
    selector: 'input.eh-check:checked',
    pseudo: '::before',
    prepare: 'openAssignModalAndCheck',
  },
];

/* ---------- colour maths (serialised into the browser) ---------- */
const IN_PAGE = `
/*
 * ONLY rgb()/rgba() is understood, which is every colour Chromium currently
 * resolves computed styles to. If the tokens ever move to \`oklch()\` or
 * \`color-mix()\` and Chromium starts serialising those verbatim, this returns
 * null — and a null BORDER silently falls through to reporting the FILL, which
 * would mask a failing boundary rather than surface it. Add the new syntax here
 * before adopting it in globals.css.
 */
function parseColor(str) {
  const m = String(str).match(/rgba?\\(([^)]+)\\)/);
  if (!m) return null;
  const parts = m[1].split(',').map((p) => parseFloat(p));
  return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
}
function over(fg, bg) {
  const a = fg.a;
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1,
  };
}
function luminance(c) {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}
function ratio(a, b) {
  const l1 = luminance(a), l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
/**
 * The colour the boundary actually sits on.
 *
 * Walks ancestors compositing every translucent background it meets until it
 * reaches an opaque one, so a badge fill at 10% alpha over a card over the page
 * resolves to the real pixel rather than to the nearest declared colour.
 *
 * It starts at \`parentElement\`, so the PROBED element's own background is
 * excluded by design — that colour is the control's fill, which the caller
 * measures separately AGAINST this backdrop. Safe for every probe here because
 * \`.eh-check\` sets \`background: transparent\` on the element and paints the box
 * on \`::before\`; a probe on an element that paints its own opaque background and
 * a boundary would need that layer added.
 */
function backdropOf(el) {
  const layers = [];
  let node = el.parentElement;
  while (node) {
    const c = parseColor(getComputedStyle(node).backgroundColor);
    if (c && c.a > 0) {
      layers.push(c);
      if (c.a >= 1) break;
    }
    node = node.parentElement;
  }
  let base = { r: 255, g: 255, b: 255, a: 1 };
  for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
  return base;
}
function fmt(c) {
  return 'rgb(' + [c.r, c.g, c.b].map(Math.round).join(', ') + ')';
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
/**
 * SC 1.4.11 asks whether the control can be told apart from what SURROUNDS it.
 *
 * So both candidate carriers are measured against the backdrop OUTSIDE the
 * control — its boundary and its fill — and the better of the two is the one
 * that decides, because either alone is enough to identify the control. An
 * earlier version of this compared the border against the control's OWN fill,
 * which scores a solid filled checkbox (border and fill the same colour) at
 * 1:1 while it is in fact the most visible state there is.
 */
window.__measure = (selector, pseudo, graphic) => {
  const el = document.querySelector(selector);
  if (!el) return { error: 'no element matched ' + selector };
  const cs = getComputedStyle(el, pseudo || undefined);
  const backdrop = backdropOf(el);
  if (graphic) {
    // An icon painted in currentColor: the glyph IS the graphical object, so its
    // ink against the backdrop is the whole measurement.
    const ink = parseColor(cs.color);
    if (!ink || ink.a === 0) return { error: 'no ink on ' + selector };
    return {
      backdrop: fmt(backdrop),
      state: null,
      fill: cs.color,
      fillRatio: round2(ratio(over(ink, backdrop), backdrop)),
      carrier: 'glyph',
      ratio: round2(ratio(over(ink, backdrop), backdrop)),
    };
  }
  const border = parseColor(cs.borderTopColor);
  const borderWidth = parseFloat(cs.borderTopWidth) || 0;
  const fill = parseColor(cs.backgroundColor);

  const out = { backdrop: fmt(backdrop), state: el.checked === undefined ? null : (el.checked ? 'checked' : 'unchecked') };
  let best = 0;
  let carrier = null;
  if (border && border.a > 0 && borderWidth > 0) {
    out.border = cs.borderTopColor;
    out.borderRatio = round2(ratio(over(border, backdrop), backdrop));
    if (out.borderRatio > best) { best = out.borderRatio; carrier = 'border'; }
  }
  if (fill && fill.a > 0) {
    out.fill = cs.backgroundColor;
    out.fillRatio = round2(ratio(over(fill, backdrop), backdrop));
    if (out.fillRatio > best) { best = out.fillRatio; carrier = 'fill'; }
  }
  if (!carrier) return { error: 'no boundary and no fill on ' + selector };
  out.carrier = carrier;
  out.ratio = best;
  return out;
};
`;

const PREPARE = {
  async openAssignModal(page) {
    await page.getByRole('button', { name: /^Assign .* to devices$/ }).first().click();
    await page.locator('input.eh-check').first().waitFor({ state: 'attached' });
    await page.waitForTimeout(500);
  },
  async openAssignModalAndCheck(page) {
    await page.getByRole('button', { name: /^Assign .* to devices$/ }).first().click();
    await page.locator('input.eh-check').first().check();
    /* `.check()` resolves as soon as the element reports checked, which is
       before the style recalculation that `:checked::before` depends on has
       landed. Measuring immediately reads the UNCHECKED box back — identical
       numbers for both probes, which is the tell. */
    await page.waitForTimeout(500);
  },
};

const results = [];

const browser = await chromium.launch();
try {
  /**
   * Log in once and reuse the session, exactly as `audit-surface.mjs` does —
   * including the hydration wait before typing. The login fields are
   * React-controlled, so a bare `fill()` before the handlers attach sets the DOM
   * value and never the component state, and the form then rejects itself while
   * visibly containing an email.
   */
  const bootstrap = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const bp = await bootstrap.newPage();
  await bp.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await bp.waitForSelector('#email:not([disabled])', { timeout: 30_000 });
  await bp.waitForTimeout(1500);
  await bp.locator('#email').pressSequentially(EMAIL, { delay: 15 });
  await bp.locator('#password').pressSequentially(PASSWORD, { delay: 15 });
  await bp.click('button[type="submit"]');
  await bp.waitForURL(/\/dashboard/, { timeout: 60_000 }).catch(() => {});
  if (!/\/dashboard/.test(bp.url())) {
    throw new Error(`Refusing to measure: login did not reach the dashboard (at ${bp.url()}).`);
  }
  const found = await bp
    .waitForFunction((name) => document.body.innerText.includes(name), EXPECTED_TENANT, {
      timeout: 30_000,
    })
    .then(() => true)
    .catch(() => false);
  if (!found) {
    throw new Error(
      `Refusing to measure: logged-in workspace is not the synthetic demo tenant ("${EXPECTED_TENANT}").`,
    );
  }
  console.log(`  tenant verified: ${EXPECTED_TENANT}`);
  const storageState = await bootstrap.storageState();
  await bootstrap.close();

  for (const theme of THEMES) {
    const context = await browser.newContext({
      storageState,
      viewport: { width: VIEWPORT, height: 900 },
      colorScheme: theme === 'dark' ? 'dark' : 'light',
    });
    // Same two keys `audit-surface.mjs` sets, set before any app code runs so
    // the first paint is already in the theme being measured.
    await context.addInitScript(
      ([t]) => {
        try {
          localStorage.setItem('theme-mode', t);
          localStorage.setItem('vizora_cookie_consent', 'all');
        } catch {}
      },
      [theme],
    );
    const page = await context.newPage();

    for (const probe of PROBES) {
      await page.goto(`${BASE}${ROUTE}`, { waitUntil: 'networkidle' });
      // A bare string is evaluated as an EXPRESSION, so the declarations have to
      // be wrapped in an invoked arrow to reach `window`.
      await page.evaluate(`(() => { ${IN_PAGE} })()`);
      if (probe.prepare) await PREPARE[probe.prepare](page);
      const out = await page.evaluate(
        ([sel, ps, gr]) => window.__measure(sel, ps, gr),
        [probe.selector, probe.pseudo || null, Boolean(probe.graphic)],
      );
      results.push({ theme, probe: probe.name, ...out });
    }

    await context.close();
  }
} finally {
  await browser.close();
}

const PASS = 3.0;
let failures = 0;
for (const r of results) {
  if (r.error) {
    console.log(`  ${r.theme.padEnd(5)} ${r.probe} -> SKIPPED (${r.error})`);
    continue;
  }
  const verdict = r.ratio >= PASS ? 'PASS' : 'FAIL';
  if (verdict === 'FAIL') failures++;
  const parts = [];
  if (r.border) parts.push(`border ${r.border} -> ${r.borderRatio}:1`);
  if (r.fill) parts.push(`fill ${r.fill} -> ${r.fillRatio}:1`);
  console.log(
    `  ${r.theme.padEnd(5)} ${r.probe}${r.state ? ` [${r.state}]` : ''}\n` +
      `        on ${r.backdrop}: ${parts.join(', ')}\n` +
      `        best carrier = ${r.carrier} at ${r.ratio}:1  ${verdict} (SC 1.4.11 wants >= 3:1)`,
  );
}
console.log(`\n${results.length} probes, ${failures} below 3:1`);
process.exit(failures > 0 ? 1 : 0);
