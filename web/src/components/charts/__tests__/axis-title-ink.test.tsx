import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Every axis TITLE must carry its own `fill`, and this is a source scan because
 * nothing else can see it.
 *
 * recharts builds an axis title from the `label` prop: `<Label>` runs `filterProps`
 * over the object and spreads the survivors onto its own `<Text>`, and `Text`
 * substitutes its `DEFAULT_FILL` — a mid grey — for any `fill` that arrives
 * undefined. So an axis title with no `fill` is painted recharts' grey, which
 * measured 3.82:1 on the chart card and was under AA for 12px text on
 * /dashboard/analytics. Supplying `theme.colors.text` puts it at 14.83:1.
 *
 * The tick text is a DIFFERENT element inked a different way — `style={{ fill }}` on
 * the axis itself — so it was always correct and its correctness never implied the
 * title's. That is the whole trap: four of five wrappers looked inked and were not.
 *
 * ── WHAT THIS FILE DOES NOT PROVE ────────────────────────────────────────────
 * It does not prove a title renders at 14.83:1. `ResponsiveContainer` has no width
 * in jsdom, so recharts renders no cartesian chart at all, and any assertion about
 * axis-title nodes would pass or fail for reasons unrelated to colour — the same
 * control-whose-input-cannot-fail problem `pie-chart-labels.test.tsx` records. The
 * ratio comes from `scripts/design/contrast.mjs` and from the audit against a real
 * browser.
 *
 * What it DOES prove is the thing that rots: a sixth wrapper, or a third axis on an
 * existing one, added with a `label` and no `fill`. That is invisible to the colour
 * ratchet (no literal is involved — it is a MISSING prop) and invisible to every
 * other suite, which is exactly the shape that shipped this defect.
 */

const CHARTS_DIR = join(__dirname, '..');

/** Reads the wrapper sources. `__tests__` is a directory, so it is filtered out. */
function wrapperSources(): Array<{ file: string; source: string }> {
  return readdirSync(CHARTS_DIR)
    .filter((f) => f.endsWith('.tsx'))
    .map((file) => ({
      file,
      source: readFileSync(join(CHARTS_DIR, file), 'utf8'),
    }));
}

/**
 * Extracts each `label={ … }` prop body by BRACE MATCHING rather than by a regex.
 *
 * The first version of this used a regex with an indentation-shaped closing anchor
 * and matched exactly one of the eight objects — while the "every title has a fill"
 * assertion below still went green, because one object out of one had a fill. The
 * count assertion is what caught it. Brace matching has no such failure mode.
 *
 * Two conditions, and the second is not optional. The axis-title form is an OBJECT
 * with a `value:` property; recharts' other `label` shape is a render callback, which
 * PieChart passes. Anchoring on `value:` alone matched that callback too, because its
 * TypeScript annotation reads `({ value }: { value: number })` — the substring is
 * there without an object property being there. So a body containing `=>` is a
 * callback and is skipped: its text is inked by the CSS rule `PieChart` documents,
 * not by a prop.
 */
function axisTitleObjects(source: string): string[] {
  const out: string[] = [];
  const needle = 'label={';
  let from = 0;

  for (;;) {
    const start = source.indexOf(needle, from);
    if (start < 0) break;

    let depth = 0;
    let i = start + needle.length - 1; // sits on the opening brace
    for (; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }

    const body = source.slice(start + needle.length, i);
    const isObjectForm = body.includes('value:') && !body.includes('=>');
    if (isObjectForm) out.push(body);
    from = i > start ? i : start + needle.length;
  }

  return out;
}

describe('chart axis titles are inked', () => {
  it('finds every axis-title object, not just the first', () => {
    const found = wrapperSources().flatMap(({ source }) =>
      axisTitleObjects(source),
    );

    // Without this the suite would pass by matching nothing — or, as it did on the
    // first attempt, by matching one. Four wrappers carry two titled axes each.
    expect(found.length).toBe(8);
  });

  it('gives every axis title an explicit fill', () => {
    const offenders: string[] = [];

    for (const { file, source } of wrapperSources()) {
      for (const body of axisTitleObjects(source)) {
        if (!body.includes('fill:')) {
          offenders.push(
            `${file}: ${body.replace(/\s+/g, ' ').trim().slice(0, 70)}`,
          );
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  /** The matcher must be able to FAIL, or the assertion above means nothing. */
  it('would catch a label object that omits the fill', () => {
    const bad = [
      '          <YAxis',
      '            label={',
      '              yAxisLabel',
      "                ? { value: yAxisLabel, angle: -90, position: 'insideLeft' }",
      '                : undefined',
      '            }',
      '          />',
    ].join('\n');

    const bodies = axisTitleObjects(bad);
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).not.toContain('fill:');
  });

  /** And must not flag the shapes that legitimately carry no `value:`. */
  it('ignores a label prop that is a render function or false', () => {
    const notATitle = [
      '          <Pie',
      '            label={showLabel ? ({ value }: { value: number }) => `${value}%` : false}',
      '          />',
    ].join('\n');

    expect(axisTitleObjects(notATitle)).toEqual([]);
  });

  /*
   * The half that can rot underneath us. If recharts stopped substituting a default
   * for an absent fill — or renamed the mechanism — the reasoning above would need
   * re-checking. Read from the INSTALLED package so an upgrade is what fails.
   */
  it('still relies on a recharts Text default that actually exists', () => {
    const pkg = require.resolve('recharts/package.json');
    const source = readFileSync(
      join(dirname(pkg), 'lib', 'component', 'Text.js'),
      'utf8',
    );

    // Guard the read itself, so a wrong or empty file cannot make this vacuous.
    expect(source.length).toBeGreaterThan(5_000);
    expect(source).toContain('DEFAULT_FILL');
    // The substitution is what makes an absent fill a visible defect. The identifier
    // is minifier-generated, so match loosely on its shape rather than its name.
    expect(source).toMatch(/fill = [\w$]+ === void 0 \? DEFAULT_FILL/);
  });
});
