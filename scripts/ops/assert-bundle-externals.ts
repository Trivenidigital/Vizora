/**
 * CI gate, run after `nx build` of each NestJS service (middleware, realtime):
 * fails if the bundle inlines class-transformer / class-validator instead of
 * require()ing them. See lib/bundle-externals.ts for why a bundled copy
 * silently disables DTO transforms in production.
 *
 *   npx tsx scripts/ops/assert-bundle-externals.ts <path/to/dist/main.js>
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkBundleExternals } from './lib/bundle-externals';

const bundleArg = process.argv[2];
if (!bundleArg) {
  console.error('usage: assert-bundle-externals.ts <path/to/dist/main.js>');
  process.exit(2);
}
const bundlePath = resolve(bundleArg);
const verdict = checkBundleExternals(readFileSync(bundlePath, 'utf8'));

if (!verdict.ok) {
  console.error(`FAIL ${bundlePath}`);
  if (verdict.bundled.length) console.error(`  inlined into the bundle: ${verdict.bundled.join(', ')}`);
  if (verdict.notRequired.length) console.error(`  never require()d: ${verdict.notRequired.join(', ')}`);
  console.error("  Fix that service's webpack.config.js externals (and keep mergeExternals: true).");
  process.exit(1);
}
console.log(`OK ${bundlePath}: class-transformer and class-validator are external`);
