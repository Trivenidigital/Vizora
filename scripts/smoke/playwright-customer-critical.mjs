#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import net from 'node:net';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

export const customerCriticalSpecs = [
  'e2e-tests/01-auth.spec.ts',
  'e2e-tests/03-displays.spec.ts',
  'e2e-tests/04-content.spec.ts',
  'e2e-tests/05-playlists.spec.ts',
  'e2e-tests/06-schedules.spec.ts',
  'e2e-tests/15-comprehensive-integration.spec.ts',
  'e2e-tests/21-notifications.spec.ts',
];

export function getPlaywrightCliPath() {
  return require.resolve('@playwright/test/cli');
}

export function buildPlaywrightCommand(extraArgs = []) {
  return {
    executable: process.execPath,
    args: [
      getPlaywrightCliPath(),
      'test',
      ...customerCriticalSpecs,
      ...extraArgs,
    ],
  };
}

export function requirePort(name, port, host = 'localhost') {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port, timeout: 2000 });

    socket.once('connect', () => {
      socket.end();
      resolve();
    });

    socket.once('timeout', () => {
      socket.destroy();
      reject(new Error(`${name} is not listening at ${host}:${port}`));
    });

    socket.once('error', () => {
      reject(new Error(`${name} is not listening at ${host}:${port}`));
    });
  });
}

async function main() {
  await requirePort('middleware', 3000);
  await requirePort('web', 3001);
  await requirePort('realtime', 3002);

  const command = buildPlaywrightCommand(process.argv.slice(2));
  const child = spawn(command.executable, command.args, { stdio: 'inherit' });

  child.once('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`[playwright-customer-critical] ${error.message}`);
    console.error(
      '[playwright-customer-critical] Start the local Vizora stack first; this helper only checks services and runs Playwright.',
    );
    process.exit(2);
  });
}
