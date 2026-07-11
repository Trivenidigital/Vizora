import {
  canonicalPriorityToMcp,
  mcpPriorityToCanonical,
  type McpPriority,
} from './priority-mapping';

describe('priority-mapping', () => {
  describe('mcpPriorityToCanonical (inbound: agent → DB)', () => {
    it.each<[McpPriority, string]>([
      ['urgent', 'critical'],
      ['high', 'high'],
      ['normal', 'medium'],
      ['low', 'low'],
    ])('maps %s → %s', (mcp, canonical) => {
      expect(mcpPriorityToCanonical(mcp)).toBe(canonical);
    });

    it('never emits a non-canonical value for any MCP input', () => {
      const canonical = ['critical', 'high', 'medium', 'low'];
      for (const p of ['urgent', 'high', 'normal', 'low'] as McpPriority[]) {
        expect(canonical).toContain(mcpPriorityToCanonical(p));
      }
    });
  });

  describe('canonicalPriorityToMcp (outbound: DB → agent)', () => {
    it.each<[string, string]>([
      ['critical', 'urgent'],
      ['high', 'high'],
      ['medium', 'normal'],
      ['low', 'low'],
    ])('maps %s → %s', (canonical, mcp) => {
      expect(canonicalPriorityToMcp(canonical)).toBe(mcp);
    });

    it('returns null for null/undefined', () => {
      expect(canonicalPriorityToMcp(null)).toBeNull();
      expect(canonicalPriorityToMcp(undefined)).toBeNull();
    });

    it('passes through values already in the MCP vocabulary (legacy rows)', () => {
      expect(canonicalPriorityToMcp('urgent')).toBe('urgent');
      expect(canonicalPriorityToMcp('normal')).toBe('normal');
    });

    it('passes through unrecognized values unchanged instead of throwing', () => {
      expect(canonicalPriorityToMcp('weird')).toBe('weird');
      expect(canonicalPriorityToMcp('')).toBe('');
    });
  });

  describe('round-trip', () => {
    it('canonical → mcp → canonical is stable', () => {
      for (const p of ['critical', 'high', 'medium', 'low']) {
        const mcp = canonicalPriorityToMcp(p) as McpPriority;
        expect(mcpPriorityToCanonical(mcp)).toBe(p);
      }
    });
  });
});
