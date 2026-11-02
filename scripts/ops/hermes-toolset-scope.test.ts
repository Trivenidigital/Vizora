/**
 * Hermes cron agents must run with an explicit, narrow `-t` toolset.
 *
 * Without `-t`, `hermes -z` gives the model the full `hermes-cli` toolset —
 * terminal, execute_code, write_file, patch, delegate_task — as root in
 * /opt/vizora/app, with approvals auto-bypassed. Both PM2 entries shipped with
 * an empty toolset argument, and gpt-4o-mini used the shell to build into the
 * live middleware dist (#406), run a full build and `test:e2e` on prod (both
 * #399 OOM kills) and `cat .env`. The MCP token scope never contained any of
 * it, because shell commands do not go through MCP.
 *
 * Two layers, both pinned here: the ecosystem entries name an MCP server, and
 * the runner refuses an empty or full-access value on its own.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);
const { apps } = require(join(repoRoot, 'ecosystem.config.js')) as {
  apps: Array<{ name: string; args?: string[] | string }>;
};

const RUNNER = 'scripts/agents/hermes/run-hermes-skill.sh';
const runner = join(repoRoot, RUNNER);

// Each skill's MCP server, as named in /root/.hermes/config.yaml `mcp_servers`.
const EXPECTED_TOOLSETS: Record<string, string> = {
  'hermes-vizora-customer-lifecycle': 'vizora-platform',
  'hermes-vizora-support-triage': 'vizora',
};

const hermesApps = apps.filter(
  a => Array.isArray(a.args) && a.args.some(arg => arg.endsWith(RUNNER)),
);

test('the Hermes runner entries are found, so the checks below are not vacuous', () => {
  assert.ok(hermesApps.length >= 1, 'expected at least one PM2 app driving run-hermes-skill.sh');
});

test('every Hermes cron entry passes its own MCP server as the toolset', () => {
  for (const app of hermesApps) {
    const args = app.args as string[];
    const toolsets = args[args.findIndex(arg => arg.endsWith(RUNNER)) + 3];
    assert.equal(
      toolsets,
      EXPECTED_TOOLSETS[app.name],
      `${app.name} must pass an explicit MCP-server toolset; got ${JSON.stringify(toolsets)}`,
    );
  }
});

// Values reach bash through env vars, not argv: Git Bash (MSYS) glob-expands
// argv from non-MSYS parents, which turns a literal '*' into a file list.
function runRunner(toolsets: string): { status: number | null; log: string } {
  const logDir = mkdtempSync(join(tmpdir(), 'hermes-runner-'));
  const result = spawnSync('bash', ['-c', 'exec bash "$RUNNER" test-skill "test prompt" "$TS"'], {
    env: { ...process.env, HERMES_RUNNER_LOG_DIR: logDir, RUNNER: runner, TS: toolsets },
    encoding: 'utf8',
    timeout: 20_000,
  });
  const logFile = join(logDir, 'test-skill.log');
  return { status: result.status, log: existsSync(logFile) ? readFileSync(logFile, 'utf8') : '' };
}

const UNSAFE = ['', '  ', 'all', '*', 'hermes-cli', 'vizora,terminal', 'file', 'code_execution'];
const SAFE = ['vizora', 'vizora-platform', 'vizora,vizora-platform'];

function guardAccepts(toolsets: string): boolean {
  const guard = join(repoRoot, 'scripts/agents/hermes/lib/toolset-guard.sh');
  const result = spawnSync('bash', ['-c', 'source "$GUARD"; is_safe_toolsets "$TS"'], {
    env: { ...process.env, GUARD: guard, TS: toolsets },
    encoding: 'utf8',
  });
  assert.ok(result.status === 0 || result.status === 1, `guard errored: ${result.stderr}`);
  return result.status === 0;
}

test('the guard accepts MCP-server toolsets (control: it does not refuse everything)', () => {
  for (const value of SAFE) assert.equal(guardAccepts(value), true, value);
});

test('the guard rejects empty and full-access toolsets', () => {
  for (const value of UNSAFE) assert.equal(guardAccepts(value), false, JSON.stringify(value));
});

for (const unsafe of UNSAFE) {
  test(`the runner refuses toolsets=${JSON.stringify(unsafe)} before starting Hermes`, () => {
    const { status, log } = runRunner(unsafe);
    // exit 0 is deliberate: PM2 cron_restart treats non-zero as a crash.
    assert.equal(status, 0);
    assert.match(log, /ABORT skill=test-skill reason=unsafe_toolsets/);
    assert.doesNotMatch(log, /end skill=/, 'Hermes must not have been invoked');
  });
}
