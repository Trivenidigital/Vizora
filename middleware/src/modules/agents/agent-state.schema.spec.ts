import { validateFamilyState, AgentFamilyStateSchema } from './agent-state.schema';

const validBaseState = {
  systemStatus: 'HEALTHY' as const,
  lastUpdated: '2026-05-03T12:00:00.000Z',
  lastRun: { 'health-guardian': '2026-05-03T11:55:00.000Z' },
  incidents: [],
  recentRemediations: [],
  agentResults: {},
};

describe('agent-state.schema', () => {
  describe('validateFamilyState — happy paths', () => {
    it('accepts a minimal well-formed family payload', () => {
      const r = validateFamilyState(validBaseState);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toMatchObject(validBaseState);
    });

    it('accepts null (== ENOENT path)', () => {
      const r = validateFamilyState(null);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toBeNull();
    });

    it('accepts undefined as null', () => {
      const r = validateFamilyState(undefined);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toBeNull();
    });

    it('accepts the corrupt-state sentinel unchanged', () => {
      const sentinel = {
        __error: 'state file corrupt',
        family: 'ops',
        preservedAs: '/tmp/ops.json.corrupt.1234.json',
      };
      const r = validateFamilyState(sentinel);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toEqual(sentinel);
    });

    it('accepts known per-family extensions (emailsSentThisRun, pendingManualRun)', () => {
      const r = validateFamilyState({
        ...validBaseState,
        emailsSentThisRun: 3,
        pendingManualRun: true,
        pendingManualRunRequestedAt: '2026-05-03T11:50:00.000Z',
      });
      expect(r.ok).toBe(true);
    });

    it('passes through unknown additional fields (per-family extensions)', () => {
      const r = validateFamilyState({
        ...validBaseState,
        someFutureFamilyField: { nested: 'value' },
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect((r.value as Record<string, unknown>).someFutureFamilyField).toEqual({
          nested: 'value',
        });
      }
    });

    it('accepts a populated incident', () => {
      const r = validateFamilyState({
        ...validBaseState,
        incidents: [{
          id: 'health-guardian:service-down:middleware',
          agent: 'health-guardian',
          type: 'service-down',
          severity: 'critical' as const,
          target: 'service',
          targetId: 'middleware',
          detected: '2026-05-03T11:50:00.000Z',
          message: 'middleware /health/ready returned 500',
          remediation: 'pm2 restart vizora-middleware',
          status: 'resolved' as const,
          attempts: 1,
        }],
      });
      expect(r.ok).toBe(true);
    });
  });

  describe('validateFamilyState — failure cases', () => {
    it('rejects payload with wrong systemStatus enum value', () => {
      const r = validateFamilyState({
        ...validBaseState,
        systemStatus: 'NOT_A_VALID_STATUS',
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.issues.join(' ')).toContain('systemStatus');
    });

    it('rejects payload missing required field', () => {
      const { lastUpdated, ...withoutLastUpdated } = validBaseState;
      const r = validateFamilyState(withoutLastUpdated);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.issues.join(' ')).toContain('lastUpdated');
    });

    it('rejects payload with wrong field type', () => {
      const r = validateFamilyState({
        ...validBaseState,
        incidents: 'not-an-array',
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.issues.join(' ')).toContain('incidents');
    });

    it('rejects an incident with an unknown severity', () => {
      const r = validateFamilyState({
        ...validBaseState,
        incidents: [{
          id: 'x',
          agent: 'a',
          type: 't',
          severity: 'catastrophic',  // not in enum
          target: 'tgt',
          targetId: 'id',
          detected: 'ts',
          message: 'm',
          remediation: 'r',
          status: 'open',
          attempts: 0,
        }],
      });
      expect(r.ok).toBe(false);
    });

    it('rejects negative durationMs in agentResults', () => {
      const r = validateFamilyState({
        ...validBaseState,
        agentResults: {
          'foo': {
            agent: 'foo',
            timestamp: 'ts',
            durationMs: -1,
            issuesFound: 0,
            issuesFixed: 0,
            issuesEscalated: 0,
            incidents: [],
          },
        },
      });
      expect(r.ok).toBe(false);
    });

    it('caps issue list at 5 entries even when many fields are wrong', () => {
      const r = validateFamilyState({
        systemStatus: 1,
        lastUpdated: 2,
        lastRun: 3,
        incidents: 4,
        recentRemediations: 5,
        agentResults: 6,
        emailsSentThisRun: 'no',
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.issues.length).toBeLessThanOrEqual(5);
    });
  });

  describe('AgentFamilyStateSchema', () => {
    it('exports the raw schema for callers that want to compose it', () => {
      // Smoke check that the export is a Zod schema with safeParse
      expect(typeof AgentFamilyStateSchema.safeParse).toBe('function');
    });
  });
});
