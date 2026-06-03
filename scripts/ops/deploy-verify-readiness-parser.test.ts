import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const parserPath = join(repoRoot, 'scripts', 'ops', 'readiness-status-parser.mjs');

function parseReadinessBody(body: string): string {
  const result = spawnSync(process.execPath, [parserPath], {
    encoding: 'utf8',
    input: body,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  return result.stdout.trim();
}

test('deploy verifier readiness parser unwraps enveloped readiness status', () => {
  assert.equal(
    parseReadinessBody(JSON.stringify({ success: true, data: { status: 'ok' } })),
    'ok',
  );
  assert.equal(
    parseReadinessBody(
      JSON.stringify({ success: true, data: { status: 'degraded' } }),
    ),
    'degraded',
  );
  assert.equal(
    parseReadinessBody(
      JSON.stringify({ success: true, data: { status: 'unhealthy' } }),
    ),
    'unhealthy',
  );
});

test('deploy verifier readiness parser preserves bare readiness status', () => {
  assert.equal(parseReadinessBody(JSON.stringify({ status: 'ok' })), 'ok');
  assert.equal(
    parseReadinessBody(JSON.stringify({ status: 'degraded' })),
    'degraded',
  );
  assert.equal(
    parseReadinessBody(JSON.stringify({ status: 'unhealthy' })),
    'unhealthy',
  );
});

test('deploy verifier readiness parser fails closed on malformed or unknown bodies', () => {
  assert.equal(parseReadinessBody(''), 'unknown');
  assert.equal(parseReadinessBody('<html>bad gateway</html>'), 'invalid');
  assert.equal(parseReadinessBody(JSON.stringify({ success: false })), 'unknown');
  assert.equal(
    parseReadinessBody(JSON.stringify({ success: true, data: { status: 'slow' } })),
    'unknown',
  );
});
