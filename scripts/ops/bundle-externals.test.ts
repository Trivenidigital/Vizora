import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkBundleExternals } from './lib/bundle-externals';

const BUNDLED_TRANSFORMER =
  ';// ../node_modules/.pnpm/class-transformer@0.5.1/node_modules/class-transformer/esm5/storage.js\n';

test('a bundle that require()s both packages passes', () => {
  const src = 'const a = require("class-transformer");\nconst b = require("class-validator");\n';
  assert.deepEqual(checkBundleExternals(src), { ok: true, bundled: [], notRequired: [] });
});

// The control that MUST fail: this is the exact shape of the Jan–Oct 2026 bundle.
test('an inlined class-transformer fails even when something also require()s it', () => {
  const src = `${BUNDLED_TRANSFORMER}require("class-transformer");require("class-validator");`;
  const verdict = checkBundleExternals(src);
  assert.equal(verdict.ok, false);
  assert.deepEqual(verdict.bundled, ['class-transformer']);
});

test('a bundle that never require()s the packages is not evidence of externals', () => {
  const verdict = checkBundleExternals('console.log("hello");');
  assert.equal(verdict.ok, false);
  assert.deepEqual(verdict.notRequired, ['class-transformer', 'class-validator']);
});
