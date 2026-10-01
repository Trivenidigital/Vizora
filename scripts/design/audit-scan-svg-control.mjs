/**
 * CONTROLS for the surface scanner's SVG handling. Hermetic: no app, no login, no
 * database — a fixture page in a real Chromium, driven by the SAME exported `SCAN`
 * the audit uses.
 *
 * It exists because the audit is a measuring instrument and it was wrong. Before
 * B17 it read computed `color` for every text run, which is not what paints an SVG
 * glyph, so it reported a failure on a recharts pie label that renders in
 * `--foreground` (false positive) and would have passed a genuinely unreadable
 * label that merely inherited an acceptable `color` (false negative). A harness
 * wrong in both directions is worse than none, so both directions are pinned here.
 *
 * Each case states what it must report. A case that reports nothing when it should
 * fail is as much a failure as the reverse — that is the whole point.
 *
 *   node scripts/design/audit-scan-svg-control.mjs
 *
 * Exit 0 = every case behaved as declared. Exit 1 = the instrument is lying again.
 */
import { chromium } from 'playwright';

import { SCAN } from './audit-scan.mjs';

const CARD = '#fdfbf5'; // --surface, the ground every fixture card paints
const SLICE = '#10B981'; // the colour AnalyticsService sends for `online`
const INK = '#23261f'; // --foreground, what B16 re-inks the labels to

/**
 * The fixture reproduces recharts' real output shape, which is what makes the
 * before/after pair faithful: `Pie.renderLabelItem` spreads the SECTOR's props onto
 * its `<Text>`, so the `fill` ATTRIBUTE carries the slice colour and the text sits
 * in a `<tspan>`. B16 added a CSS declaration that outranks that attribute. Case 1
 * is the post-B16 state, case 2 is the pre-B16 state — same markup, one rule.
 */
