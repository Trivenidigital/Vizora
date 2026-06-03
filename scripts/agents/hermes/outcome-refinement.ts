export type AuditStatusGroup = {
  status: string;
  count: number;
};

export type AuditOutcomeRefinement = 'success' | 'partial' | 'tool_error' | null;

export function classifyAuditOutcome(groups: AuditStatusGroup[]): {
  outcome: AuditOutcomeRefinement;
  hasAuditEvidence: boolean;
} {
  const successes = groups.find((g) => g.status === 'success')?.count ?? 0;
  const failures = groups
    .filter((g) => g.status !== 'success')
    .reduce((sum, g) => sum + g.count, 0);

  if (successes === 0 && failures === 0) {
    return { outcome: null, hasAuditEvidence: false };
  }
  if (successes === 0) {
    return { outcome: 'tool_error', hasAuditEvidence: true };
  }
  if (failures > 0) {
    return { outcome: 'partial', hasAuditEvidence: true };
  }
  return { outcome: 'success', hasAuditEvidence: true };
}

export function mcpAuditAgentNamesForSkill(skillName: string): string[] {
  const names = new Set<string>([skillName]);
  if (skillName.startsWith('vizora-')) {
    names.add(`hermes-${skillName.slice('vizora-'.length)}`);
  }
  return [...names];
}
