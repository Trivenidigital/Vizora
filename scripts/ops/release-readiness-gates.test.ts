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

test('first-customer runbook uses current C-series launch gates without stale May target dates', () => {
  const runbook = readRepoFile('docs/runbooks/first-customer-onboarding.md');

  assert.match(runbook, /^### .*C1 .* SMTP \/ Resend/m);
  assert.match(runbook, /^### .*C2 .* organization provisioned/m);
  assert.match(runbook, /^### .*C3 .* Real-device walkthrough/m);
  assert.match(runbook, /^### .*C4 .* go-live smoke/m);
  assert.match(runbook, /Launch date: operator-confirmed/);
  assert.doesNotMatch(runbook, /2026-05-1[0-9]/);
  assert.doesNotMatch(runbook, /B5\/B6\/B7/);
  assert.doesNotMatch(runbook, /B16/);
});

test('first-customer runbook avoids inline SSH output reads on Windows/Codex path', () => {
  const runbook = readRepoFile('docs/runbooks/first-customer-onboarding.md');

  assert.match(runbook, /redirect SSH output to a local \.ssh_.*\.txt file/i);
  assert.match(runbook, /read that file as a separate step/i);
  assert.doesNotMatch(runbook, /^cat \.ssh_/m);
});

test('gitignore protects SSH output files captured by operator runbooks', () => {
  const gitignore = readRepoFile('.gitignore');

  assert.match(gitignore, /^\.ssh_\*\.txt$/m);
});

test('backlog uses current customer-1 C-series launch gate truth', () => {
  const backlog = readRepoFile('backlog.md');

  assert.match(backlog, /Customer-1 launch date:\*\* operator-confirmed/i);
  assert.match(backlog, /## P0 .*customer-1 \(operator-gated launch\)/i);
  assert.match(
    backlog,
    /\|\s*\*\*C4\*\*\s*\|\s*\*\*Final go-live smoke test on prod\*\*/,
  );
  assert.doesNotMatch(backlog, /Customer-1 launch target:\*\* 2026-05-13/);
  assert.doesNotMatch(backlog, /\|\s*\*\*C4\*\*\s*\|\s*B16/);
  assert.doesNotMatch(
    backlog,
    /Remaining P0s are config-only: SMTP setup, Stripe\/Razorpay keys, final smoke test/,
  );
  assert.doesNotMatch(
    backlog,
    /WEEK 1 \(NOW\):\s+P0 Blockers .*SMTP, Billing, Smoke Test/,
  );
  assert.match(
    backlog,
    /Customer-1 remaining gates: C1 SMTP\/Resend verification\/test send, C2 customer-1 org provisioning, C3 real-device walkthrough, C4 final go-live smoke\./,
  );
});

test('realtime Docker healthcheck probes the prefixed health endpoint', () => {
  const dockerfile = readRepoFile('docker/Dockerfile.realtime');

  assert.match(dockerfile, /http:\/\/localhost:3002\/api\/health/);
  assert.doesNotMatch(dockerfile, /localhost:3002\/health['"]/);
});

test('middleware Docker healthcheck probes the versioned health endpoint', () => {
  const dockerfile = readRepoFile('docker/Dockerfile.middleware');

  assert.match(dockerfile, /http:\/\/localhost:3000\/api\/v1\/health/);
  assert.doesNotMatch(dockerfile, /localhost:3000\/api\/health['"]/);
});

test('Docker README documents current app service health endpoints', () => {
  const readme = readRepoFile('docker/README.md');

  assert.match(readme, /curl http:\/\/localhost:3000\/api\/v1\/health/);
  assert.match(readme, /curl http:\/\/localhost:3002\/api\/health/);
  assert.match(readme, /curl http:\/\/localhost:3001\r?\n/);
  assert.doesNotMatch(readme, /localhost:3000\/api\/health/);
  assert.doesNotMatch(readme, /localhost:3001\/api\/health/);
});

test('Docker README preserves realtime single-instance guidance', () => {
  const readme = readRepoFile('docker/README.md');

  assert.match(readme, /Realtime gateway[^\r\n]+MUST stay single-instance/i);
  assert.doesNotMatch(readme, /--scale realtime=2/);
});

test('Docker README does not present PM2 app services as compose services', () => {
  const readme = readRepoFile('docker/README.md');

  assert.match(readme, /docker-compose\.yml starts infrastructure/i);
  assert.match(readme, /application services run under PM2/i);
  assert.doesNotMatch(readme, /docker exec vizora-middleware/);
  assert.doesNotMatch(readme, /docker-compose logs -f middleware/);
  assert.doesNotMatch(readme, /--scale middleware=3/);
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

test('ops reporter summarizes active incidents instead of only open incidents', () => {
  const reporter = readRepoFile('scripts/ops/ops-reporter.ts');

  assert.match(reporter, /isActiveIncident/);
  assert.doesNotMatch(reporter, /filter\(i => i\.status === 'open'\)/);
});

test('ops alerting labels unresolved incident lists as active incidents', () => {
  const alerting = readRepoFile('scripts/ops/lib/alerting.ts');

  assert.match(alerting, /Active incidents/);
  assert.match(alerting, /No active incidents/);
  assert.doesNotMatch(alerting, /Open incidents/);
  assert.doesNotMatch(alerting, /No open incidents/);
});

test('validate monitor parses readiness body status instead of only HTTP 200', () => {
  const monitor = readRepoFile('scripts/validate-monitor.ts');

  assert.match(monitor, /function normalizeReadinessStatus/);
  assert.match(monitor, /const readinessBody = await readJsonBody/);
  assert.match(monitor, /services\['readiness'\] = readinessStatus/);
  assert.match(monitor, /health\.degraded/);
  assert.match(monitor, /INFRA-DEGRADED/);
  assert.doesNotMatch(monitor, /services\['readiness'\] = res\.ok \? 'healthy'/);
});

test('deploy verify requires readiness body status ok instead of only HTTP 200', () => {
  const deployVerify = readRepoFile('scripts/deploy-verify.sh');

  assert.match(deployVerify, /parse_readiness_status\(\)/);
  assert.match(deployVerify, /status=ok/);
  assert.match(deployVerify, /status=degraded/);
  assert.doesNotMatch(
    deployVerify,
    /STATUS=\$\(http_status "\$BASE_URL\/api\/v1\/health\/ready"\)\r?\nif \[\[ "\$STATUS" == "200" \]\]; then pass "GET \/api\/v1\/health\/ready -> \$STATUS"/,
  );
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
