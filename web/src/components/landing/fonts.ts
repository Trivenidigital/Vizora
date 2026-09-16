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
});
