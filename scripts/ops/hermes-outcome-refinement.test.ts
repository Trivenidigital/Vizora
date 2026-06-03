import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  classifyAuditOutcome,
  mcpAuditAgentNamesForSkill,
} from '../agents/hermes/outcome-refinement';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

test('Hermes outcome classifier leaves empty audit evidence unrefined', () => {
  assert.deepEqual(classifyAuditOutcome([]), {
    outcome: null,
    hasAuditEvidence: false,
  });
});

test('Hermes outcome classifier keeps all-success audit rows successful', () => {
  assert.deepEqual(classifyAuditOutcome([{ status: 'success', count: 3 }]), {
    outcome: 'success',
    hasAuditEvidence: true,
  });
});

test('Hermes outcome classifier marks all-failure audit rows as tool_error', () => {
  assert.deepEqual(classifyAuditOutcome([{ status: 'error', count: 2 }]), {
    outcome: 'tool_error',
    hasAuditEvidence: true,
  });
});

test('Hermes outcome classifier marks mixed audit rows as partial', () => {
  assert.deepEqual(
    classifyAuditOutcome([
      { status: 'success', count: 1 },
      { status: 'error', count: 2 },
    ]),
    {
      outcome: 'partial',
      hasAuditEvidence: true,
    },
  );
});

test('Hermes audit fallback maps vizora skill names to MCP token agent names', () => {
  assert.deepEqual(mcpAuditAgentNamesForSkill('vizora-customer-lifecycle'), [
    'vizora-customer-lifecycle',
    'hermes-customer-lifecycle',
  ]);
  assert.deepEqual(mcpAuditAgentNamesForSkill('vizora-support-triage'), [
    'vizora-support-triage',
    'hermes-support-triage',
  ]);
  assert.deepEqual(mcpAuditAgentNamesForSkill('custom-agent'), ['custom-agent']);
});

test('Hermes insights sidecar falls back to agentName and firing window when agentRunId is absent', () => {
  const sidecar = readRepoFile('scripts/agents/hermes/poll-insights.ts');

  assert.match(sidecar, /loadAuditStatusGroupsForRun/);
  assert.match(sidecar, /where:\s*{\s*outcome:\s*'success',\s*enrichedAt:\s*null,\s*startedAt:/s);
  assert.match(sidecar, /agentRunId:\s*null/);
  assert.match(sidecar, /agentName:\s*{\s*in:\s*mcpAuditAgentNamesForSkill\(row\.skillName\)\s*}/s);
  assert.match(sidecar, /createdAt:\s*{\s*gte:\s*fallbackStart,\s*lte:\s*fallbackEnd/s);
  assert.match(sidecar, /if \(outcome\) {\s*const ok = await patchRun\(row\.id, { outcomeRefinement: outcome }\);/s);
  assert.doesNotMatch(
    sidecar,
    /successes === 0 && failures === 0\)\s*next = 'no_work'/,
  );
  assert.doesNotMatch(sidecar, /agentName:\s*row\.skillName/);
  assert.doesNotMatch(sidecar, /outcome !== 'success'/);
});
