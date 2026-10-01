import { Fraunces } from 'next/font/google';

/**
 * Editorial display serif for the marketing homepage only (Little Worlds
 * direction). Defined here rather than in the root layout so the font is
 * bundled only where the landing surface imports it — the dashboard and auth
 * screens keep their existing Sora/DM Sans stack untouched.
 */
export const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  // Without declaring the extra axes, next/font serves a wght-only instance
  // and the `font-variation-settings` for opsz/SOFT in globals.css are inert.
  axes: ['SOFT', 'opsz'],
});
