/**
 * Incidents must be able to leave the state they are raised in.
 *
 * fleet-manager raises `display_offline_persistent` with `status: 'escalated'`
 * (fleet-manager.ts, "escalating" branch) but its resolver skipped anything
 * that was not `'open'`. The incident was therefore born in a state its own
 * sweep ignored: `determineSystemStatus` counts every non-resolved incident, so
 * one display offline for over an hour pinned the whole platform at CRITICAL
 * permanently — ops-reporter prunes only already-resolved rows, so nothing aged
 * it out, and the operator got hourly Slack/email naming a display that was
 * back online.
 *
 * These tests execute the predicate rather than asserting on source text, so
 * they fail if the guard regresses to an `open`-only check.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { determineSystemStatus, isActiveIncident, resolveNotReraised } from './lib/state.js';
import type { Incident, OpsState } from './lib/types.js';

function incident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: 'fleet-manager:display_offline_persistent:display-1',
    agent: 'fleet-manager',
    type: 'display_offline_persistent',
    severity: 'critical',
    target: 'display',
    targetId: 'display-1',
    detected: '2026-08-13T00:00:00.000Z',
    message: 'Display "Lobby" has been offline for 90 minutes',
    remediation: 'Manual investigation required',
    status: 'escalated',
    attempts: 3,
    ...overrides,
  } as Incident;
}

test('an escalated incident that is not re-raised gets resolved', () => {
  const resolved = resolveNotReraised([incident()], 'fleet-manager', new Set(), 'NOW');

  assert.equal(resolved.length, 1, 'escalated incidents must be sweepable, not just open ones');
  assert.equal(resolved[0].status, 'resolved');
  assert.equal(resolved[0].resolvedAt, 'NOW');
});

test('an open incident that is not re-raised still gets resolved', () => {
  const resolved = resolveNotReraised([incident({ status: 'open' })], 'fleet-manager', new Set(), 'NOW');
  assert.equal(resolved.length, 1);
});

test('an incident re-raised this run is left alone', () => {
  const existing = incident();
  const resolved = resolveNotReraised([existing], 'fleet-manager', new Set([existing.id]), 'NOW');
  assert.equal(resolved.length, 0, 'a still-failing check must not be reported as fixed');
});

test('an already-resolved incident is not resolved twice', () => {
  const resolved = resolveNotReraised([incident({ status: 'resolved' })], 'fleet-manager', new Set(), 'NOW');
  assert.equal(resolved.length, 0);
});

test('an agent may only resolve incidents it raised', () => {
  const other = incident({ agent: 'schedule-doctor', id: 'schedule-doctor:x:1' });
  const resolved = resolveNotReraised([other], 'fleet-manager', new Set(), 'NOW');
  assert.equal(resolved.length, 0, 'agents must not clear each other incidents');
});

test('resolving the escalated incident actually clears CRITICAL', () => {
  // The end-to-end consequence: without the sweep, systemStatus is a ratchet.
  const before = { incidents: [incident()] } as unknown as OpsState;
  assert.equal(determineSystemStatus(before), 'CRITICAL');

  const swept = resolveNotReraised(before.incidents, 'fleet-manager', new Set(), 'NOW');
  const after = { incidents: swept } as unknown as OpsState;

  assert.ok(!swept.some(isActiveIncident), 'nothing should still be active');
  assert.equal(determineSystemStatus(after), 'HEALTHY');
});
