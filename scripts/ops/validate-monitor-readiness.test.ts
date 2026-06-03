import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeReadinessStatus,
  unwrapResponseEnvelope,
} from '../validate-monitor';

test('validate monitor normalizes enveloped healthy readiness responses', () => {
  const body = unwrapResponseEnvelope({
    success: true,
    data: { status: 'ok' },
  });

  assert.equal(normalizeReadinessStatus(body, true), 'healthy');
});

test('validate monitor normalizes enveloped degraded readiness responses', () => {
  const body = unwrapResponseEnvelope({
    success: true,
    data: { status: 'degraded' },
  });

  assert.equal(normalizeReadinessStatus(body, true), 'degraded');
});

test('validate monitor preserves non-enveloped readiness responses', () => {
  const body = unwrapResponseEnvelope({ status: 'ok' });

  assert.equal(normalizeReadinessStatus(body, true), 'healthy');
});

test('validate monitor treats non-2xx readiness responses as unhealthy', () => {
  assert.equal(normalizeReadinessStatus(null, false), 'unhealthy');
});

test('validate monitor fails closed on malformed successful readiness responses', () => {
  const body = unwrapResponseEnvelope({
    success: true,
    data: { state: 'ok' },
  });

  assert.equal(normalizeReadinessStatus(body, true), 'unhealthy');
});
