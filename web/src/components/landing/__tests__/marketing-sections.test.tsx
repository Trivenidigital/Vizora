import { render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

import WorkspaceSection from '../WorkspaceSection';

/**
 * Invariants for the marketing surface that are NOT page behaviour.
 *
 * These are deliberately not snapshot tests. Each one pins a rule that was
 * broken at some point and would break silently again:
 *   - fabricated customer claims must not exist anywhere in the web source,
 *   - the product shot must be the real capture at its real dimensions, not a
 *     CSS reconstruction or a guessed `sizes`,
 *   - the "Little Worlds" rebrand must stay inside its own `.lw` token block:
 *     `.mkt` is shared with the legal pages and the auth layout, so recolouring
 *     it would restyle surfaces this work never looked at.
 */

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, sizes, width, height }: Record<string, unknown>) => (
    <img src={String(src)} alt={String(alt)} data-sizes={String(sizes)} width={Number(width)} height={Number(height)} />
  ),
}));

const SRC_ROOT = path.join(__dirname, '..', '..', '..');
const GLOBALS_CSS = path.join(SRC_ROOT, 'app', 'globals.css');
const PRODUCT_PNG = path.join(SRC_ROOT, '..', 'public', 'product', 'dashboard-fleet.png');

/** The body of a top-level `<selector> { ... }` rule in globals.css. */
const cssBlock = (css: string, selector: string) => {
  const start = css.indexOf(`\n${selector} {`);
  expect(start).toBeGreaterThan(-1);
  const end = css.indexOf('\n}', start);
  expect(end).toBeGreaterThan(start);
  return css.slice(start, end);
};

describe('fabricated customer claims are gone from the source', () => {
  it('appear in no file under web/src', () => {
    // These shipped in a TestimonialsSection that was deleted with the
    // redesign. Every one is a claim — an invented name, an employer, or a
    // rating — so the expectation is zero hits anywhere, with no file allowed
    // to carry them. `__tests__` is skipped because this list is itself the
    // strings; it is the only exclusion.
    const CLAIMS = [
      'Sarah Chen',
      'Marcus Williams',
      'James Park',
      'Atlas Retail',
      'Meridian Health',
      '4.9/5',
      '200+ reviews',
    ];

    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === '__tests__' || e.name === 'node_modules') continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(e.name)) {
          const body = fs.readFileSync(full, 'utf8');
          if (CLAIMS.some((c) => body.includes(c))) offenders.push(path.relative(SRC_ROOT, full));
        }
      }
    };
    walk(SRC_ROOT);

    expect(offenders).toEqual([]);
  });
});

describe('the workspace section ships the real product shot', () => {
  it('renders the captured image, not a CSS reconstruction', () => {
    render(<WorkspaceSection />);
    const img = screen.getByRole('img', { name: /devices view/i });
    expect(img).toHaveAttribute('src', '/product/dashboard-fleet.png');
  });

  it('declares the real intrinsic dimensions of the asset on disk', () => {
    const png = fs.readFileSync(PRODUCT_PNG);
    // PNG IHDR: width/height are big-endian uint32 at byte offsets 16 and 20.
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);

    render(<WorkspaceSection />);
    const img = screen.getByRole('img', { name: /devices view/i });
    expect(Number(img.getAttribute('width'))).toBe(width);
    expect(Number(img.getAttribute('height'))).toBe(height);
  });

  it('caption states the data is synthetic, so it cannot read as a production claim', () => {
    render(<WorkspaceSection />);
    expect(screen.getByText(/demo workspace, synthetic data/i)).toBeInTheDocument();
  });

  it('sizes reflects the real column cap, not a naive vw guess', () => {
    render(<WorkspaceSection />);
    const img = screen.getByRole('img', { name: /devices view/i });
    expect(img.getAttribute('data-sizes')).toContain('560px');
  });
});

describe('token scopes stay separated', () => {
  it('keeps the reduced-motion reveal override scoped to .mkt', () => {
    const css = fs.readFileSync(GLOBALS_CSS, 'utf8');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.mkt \.eh-reveal/);
    expect(css).toMatch(/\.mkt \.eh-reveal \{[^}]*transition: none !important/);
  });

  it('leaves the shared .mkt palette on its original cool ink', () => {
    const css = fs.readFileSync(GLOBALS_CSS, 'utf8');
    // `.mkt` is still applied to the legal pages and the auth layout. The
    // rebrand adds `.lw` alongside it rather than recolouring it, so this ink
    // must survive verbatim inside the `.mkt` block itself.
    expect(cssBlock(css, '.mkt')).toContain('--mkt-ink: #0A222E');
  });

  it('defines the Little Worlds palette in its own .lw block', () => {
    const css = fs.readFileSync(GLOBALS_CSS, 'utf8');
    const lw = cssBlock(css, '.lw');
    expect(lw).toContain('--lw-forest: #1f4230');
    // and the warm palette is not smuggled into the shared scope
    expect(cssBlock(css, '.mkt')).not.toContain('--lw-forest');
  });
});
