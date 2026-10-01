/**
 * The in-page surface scanner, as its OWN module.
 *
 * It used to live inside `audit-surface.mjs`, which throws on import unless
 * `DEMO_TENANT_PASSWORD` is set and refuses a non-local target — correct guards for
 * something that logs in, but they also made the scanner unreachable from any other
 * harness, so the instrument the Phase 5 contrast claim rests on could not be tested
 * against a fixture. It is extracted verbatim and then fixed; `audit-surface.mjs`
 * imports it and is otherwise unchanged, and the login guards stay exactly where
 * they were.
 *
 * The function is SERIALISED into the browser by `page.evaluate`, so it must close
 * over nothing from module scope. Every helper lives inside it, deliberately.
 *
 * ── Why this file exists at all: the audit was measuring the wrong property ──
 * `const fg = parse(cs.color)` is right for HTML and WRONG for SVG, where `fill`
 * paints the glyph and `color` is usually just whatever was inherited. Observed on
 * a real page after the B16 pie-label fix:
 *
 *   <text class="recharts-text recharts-pie-label-text" fill="#10B981"
 *                                          computedFill: rgb(35, 38, 31)
 *   <tspan>                    fill=null   computedFill: rgb(35, 38, 31)
 *
 * The `fill` ATTRIBUTE still carries the slice colour because recharts writes it and
 * nothing removes it; the author CSS declaration outranks it, so the glyph is
 * actually painted `--foreground`. Reading `color` reported a failure nobody could
 * see. The same bug runs the other way too, and that direction is worse: an SVG text
 * run that is genuinely unreadable will PASS as long as it inherits a `color` that
 * happens to clear AA. A harness that is wrong in both directions is worse than no
 * harness.
 */

/**
 * Contrast + clipping + touch-target scan.
 *
 * Runs entirely in the page so it reads *computed* values off live nodes,
 * which is the only thing that proves an element actually receives a rule.
 */
