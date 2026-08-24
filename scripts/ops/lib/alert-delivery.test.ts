/**
 * Negative controls for alert delivery truth.
 *
 * On prod, SLACK_WEBHOOK_URL, SMTP_HOST, SMTP_TO and OPS_ALERT_EMAIL are all
 * empty, and every sender returned `void` after a silent early return — so
 * `ops-reporter` logged `alerted: true` for cycles in which nothing was sent
 * and nothing could have been. Worse, it stamped the re-alert suppression
 * window off that same decision, so an alert nobody received could suppress a
 * later one that would have been.
 *
 * The load-bearing property these tests pin is one-directional: **an
 * unconfigured channel must never produce `sent`.** The rest is detail.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  anyDelivered,
  describeDelivery,
  pingHeartbeat,
  sendEmailAlert,
  sendInlineAlert,
  sendSlackAlert,
  type DeliveryResult,
} from './alerting.js';

const ALERT_ENV = [
  'SLACK_WEBHOOK_URL',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
  'SMTP_TO',
  'OPS_ALERT_EMAIL',
] as const;

/** Run `fn` with the alert env cleared, then set from `overrides`. */
async function withEnv<T>(
  overrides: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const saved = new Map<string, string | undefined>();
  for (const key of ALERT_ENV) {
    saved.set(key, process.env[key]);
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(overrides)) {
    saved.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

/** Swap global fetch for the duration of `fn`. */
async function withFetch<T>(impl: typeof globalThis.fetch, fn: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}

function fetchReturning(status: number): typeof globalThis.fetch {
  return (async () => ({ ok: status >= 200 && status < 300, status })) as unknown as typeof globalThis.fetch;
}

// ─── The load-bearing negative controls ─────────────────────────────────────

test('an unconfigured Slack webhook reports not_configured, never sent', async () => {
  const result = await withEnv({}, () => sendSlackAlert('CRITICAL', 'HEALTHY', [], 0));
  assert.equal(result.outcome, 'not_configured');
  assert.notEqual(result.outcome, 'sent');
  assert.equal(result.channel, 'slack');
});

test('an unconfigured SMTP host reports not_configured, never sent', async () => {
  const result = await withEnv({}, () => sendEmailAlert('CRITICAL', [], 0));
  assert.equal(result.outcome, 'not_configured');
  assert.match(result.detail ?? '', /SMTP_HOST/);
});

test('a configured SMTP host with NO recipient still cannot report sent', async () => {
  // The prod shape that made the recipient warning unreachable: the host check
  // returned first, so this branch never logged at all.
  const result = await withEnv({ SMTP_HOST: 'smtp.example.invalid' }, () =>
    sendEmailAlert('CRITICAL', [], 0),
  );
  assert.equal(result.outcome, 'not_configured');
  assert.match(result.detail ?? '', /SMTP_TO|OPS_ALERT_EMAIL/);
});

test('an unconfigured heartbeat URL reports not_configured, never sent', async () => {
  const result = await pingHeartbeat('test-agent', undefined);
  assert.equal(result.outcome, 'not_configured');
  assert.equal(result.channel, 'heartbeat');
});

test('an unconfigured inline alert reports not_configured, never sent', async () => {
  const result = await withEnv({}, () => sendInlineAlert('test-agent', 'critical', 'summary'));
  assert.equal(result.outcome, 'not_configured');
});

test('THE INVARIANT: a fully unconfigured host can never produce a delivered record', async () => {
  const results = await withEnv({}, async () => [
    await sendSlackAlert('CRITICAL', 'HEALTHY', [], 0),
    await sendEmailAlert('CRITICAL', [], 0),
    await sendInlineAlert('test-agent', 'critical', 'summary'),
    await pingHeartbeat('test-agent', undefined),
  ]);

  assert.equal(anyDelivered(results), false);
  assert.ok(results.every((r) => r.outcome === 'not_configured'));
  // This is the exact string that used to read `alerted: true`.
  assert.equal(
    describeDelivery(results).includes('sent'),
    false,
    'no channel may appear as sent when none is configured',
  );
});

// ─── The positive and failure directions ────────────────────────────────────
//
// Without these, "never sent" would be trivially satisfiable by a sender that
// can never succeed at all.

test('a configured Slack webhook that accepts the post reports sent', async () => {
  const result = await withEnv({ SLACK_WEBHOOK_URL: 'https://hooks.example.invalid/x' }, () =>
    withFetch(fetchReturning(200), () => sendSlackAlert('CRITICAL', 'HEALTHY', [], 0)),
  );
  assert.equal(result.outcome, 'sent');
  assert.equal(result.detail, undefined);
});

test('a configured Slack webhook that rejects reports failed, not sent', async () => {
  const result = await withEnv({ SLACK_WEBHOOK_URL: 'https://hooks.example.invalid/x' }, () =>
    withFetch(fetchReturning(500), () => sendSlackAlert('CRITICAL', 'HEALTHY', [], 0)),
  );
  assert.equal(result.outcome, 'failed');
  assert.match(result.detail ?? '', /500/);
});

test('a throwing transport reports failed, not sent', async () => {
  const throwing = (async () => {
    throw new Error('ECONNREFUSED');
  }) as unknown as typeof globalThis.fetch;
  const result = await withEnv({ SLACK_WEBHOOK_URL: 'https://hooks.example.invalid/x' }, () =>
    withFetch(throwing, () => sendSlackAlert('CRITICAL', 'HEALTHY', [], 0)),
  );
  assert.equal(result.outcome, 'failed');
  assert.match(result.detail ?? '', /ECONNREFUSED/);
});

test('a heartbeat that posts successfully reports sent', async () => {
  const result = await withFetch(fetchReturning(200), () =>
    pingHeartbeat('test-agent', 'https://hc.example.invalid/uuid'),
  );
  assert.equal(result.outcome, 'sent');
});

// ─── Summary helpers ────────────────────────────────────────────────────────

test('anyDelivered requires an actual send', () => {
  const cases: Array<[DeliveryResult[], boolean]> = [
    [[], false],
    [[{ channel: 'slack', outcome: 'not_configured' }], false],
    [[{ channel: 'slack', outcome: 'failed' }], false],
    [
      [
        { channel: 'slack', outcome: 'not_configured' },
        { channel: 'email', outcome: 'failed' },
      ],
      false,
    ],
    [
      [
        { channel: 'slack', outcome: 'not_configured' },
        { channel: 'email', outcome: 'sent' },
      ],
      true,
    ],
  ];
  for (const [results, expected] of cases) {
    assert.equal(anyDelivered(results), expected, describeDelivery(results));
  }
});

test('describeDelivery names every channel and its outcome', () => {
  const line = describeDelivery([
    { channel: 'slack', outcome: 'not_configured', detail: 'SLACK_WEBHOOK_URL unset' },
    { channel: 'email', outcome: 'failed', detail: 'auth' },
  ]);
  assert.match(line, /slack=not_configured \(SLACK_WEBHOOK_URL unset\)/);
  assert.match(line, /email=failed \(auth\)/);
});

test('describeDelivery says so when nothing was attempted', () => {
  assert.match(describeDelivery([]), /no channels attempted/);
});
