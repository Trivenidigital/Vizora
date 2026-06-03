import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

function readCiJobBlock(workflow: string, jobName: string): string {
  const match = workflow.match(
    new RegExp(`\\r?\\n  ${jobName}:\\r?\\n[\\s\\S]*?(?=\\r?\\n  [A-Za-z0-9_-]+:\\r?\\n|$)`),
  );

  assert.ok(match, `Expected CI job "${jobName}" to exist`);
  return match[0];
}

test('critical-path smoke probes the realtime gateway prefixed health endpoint', () => {
  const smokeScript = readRepoFile('scripts/smoke/api-critical-path.sh');

  assert.match(
    smokeScript,
    /probe_status "Realtime health" "200" "\$RT_BASE\/api\/health"/,
  );
  assert.doesNotMatch(smokeScript, /\$RT_BASE\/health"/);
});

test('first-customer runbook documents the realtime prefixed health endpoint', () => {
  const runbook = readRepoFile('docs/runbooks/first-customer-onboarding.md');

  assert.match(runbook, /http:\/\/localhost:3002\/api\/health/);
  assert.doesNotMatch(runbook, /localhost:3002\/health/);
});

test('realtime Docker healthcheck probes the prefixed health endpoint', () => {
  const dockerfile = readRepoFile('docker/Dockerfile.realtime');

  assert.match(dockerfile, /http:\/\/localhost:3002\/api\/health/);
  assert.doesNotMatch(dockerfile, /localhost:3002\/health['"]/);
});

test('health guardian probes realtime at the prefixed health endpoint', () => {
  const guardian = readRepoFile('scripts/ops/health-guardian.ts');

  assert.match(guardian, /healthUrl:\s*`\$\{realtimeUrl\}\/api\/health`/);
  assert.doesNotMatch(guardian, /healthUrl:\s*`\$\{realtimeUrl\}\/health`/);
});

test('health guardian resolves escalated service-down incidents after recovery', () => {
  const guardian = readRepoFile('scripts/ops/health-guardian.ts');

  assert.match(guardian, /existingIncident\.status !== 'resolved'/);
  assert.doesNotMatch(guardian, /existingIncident\.status === 'open'/);
});

test('CI test job runs web unit tests before build-only gates', () => {
  const ciWorkflow = readRepoFile('.github/workflows/ci.yml');
  const testJob = readCiJobBlock(ciWorkflow, 'test');

  assert.match(
    testJob,
    /- name: Run web unit tests\s+working-directory: web\s+run: pnpm test --runInBand/,
  );
});

test('CI web build uses production-like public origins', () => {
  const ciWorkflow = readRepoFile('.github/workflows/ci.yml');
  const buildJob = readCiJobBlock(ciWorkflow, 'build');
  const buildWebStep = buildJob.match(
    /- name: Build web\r?\n[\s\S]*?(?=\r?\n      - name:|\r?\n  [A-Za-z0-9_-]+:\r?\n|$)/,
  );

  assert.ok(buildWebStep, 'Expected CI build job to include a Build web step');
  assert.match(buildWebStep[0], /NEXT_PUBLIC_API_URL: https:\/\/vizora\.cloud/);
  assert.match(
    buildWebStep[0],
    /NEXT_PUBLIC_SOCKET_URL: https:\/\/vizora\.cloud/,
  );
  assert.doesNotMatch(buildWebStep[0], /http:\/\/localhost/);
});