const FIXTURE = `<!doctype html>
<html><head><style>
  body { margin: 0; background: ${CARD}; font: 16px sans-serif; }
  .card { background: ${CARD}; padding: 24px; }
  /* B16's rule. Present for case 1, absent for case 2 by scoping it to #fixed. */
  #fixed .recharts-pie-label-text { fill: ${INK}; }
  text { font-size: 12px; }
</style></head><body>
  <div class="card">
    <!-- 1. POST-B16: attribute says the slice colour, CSS paints the ink. -->
    <svg id="fixed" width="300" height="60">
      <text class="recharts-text recharts-pie-label-text" x="10" y="30" fill="${SLICE}"><tspan>fixed-label</tspan></text>
    </svg>

    <!-- 2. PRE-B16: nothing overrides the attribute, so the glyph IS the slice colour. -->
    <svg id="broken" width="300" height="60">
      <text class="recharts-text recharts-pie-label-text" x="10" y="30" fill="${SLICE}"><tspan>broken-label</tspan></text>
    </svg>

    <!-- 3. Text sitting ON a filled shape: the shape is the ground, not the card.
            Ink on forest reads fine against the card and must NOT be measured
            against it. pointer-events:none is set on purpose — hit testing would
            miss this shape, isPointInFill does not. -->
    <svg id="onshape" width="300" height="80">
      <rect x="0" y="0" width="300" height="80" fill="#1f4230" pointer-events="none" />
      <text class="recharts-text" x="20" y="45" fill="${INK}"><tspan>on-dark-shape</tspan></text>
    </svg>

    <!-- 4. Text on a filled shape where it is perfectly legible: must stay clean. -->
    <svg id="onshape-ok" width="300" height="80">
      <rect x="0" y="0" width="300" height="80" fill="#1f4230" pointer-events="none" />
      <text class="recharts-text" x="20" y="45" fill="#f2efe4"><tspan>on-dark-ok</tspan></text>
    </svg>

    <!-- 5. fill: none — nothing is painted, so there is no ratio to report. -->
    <svg id="nofill" width="300" height="60">
      <text class="recharts-text" x="10" y="30" fill="none"><tspan>no-fill-label</tspan></text>
    </svg>

    <!-- 6. A gradient paint server: not a flat colour, so unmeasurable. -->
    <svg id="grad" width="300" height="60">
      <defs><linearGradient id="g1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient></defs>
      <text class="recharts-text" x="10" y="30" fill="url(#g1)"><tspan>gradient-label</tspan></text>
    </svg>

    <!-- 7. currentColor resolves back to 'color', which here is deliberately unreadable. -->
    <svg id="currentcolor" width="300" height="60" style="color: #e9e2d2">
      <text class="recharts-text" x="10" y="30" fill="currentColor"><tspan>currentcolor-label</tspan></text>
    </svg>

    <!-- 8. Plain HTML text, unreadable, to prove the HTML path still works. -->
    <p style="color:#e9e2d2">html-control-label</p>

    <!-- 10. THE CLIP-PATH RECT. recharts emits <defs><clipPath><rect> spanning the
             whole plot area; it is NEVER painted, but <defs> carries the UA
             display:none and its CHILD does not, so the rect's own computed display
             is normal, its fill defaults to black and its box contains every label.
             This is what made every pie label report a dark ground. Measured on real
             recharts SSR output before the fix: 3 labels, 3 hits, each
             'DEFS rect fill=rgb(0, 0, 0) bbox=5,5 390x290'. -->
    <svg id="clipped" width="300" height="80" viewBox="0 0 300 80">
      <defs><clipPath id="cp1"><rect x="0" y="0" width="300" height="80" /></clipPath></defs>
      <g clip-path="url(#cp1)"></g>
      <text class="recharts-text" x="10" y="45" fill="${INK}"><tspan>over-clip-rect</tspan></text>
    </svg>

    <!-- 11. A filled shape ELSEWHERE IN THE SAME SVG that the glyph is not over. -->
    <svg id="same-svg-elsewhere" width="300" height="80" viewBox="0 0 300 80">
      <rect x="0" y="0" width="90" height="80" fill="#1f4230" />
      <text class="recharts-text" x="150" y="45" fill="${INK}"><tspan>beside-shape</tspan></text>
    </svg>

    <!-- 12. A filled shape in a DIFFERENT SVG. Candidates come from the glyph's own
             ownerSVGElement, so this must never win however the geometry lines up. -->
    <svg id="other-svg-fill" width="300" height="80" viewBox="0 0 300 80">
      <rect x="0" y="0" width="300" height="80" fill="#1f4230" />
    </svg>
    <svg id="other-svg-text" width="300" height="80" viewBox="0 0 300 80">
      <text class="recharts-text" x="10" y="45" fill="${INK}"><tspan>other-svg-label</tspan></text>
    </svg>

    <!-- 13. USER SPACE != SCREEN SPACE. The viewBox is 10x the rendered size, so the
             shape's geometry lives at user coordinates nowhere near the glyph's
             client coordinates. Testing the client point directly reports no hit
             here and a hit in case 14 — exactly backwards — so these two cases are
             what prove the per-shape inverse CTM is applied. -->
    <svg id="scaled-off" width="300" height="80" viewBox="0 0 3000 800">
      <rect x="0" y="0" width="900" height="800" fill="#1f4230" />
      <text class="recharts-text" x="1500" y="450" font-size="120" fill="${INK}"><tspan>scaled-beside</tspan></text>
    </svg>

    <!-- 14. Same scaling, but the glyph IS over the shape: must be measured against
             the forest fill, not the card. -->
    <svg id="scaled-on" width="300" height="80" viewBox="0 0 3000 800">
      <rect x="0" y="0" width="3000" height="800" fill="#1f4230" />
      <text class="recharts-text" x="200" y="450" font-size="120" fill="${INK}"><tspan>scaled-on-shape</tspan></text>
    </svg>

    <!-- 15. A shape with fill-opacity:0 paints nothing and is not a ground. -->
    <svg id="invisible-fill" width="300" height="80" viewBox="0 0 300 80">
      <rect x="0" y="0" width="300" height="80" fill="#1f4230" fill-opacity="0" />
      <text class="recharts-text" x="10" y="45" fill="${INK}"><tspan>over-invisible</tspan></text>
    </svg>

    <!-- 9. THE FALSE POSITIVE, reproduced. 'fill' paints a perfectly readable ink
            while the inherited 'color' is unreadable. The old scanner read 'color'
            and reported a failure nobody could see; this is the shape of what the
            lead observed on the live analytics page after B16. -->
    <svg id="falsepos" width="300" height="60" style="color: #e9e2d2">
      <text class="recharts-text" x="10" y="30" fill="${INK}"><tspan>false-positive-label</tspan></text>
    </svg>
  </div>
</body></html>`;

