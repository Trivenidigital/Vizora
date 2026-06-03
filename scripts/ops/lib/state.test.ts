import assert from 'node:assert/strict';
import test from 'node:test';

import { determineSystemStatus } from './state.js';
import type { Incident, OpsState, IncidentStatus, Severity } from './types.js';

function incident(
  status: IncidentStatus,
  severity: Severity,
  id = `${status}-${severity}`,
): Incident {
  return {
    id,
    agent: 'health-guardian',
    type: 'service-down',
    severity,
    target: 'service',
    targetId: id,
    detected: '2026-06-03T00:00:00.000Z',
    message: `${id} incident`,
    remediation: 'check service',
    status,
    attempts: 2,
  };
}

function stateWith(incidents: Incident[]): OpsState {
  return {
    systemStatus: 'HEALTHY',
    lastUpdated: '2026-06-03T00:00:00.000Z',
    lastRun: {},
    incidents,
    recentRemediations: [],
    agentResults: {},
  };
}

test('determineSystemStatus treats escalated critical incidents as active', () => {
  assert.equal(
    determineSystemStatus(stateWith([incident('escalated', 'critical')])),
    'CRITICAL',
  );
});

test('determineSystemStatus treats escalated warning incidents as degraded', () => {
  assert.equal(
    determineSystemStatus(stateWith([incident('escalated', 'warning')])),
    'DEGRADED',
  );
});

test('determineSystemStatus ignores resolved incidents', () => {
  assert.equal(
    determineSystemStatus(stateWith([
      incident('resolved', 'critical', 'resolved-critical'),
      incident('resolved', 'warning', 'resolved-warning'),
    ])),
    'HEALTHY',
  );
});
