/**
 * CI gate, run after `nx build @vizora/middleware`: fails if the bundle inlines
 * class-transformer / class-validator instead of require()ing them. See
 * lib/bundle-externals.ts for why a bundled copy silently disables DTO
 * transforms in production.
 *
 *   npx tsx scripts/ops/assert-middleware-bundle-externals.ts [path/to/main.js]
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkBundleExternals } from './lib/bundle-externals';

const bundlePath = resolve(process.argv[2] ?? 'middleware/dist/main.js');
const verdict = checkBundleExternals(readFileSync(bundlePath, 'utf8'));

if (!verdict.ok) {
  console.error(`FAIL ${bundlePath}`);
  if (verdict.bundled.length) console.error(`  inlined into the bundle: ${verdict.bundled.join(', ')}`);
  if (verdict.notRequired.length) console.error(`  never require()d: ${verdict.notRequired.join(', ')}`);
  console.error('  Fix middleware/webpack.config.js externals (and keep mergeExternals: true).');
  process.exit(1);
}
console.log(`OK ${bundlePath}: class-transformer and class-validator are external`);
