import { render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

import DemoVideoSection from '../DemoVideoSection';
import FeatureShowcasesSection from '../FeatureShowcasesSection';

/**
 * Invariants for the light `.mkt` marketing surface.
 *
 * These are deliberately NOT snapshot tests. Each one pins a rule that was
 * broken at some point and would break silently again:
 *   - fabricated customer claims must not render anywhere,
 *   - the product shot must be the real capture, not a CSS reconstruction,
 *   - the restyled sections must not carry dark-theme colour literals,
 *   - neon #00E5A0 must never be used as text or as a border on this substrate
 *     (1.65:1 on white — fills and glows only).
 */
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, sizes, width, height }: Record<string, unknown>) => (
    <img src={String(src)} alt={String(alt)} data-sizes={String(sizes)} width={Number(width)} height={Number(height)} />
  ),
}));

const SRC = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

/** Dark-theme inks that must not survive in a `.mkt` component. */
const DARK_INKS = ['#F0ECE8', '#D1CBC5', '#B5AEA6', '#9A958E', '#6B655D', 'rgba(240,236,232'];

describe('TestimonialsSection is not published', () => {
  it('is mounted nowhere in the app', () => {
    const appDir = path.join(__dirname, '..', '..', '..', 'app');
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(e.name) && /<TestimonialsSection\b/.test(fs.readFileSync(full, 'utf8'))) {
          hits.push(full);
        }
      }
    };
    walk(appDir);
    expect(hits).toEqual([]);
  });

  it('carries the DO-NOT-MOUNT warning naming its unverified claims', () => {
    const src = SRC('TestimonialsSection.tsx');
    expect(src).toMatch(/DO NOT MOUNT/i);
    expect(src).toMatch(/4\.9\/5/);
    expect(src).toMatch(/200\+ reviews/);
  });

  it('its invented customer claims render nowhere else in the app', () => {
    // "Urban Eats" is deliberately NOT in this list, and the omission is not an
    // oversight: it also appears in HowItWorksSection as decorative signage on
    // an aria-hidden mock menu board. That usage predates this work, makes no
    // customer claim, and is not what this test guards. Everything below is a
    // claim — a name, an employer, or a rating — and must stay unpublished.
    const CLAIMS = [
      '4.9/5',
      '200+ reviews',
      'Sarah Chen',
      'Marcus Williams',
      'James Park',
      'Atlas Retail',
      'Meridian Health',
    ];
    const root = path.join(__dirname, '..', '..', '..');
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === '__tests__' || e.name === 'node_modules') continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(e.name) && !full.endsWith('TestimonialsSection.tsx')) {
          const body = fs.readFileSync(full, 'utf8');
          if (CLAIMS.some(c => body.includes(c))) offenders.push(path.basename(full));
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});

describe('DemoVideoSection light substrate', () => {
  it('renders its copy and poster', () => {
    const { container } = render(<DemoVideoSection />);
    expect(screen.getByText(/See Vizora In Action/i)).toBeInTheDocument();
    expect(container.querySelector('video')).toHaveAttribute('poster', '/videos/vizora-demo-poster.jpg');
  });

  it('carries no dark-theme colour literals', () => {
    const src = SRC('DemoVideoSection.tsx');
    for (const ink of DARK_INKS) expect(src).not.toContain(ink);
  });

  it('never uses neon as text or as a border colour', () => {
    const src = SRC('DemoVideoSection.tsx');
    expect(src).not.toMatch(/color:\s*['"]#00E5A0/i);
    expect(src).not.toMatch(/border:\s*['"][^'"]*#00E5A0/i);
    // it may still appear inside translucent tints/glows
    expect(src).toMatch(/rgba\(0,229,160/);
  });
});

describe('FeatureShowcases renders the real product shot', () => {
  const props = { activeFeatureTab: 'realtime' };

  it('renders the captured image, not a CSS reconstruction', () => {
    render(<FeatureShowcasesSection {...props} />);
    const img = screen.getByRole('img', { name: /devices view/i });
    expect(img).toHaveAttribute('src', '/product/dashboard-fleet.png');
  });

  it('declares the real intrinsic dimensions of the asset on disk', () => {
    const png = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', '..', 'public', 'product', 'dashboard-fleet.png'),
    );
    // PNG IHDR: width/height are big-endian uint32 at byte offsets 16 and 20.
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    render(<FeatureShowcasesSection {...props} />);
    const img = screen.getByRole('img', { name: /devices view/i });
    expect(Number(img.getAttribute('width'))).toBe(width);
    expect(Number(img.getAttribute('height'))).toBe(height);
  });

  it('caption states the data is synthetic, so it cannot read as a production claim', () => {
    render(<FeatureShowcasesSection {...props} />);
    expect(screen.getByText(/demo workspace, synthetic data/i)).toBeInTheDocument();
  });

  it('the fabricated fleet rows it replaced are gone', () => {
    const src = SRC('FeatureShowcasesSection.tsx');
    for (const invented of ['Times Square', 'Beverly Hills', 'Michigan Ave', 'Ocean Drive', 'Pike Place']) {
      expect(src).not.toContain(invented);
    }
  });

  it('sizes reflects the real 544px column cap, not a naive vw guess', () => {
    render(<FeatureShowcasesSection {...props} />);
    const img = screen.getByRole('img', { name: /devices view/i });
    expect(img.getAttribute('data-sizes')).toContain('544px');
  });
});
