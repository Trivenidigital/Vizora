import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { render } from '@testing-library/react';

import { PieChart } from '../PieChart';

/**
 * The pie labels are re-inked by CSS, and this guards the two halves of that.
 *
 * recharts builds a pie label by spreading the SECTOR's props onto its `<Text>`, so
 * the label is painted in the slice's own `fill` — and `Pie.renderLabels` places it
 * at `outerRadius + 20`, i.e. OUTSIDE the pie, on the card. A fill was being used
 * as text against a ground it had never been measured against: on `--surface` the
 * five colours `AnalyticsService.getDeviceDistribution` sends measured 2.08:1 to
 * 4.67:1, and only `offline` cleared AA — by 0.17.
 *
 * The fix has to be CSS. recharts sets `fill` on `<text>` as a presentation
 * ATTRIBUTE, which any author declaration outranks, and `fill: var(--token)`
 * resolves in a declaration where it cannot in an attribute. So the wrapper carries
 * `[&_.recharts-pie-label-text]:fill-[var(--foreground)]`.
 *
 * ── WHAT THIS FILE DOES NOT PROVE ────────────────────────────────────────────
 * It does not prove the labels come out at 14.83:1. jsdom does no SVG colour
 * cascade, and recharts gates `renderLabels` behind `isAnimationFinished`, which
 * only flips when the entry animation ends — so in jsdom the label nodes never
 * render at all, and any assertion about them would pass or fail for reasons that
 * have nothing to do with colour. Asserting "no label nodes found" here would be a
 * control whose input could never fail. The ratio is measured by
 * `scripts/design/contrast.mjs` and by the surface audit against a real browser.
 *
 * What CAN rot silently is the join between the two halves: the selector names a
 * recharts-internal class, and an upgrade that renamed it would return the chart to
 * slice-coloured labels with every test still green. So both sides are checked
 * against ONE constant.
 */

/*
 * Both of these are WHOLE LITERALS, and must stay that way.
 *
 * Building the arbitrary-variant utility by interpolating the class-name constant
 * into a template literal BROKE THE PRODUCTION STYLESHEET. Tailwind's `content`
 * globs cover `src/components/**` with no test exclusion, and its scanner is
 * TEXTUAL: it took the candidate with the dollar-brace still inside it and emitted
 * a selector containing a bare `$`, which fails CSS parsing and takes the whole of
 * `globals.css` with it. Every jest suite stayed green; only `next build` caught
 * it. Twice, in fact — the comment that first explained this quoted the broken
 * form verbatim and so re-created it, because comments are scanned too.
 *
 * So: no interpolation, and no prose that reproduces a bracketed candidate. The
 * two constants are tied by an assertion below instead.
 */
const PIE_LABEL_INK_CLASS = '[&_.recharts-pie-label-text]:fill-[var(--foreground)]';
const RECHARTS_PIE_LABEL_CLASS = 'recharts-pie-label-text';

jest.mock('@/lib/hooks/useTheme', () => ({
  useTheme: () => ({ isDark: false }),
}));

const data = [
  { name: 'Online', value: 5, color: '#10B981' },
  { name: 'Offline', value: 3, color: '#6B7280' },
  { name: 'Error', value: 1, color: '#EF4444' },
];

describe('PieChart label ink', () => {
  it('puts the re-inking rule on the wrapper', () => {
    const { container } = render(<PieChart data={data} height={300} showLabel />);
    const wrapper = container.firstElementChild as HTMLElement;

    expect(wrapper.className).toContain(PIE_LABEL_INK_CLASS);
  });

  /** Ties the two literals together, so renaming one without the other fails. */
  it('targets the recharts class in the utility it emits', () => {
    expect(PIE_LABEL_INK_CLASS).toContain(RECHARTS_PIE_LABEL_CLASS);
  });

  /*
   * The half that can rot. If recharts renames this class, the rule above stops
   * matching and the labels silently go back to being painted in the slice colour.
   * Read from the INSTALLED package, so an upgrade is what fails the test.
   */
  it('still matches the class the installed recharts emits for pie labels', () => {
    const pkg = require.resolve('recharts/package.json');
    const source = readFileSync(join(dirname(pkg), 'lib', 'polar', 'Pie.js'), 'utf8');

    // Guard against the read itself succeeding on nothing — a 0-byte or wrong file
    // would otherwise make the assertion below vacuous.
    expect(source.length).toBeGreaterThan(10_000);
    expect(source).toContain('renderLabelItem');
    expect(source).toContain(RECHARTS_PIE_LABEL_CLASS);
  });
});