/**
 * What each case must produce. `fails` means "appears in contrast findings";
 * `unmeasurable` means "appears in skipped, with this reason".
 */
const CASES = [
  { text: 'fixed-label', fails: false, why: 'post-B16: CSS fill outranks the attribute, so the glyph is --foreground' },
  { text: 'broken-label', fails: true, why: 'pre-B16 positive control: the glyph really is the slice colour on the card' },
  { text: 'on-dark-shape', fails: true, why: 'ink on a forest shape — measured against the SHAPE, not the card' },
  { text: 'on-dark-ok', fails: false, why: 'on-forest ink on the same shape reads fine' },
  { text: 'no-fill-label', unmeasurable: 'svg-fill-none', why: 'nothing painted' },
  { text: 'gradient-label', unmeasurable: 'svg-fill-paint-server', why: 'not a flat colour' },
  { text: 'currentcolor-label', fails: true, why: 'currentColor resolves to an unreadable `color`' },
  { text: 'html-control-label', fails: true, why: 'the HTML path must keep working' },
  {
    text: 'false-positive-label',
    fails: false,
    why: 'the painted ink is readable; only the inherited `color` is not — reading `color` reported a failure nobody could see',
  },
  { text: 'over-clip-rect', fails: false, why: 'a clipPath rect is never painted, so the ground is the card — the B18 defect' },
  { text: 'beside-shape', fails: false, why: 'a filled shape elsewhere in the same SVG must not win' },
  { text: 'other-svg-label', fails: false, why: 'a filled shape in a DIFFERENT SVG must never win' },
  { text: 'scaled-beside', fails: false, why: 'under a 10x viewBox, the glyph is beside the shape in USER space' },
  { text: 'scaled-on-shape', fails: true, why: 'under the same 10x viewBox the glyph IS over the shape — 1.37:1 on forest' },
  { text: 'over-invisible', fails: false, why: 'fill-opacity:0 paints nothing, so it is not a ground' },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
await page.setContent(FIXTURE, { waitUntil: 'load' });
const scan = await page.evaluate(SCAN, { vw: 900, isMobile: false });
await browser.close();

const found = (list, text) => list.find((x) => (x.text || '').includes(text));

let bad = 0;
console.log('surface-scanner SVG controls\n');
for (const c of CASES) {
  const hitFail = found(scan.contrast, c.text);
  const hitSkip = found(scan.skipped || [], c.text);
  let ok;
  let got;
  if (c.unmeasurable) {
    ok = !!hitSkip && hitSkip.reason === c.unmeasurable && !hitFail;
    got = hitSkip ? `unmeasurable:${hitSkip.reason}` : hitFail ? `reported ${hitFail.ratio}:1` : 'nothing';
  } else if (c.fails) {
    ok = !!hitFail && !hitSkip;
    got = hitFail ? `${hitFail.ratio}:1 (${hitFail.paintedBy}) on ${hitFail.bg}` : hitSkip ? `unmeasurable:${hitSkip.reason}` : 'nothing';
  } else {
    ok = !hitFail && !hitSkip;
    got = hitFail ? `${hitFail.ratio}:1 (${hitFail.paintedBy}) on ${hitFail.bg}` : hitSkip ? `unmeasurable:${hitSkip.reason}` : 'clean';
  }
  if (!ok) bad += 1;
  const want = c.unmeasurable ? `unmeasurable:${c.unmeasurable}` : c.fails ? 'reported as failing' : 'clean';
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.text.padEnd(20)} want ${want.padEnd(34)} got ${got}`);
  console.log(`      ${c.why}`);
}

console.log(`\ncontrast findings: ${scan.contrast.length} | unmeasurable: ${(scan.skipped || []).length}`);
if (bad) {
  console.error(`\n${bad} control(s) behaved differently from their declaration — the scanner is misreporting.`);
  process.exit(1);
}
console.log('\nall controls behaved as declared.');
