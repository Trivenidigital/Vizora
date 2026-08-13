/**
 * PM2 log configuration invariants.
 *
 * Two properties that other code depends on and that nothing else enforces:
 *
 *   1. No app declares `max_size`. PM2 6.0.14's app schema
 *      (lib/API/schema.json) has no such option — it is a pm2-logrotate MODULE
 *      setting, and that module is not installed on prod. Declaring it made
 *      every app assert a log bound that did not exist.
 *
 *   2. Every app writes both streams into ./logs/. `lib/log-retention.ts`
 *      bounds log size by scanning exactly that one directory, so an app
 *      logging anywhere else would grow without any bound at all.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
const { apps } = require(join(repoRoot, 'ecosystem.config.js')) as {
  apps: Array<{ name: string; max_size?: string; out_file?: string; error_file?: string }>;
};

test('no app declares max_size — PM2 has no such option, so it is inert', () => {
  const declaring = apps.filter(a => a.max_size !== undefined).map(a => a.name);
  assert.deepEqual(declaring, [], 'max_size is a pm2-logrotate module setting, not a PM2 app option');
});

test('every app writes both log streams into ./logs/', () => {
  // log-retention scans this one directory. An app logging elsewhere is
  // unbounded, and its evidence is invisible to the retention report.
  const offenders: string[] = [];
  for (const app of apps) {
    for (const key of ['out_file', 'error_file'] as const) {
      const value = app[key];
      if (!value) offenders.push(`${app.name}: missing ${key}`);
      else if (!value.startsWith('./logs/')) offenders.push(`${app.name}: ${key}=${value}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('the app list is non-empty, so the checks above are not vacuous', () => {
  assert.ok(apps.length >= 18, `expected the full fleet, got ${apps.length}`);
});