export const SCAN = ({ vw, isMobile }) => {
  /* --- colour helpers --- */
  const parse = (c) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[,/]/).map((x) => parseFloat(x.trim()));
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  /**
   * Porter-Duff "source over", carrying a real result alpha.
   *
   * Returning a hardcoded `a: 1` would be correct only when the backdrop is
   * already opaque. `effectiveBg` walks outward through possibly-translucent
   * layers and stops once the accumulated alpha is opaque — with a fixed 1 it
   * would stop after the FIRST translucent layer and report a colour composited
   * against nothing, silently mis-measuring contrast on any tinted overlay
   * (`bg-[var(--primary)]/10`, the sidebar active wash, modal scrims).
   */
  const over = (fg, bg) => {
    const a = fg.a + bg.a * (1 - fg.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
      g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
      b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
      a,
    };
  };

  const label = (el) => {
    const cls = typeof el.className === 'string' ? el.className : (el.className?.baseVal ?? '');
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls ? '.' + cls.trim().split(/\s+/).slice(0, 4).join('.') : ''}`.slice(0, 140);
  };

  const visible = (el, cs, rect) => {
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') return false;
    if (rect.width === 0 || rect.height === 0) return false;
    return true;
  };

  /** Nearest ancestor painting an opaque-ish background; also reports image backdrops. */
  const effectiveBg = (el) => {
    let node = el;
    let acc = null;
    while (node && node !== document.documentElement.parentElement) {
      const cs = getComputedStyle(node);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return { color: null, indeterminate: true };
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) {
        acc = acc ? over(acc, c) : c;
        if (acc.a >= 0.999) return { color: acc, indeterminate: false };
      }
      node = node.parentElement;
    }
    // Ran out of ancestors while still translucent: whatever we accumulated is
    // really sitting on the canvas, so composite it over white rather than
    // discarding it and assuming plain white.
    const canvas = { r: 255, g: 255, b: 255, a: 1 };
    return { color: acc ? over(acc, canvas) : canvas, indeterminate: false };
  };

  const isSvg = (node) => typeof SVGElement !== 'undefined' && node instanceof SVGElement;

  /** `fill` and `fill-opacity` into one alpha-carrying colour, or a skip reason. */
  const paintColor = (raw, cs) => {
    const v = String(raw || '').trim();
    if (!v || v === 'none') return { skip: 'fill-none' };
    if (/^url\(/i.test(v)) return { skip: 'fill-paint-server' };
    const c = parse(/^currentcolor$/i.test(v) ? cs.color : v);
    if (!c) return { skip: 'fill-unparsable' };
    const fo = parseFloat(cs.fillOpacity);
    const a = Number.isFinite(fo) ? c.a * Math.max(0, Math.min(1, fo)) : c.a;
    return { color: { ...c, a } };
  };

  /**
   * WHICH PROPERTY PAINTS THIS TEXT.
   *
   * HTML text is painted by `color`; SVG text is painted by `fill`. `currentColor`
   * resolves back to `color`, and a `url(...)` paint server or `fill: none` is not a
   * flat colour at all — those are SKIPPED with a reason rather than guessed at,
   * because a number invented here is indistinguishable from a measured one.
   */
  const textPaint = (el, cs) => {
    if (!isSvg(el)) {
      const c = parse(cs.color);
      return c ? { color: c } : { skip: 'color-unparsable' };
    }
    const out = paintColor(cs.fill, cs);
    return out.skip ? { skip: `svg-${out.skip}` } : out;
  };

  /**
   * WHAT GROUND AN SVG TEXT RUN IS MEASURED AGAINST.
   *
   * SVG elements do not paint CSS backgrounds, so the HTML `effectiveBg` walk skips
   * every `<g>`/`<svg>` ancestor as transparent and lands on the nearest HTML
   * ancestor. For a label in empty chart space that IS the honest answer, and it is
   * the recharts pie-label case: `Pie.renderLabels` places labels at
   * `outerRadius + 20`, outside every sector, so the card really is behind them.
   *
   * But a label can also sit ON a filled shape — a bar label, a donut centre — and
   * then the card is the wrong ground and measuring against it can PASS a label
   * nobody can read. So ask the geometry rather than assuming either way.
   *
   * `isPointInFill` tests a shape's real painted area, and it is the right primitive
   * here for two reasons: a bounding box would wrongly claim a pie sector contains
   * a label 20px outside it (a sector's bbox is huge), and hit testing via
   * `elementsFromPoint` would MISS shapes, because recharts sets `pointer-events` on
   * chart layers. Document order breaks ties, so the shape painted last wins.
   */
  const svgGround = (el, rect) => {
    const svg = el.ownerSVGElement || (isSvg(el) && el.tagName.toLowerCase() === 'svg' ? el : null);
    if (!svg) return { useHtml: true };

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const toUserSpace = (shape) => {
      const ctm = typeof shape.getScreenCTM === 'function' ? shape.getScreenCTM() : null;
      if (!ctm) return null;
      try {
        if (typeof DOMPoint === 'function') return new DOMPoint(cx, cy).matrixTransform(ctm.inverse());
        const p = svg.createSVGPoint();
        p.x = cx;
        p.y = cy;
        return p.matrixTransform(ctm.inverse());
      } catch {
        return null;
      }
    };

    let hit = null;
    for (const shape of svg.querySelectorAll('path, rect, circle, ellipse, polygon, polyline')) {
      if (typeof shape.isPointInFill !== 'function') continue;
      const scs = getComputedStyle(shape);
      const raw = String(scs.fill || '').trim();
      if (!raw || raw === 'none') continue;
      if (scs.visibility === 'hidden' || scs.display === 'none' || scs.opacity === '0') continue;
      const pt = toUserSpace(shape);
      if (!pt) continue;
      let inside = false;
      try {
        inside = shape.isPointInFill(pt);
      } catch {
        continue;
      }
      if (inside) hit = { shape, raw, scs };
    }
    if (!hit) return { useHtml: true };

    const paint = paintColor(hit.raw, hit.scs);
    if (paint.skip) return { skip: `svg-ground-${paint.skip}` };
    return { shape: hit.shape, fill: paint.color };
  };

  const clipped = [];
  const contrast = [];
  const touch = [];
  /*
   * Text runs whose paint is not a flat colour (`fill: none`, a gradient or pattern
   * paint server, an unparsable value). Reported rather than dropped: "absent from
   * the findings" must not be ambiguous between measured-and-passing and
   * never-measured.
   */
  const skipped = [];
  const seenText = new Set();

  const all = document.querySelectorAll('body *');
  for (const el of all) {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (!visible(el, cs, rect)) continue;

    /* --- clipping: real geometry, immune to overflow-x:hidden (trap 7) ---
     *
     * Extending past the viewport is NOT by itself a defect: a wide table
     * inside an `overflow-x: auto` scroller is perfectly reachable, and its
     * getBoundingClientRect() still reports the full width. Reporting on
     * geometry alone flags every legitimate scroller as broken.
     *
     * So walk up and find the first ancestor that governs horizontal overflow:
     *   auto/scroll that can actually scroll -> reachable, not a finding
     *   hidden/clip                          -> genuinely unreachable content
     *   nothing all the way up               -> depends on the document
     */
    if (rect.right > vw + 1 && rect.left < vw) {
      let node = el.parentElement;
      let verdict = null;
      while (node) {
        const pcs = getComputedStyle(node);
        const ox = pcs.overflowX;
        if (ox === 'auto' || ox === 'scroll') {
          verdict = node.scrollWidth > node.clientWidth + 1 ? null : `unscrollable:${label(node)}`;
          break;
        }
        if (ox === 'hidden' || ox === 'clip') {
          verdict = `hidden-by:${label(node)}`;
          break;
        }
        node = node.parentElement;
      }
      if (node === null) {
        const de = document.documentElement;
        verdict = de.scrollWidth > de.clientWidth + 1 ? null : 'hidden-by:document';
      }
      if (verdict) {
        clipped.push({ el: label(el), right: Math.round(rect.right), overBy: Math.round(rect.right - vw), cause: verdict });
      }
    }

    /* --- touch targets on mobile --- */
    if (isMobile) {
      const interactive =
        ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) ||
        el.getAttribute('role') === 'button' ||
        el.getAttribute('role') === 'link';
      /*
       * Skip-links and other sr-only affordances are deliberately collapsed
       * (1x1, clipped) until focused. Counting them as undersized targets
       * reports a defect for doing accessibility correctly.
       */
      const srOnly =
        rect.width <= 1 &&
        rect.height <= 1 &&
        (cs.position === 'absolute' || cs.clip !== 'auto' || cs.overflow === 'hidden');
      if (interactive && !srOnly && (rect.width < 44 || rect.height < 44)) {
        touch.push({ el: label(el), w: Math.round(rect.width), h: Math.round(rect.height) });
      }
    }

    /* --- contrast: only elements with their own rendered text --- */
    const own = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim();
    if (!own || own.length < 2) continue;

    const paint = textPaint(el, cs);
    if (paint.skip) {
      skipped.push({ el: label(el), text: own.slice(0, 40), reason: paint.skip });
      continue;
    }
    const fg = paint.color;
    if (!fg || fg.a === 0) continue;

    /*
     * The ground. For SVG the shape under the glyph wins when there is one; a
     * translucent shape fill is composited over whatever HTML is behind the <svg>,
     * the same way `effectiveBg` composites translucent HTML layers.
     */
    let ground = null;
    if (isSvg(el)) {
      const g = svgGround(el, rect);
      if (g.skip) {
        skipped.push({ el: label(el), text: own.slice(0, 40), reason: g.skip });
        continue;
      }
      if (g.fill) {
        const beneath = effectiveBg(g.shape);
        if (beneath.indeterminate || !beneath.color) {
          skipped.push({ el: label(el), text: own.slice(0, 40), reason: 'svg-ground-indeterminate' });
          continue;
        }
        ground = g.fill.a >= 0.999 ? g.fill : over(g.fill, beneath.color);
      }
    }
    if (!ground) {
      const bg = effectiveBg(el);
      if (bg.indeterminate || !bg.color) continue;
      ground = bg.color;
    }
    const bg = { color: ground };

    const composited = fg.a < 1 ? over(fg, bg.color) : fg;
    const r = ratio(composited, bg.color);
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const required = large ? 3 : 4.5;

    if (r < required) {
      const paintStr = `rgba(${Math.round(fg.r)}, ${Math.round(fg.g)}, ${Math.round(fg.b)}, ${fg.a})`;
      const key = `${paintStr}|${cs.fontSize}|${own.slice(0, 24)}`;
      if (seenText.has(key)) continue;
      seenText.add(key);
      contrast.push({
        el: label(el),
        text: own.slice(0, 60),
        color: paintStr,
        paintedBy: isSvg(el) ? 'fill' : 'color',
        bg: `rgb(${Math.round(bg.color.r)}, ${Math.round(bg.color.g)}, ${Math.round(bg.color.b)})`,
        fontSize: cs.fontSize,
        weight,
        ratio: Math.round(r * 100) / 100,
        required,
      });
    }
  }

  /* --- focus indicator ---
   *
   * Focus rings are not text, so the contrast pass above never sees them, and a
   * ring bound to a FILL token can silently fall to 1.4:1 while every text run
   * on the page still passes. WCAG 2.1 SC 1.4.11 wants >= 3:1 for non-text UI.
   *
   * `getPropertyValue` returns the *declared* value (`var(--primary-ink)`), so
   * resolve it by letting the engine compute it on a throwaway element.
   */
  const focusRing = (() => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--focus-ring-color)';
    probe.style.position = 'absolute';
    probe.style.opacity = '0';
    /*
     * Mount the probe INSIDE the scope the content lives in, not on <body>.
     * Custom properties cascade, so a probe on <body> resolves the root-scope
     * value while the real controls inside a scoped wrapper (`.mkt`) resolve a
     * different one. Measuring from the wrong place reported a 1.65:1 focus
     * ring on the auth pages that no focusable element there actually has.
     */
    const scope = document.querySelector('.mkt') || document.body;
    scope.appendChild(probe);
    const resolved = parse(getComputedStyle(probe).color);
    probe.remove();
    if (!resolved) return null;

    const surfaces = [
      ['scope', parse(getComputedStyle(scope).backgroundColor)],
      ['body', parse(getComputedStyle(document.body).backgroundColor)],
      ['card', (() => {
        const card = document.querySelector('.eh-dash-card, [class*="surface"]');
        return card ? parse(getComputedStyle(card).backgroundColor) : null;
      })()],
    ];
    const worst = surfaces
      .filter(([, c]) => c && c.a > 0)
      .map(([where, c]) => ({ where, ratio: Math.round(ratio(resolved, c) * 100) / 100 }))
      .sort((a, b) => a.ratio - b.ratio)[0];
    if (!worst) return null;
    return { color: getComputedStyle(document.documentElement).getPropertyValue('--focus-ring-color').trim(), ...worst, passes: worst.ratio >= 3 };
  })();

  return {
    focusRing,
    skipped: skipped.slice(0, 30),
    docScrollWidth: document.documentElement.scrollWidth,
    docClientWidth: document.documentElement.clientWidth,
    clipped: clipped.slice(0, 30),
    contrast: contrast.sort((a, b) => a.ratio - b.ratio).slice(0, 40),
    touch: touch.slice(0, 30),
  };
};
