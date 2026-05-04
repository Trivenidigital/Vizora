import { z } from 'zod';

/**
 * Zod schemas for the per-family state files read by `AgentStateService`.
 *
 * These validate the *shape* of `<AGENT_STATE_DIR>/<family>.json` after the
 * file has been parsed and after secret/PII redaction. The schemas are
 * intentionally permissive about additional fields (`.passthrough()`)
 * because each agent family extends the common shape with its own fields
 * (e.g. `customer` adds `emailsSentThisRun`, any family may have
 * `pendingManualRun`).
 *
 * Failure mode: when a family file's contents don't match this schema,
 * `AgentStateService` logs a warning and returns null — the same
 * fail-soft behaviour the service already uses for `ENOENT` and corrupt
 * JSON. This avoids surfacing partially-malformed payloads to API
 * consumers (an MCP tool, the dashboard, etc.) that have no way to know
 * a field they read is missing or the wrong type.
 *
 * The corresponding TypeScript types live in
 * `scripts/ops/lib/types.ts` (single source of truth — re-exported by
 * `scripts/agents/lib/types.ts`). When that shape changes, this schema
 * must change with it. The unit tests in
 * `agent-state.schema.spec.ts` lock the field set.
 */

// ─── Atomic enums ───────────────────────────────────────────────────────────

const SystemStatus = z.enum(['HEALTHY', 'DEGRADED', 'CRITICAL']);
const Severity = z.enum(['critical', 'warning', 'info']);
const IncidentStatus = z.enum(['open', 'resolved', 'escalated']);

// ─── Composite shapes ───────────────────────────────────────────────────────

const Incident = z
  .object({
    id: z.string(),
    agent: z.string(),
    type: z.string(),
    severity: Severity,
    target: z.string(),
    targetId: z.string(),
    detected: z.string(),
    message: z.string(),
    remediation: z.string(),
    status: IncidentStatus,
    attempts: z.number().int().nonnegative(),
    resolvedAt: z.string().optional(),
    error: z.string().optional(),
  })
  .passthrough();

const RemediationAction = z
  .object({
    agent: z.string(),
    timestamp: z.string(),
    action: z.string(),
    target: z.string(),
    targetId: z.string(),
    method: z.string(),
    endpoint: z.string().optional(),
    before: z.unknown().optional(),
    after: z.unknown().optional(),
    success: z.boolean(),
    error: z.string().optional(),
  })
  .passthrough();

const AgentResult = z
  .object({
    agent: z.string(),
    timestamp: z.string(),
    durationMs: z.number().nonnegative(),
    issuesFound: z.number().int().nonnegative(),
    issuesFixed: z.number().int().nonnegative(),
    issuesEscalated: z.number().int().nonnegative(),
    incidents: z.array(Incident),
  })
  .passthrough();

// ─── Top-level family shape ─────────────────────────────────────────────────

/**
 * The shared shape every family file matches. Specific families add their
 * own fields on top — `pendingManualRun` (any family) and
 * `emailsSentThisRun` (customer) are the known ones today, both optional
 * here so they don't reject when present and don't require when absent.
 */
export const AgentFamilyStateSchema = z
  .object({
    systemStatus: SystemStatus,
    lastUpdated: z.string(),
    lastRun: z.record(z.string(), z.string()),
    incidents: z.array(Incident),
    recentRemediations: z.array(RemediationAction),
    agentResults: z.record(z.string(), AgentResult),
    // Known per-family extensions (declared so they're typed if present;
    // `.passthrough()` below allows arbitrary additional fields too):
    emailsSentThisRun: z.number().int().nonnegative().optional(),
    pendingManualRun: z.boolean().optional(),
    pendingManualRunRequestedAt: z.string().optional(),
  })
  .passthrough();

export type AgentFamilyStateParsed = z.infer<typeof AgentFamilyStateSchema>;

/**
 * Schema for the `__error` sentinel that `readFamilyFile` returns on
 * corrupt JSON. Validation MUST allow this through unchanged so consumers
 * see the same sentinel they always have.
 */
export const CorruptStateSentinelSchema = z
  .object({
    __error: z.literal('state file corrupt'),
    family: z.string(),
    preservedAs: z.string(),
  })
  .passthrough();

export type CorruptStateSentinel = z.infer<typeof CorruptStateSentinelSchema>;

/**
 * Validate a family payload. Returns `{ ok: true, value }` on success or
 * `{ ok: false, issues }` on failure. The caller (`AgentStateService`)
 * decides what to do with a failure — today: log warn + return null.
 *
 * Sentinels (the `__error` corrupt-state object) pass through as-is so
 * existing callers keep seeing them.
 */
export function validateFamilyState(
  raw: unknown,
):
  | { ok: true; value: AgentFamilyStateParsed | CorruptStateSentinel | null }
  | { ok: false; issues: string[] } {
  if (raw === null || raw === undefined) return { ok: true, value: null };

  // Pass corrupt-state sentinel through unchanged — same contract as before.
  const sentinel = CorruptStateSentinelSchema.safeParse(raw);
  if (sentinel.success) return { ok: true, value: sentinel.data };

  const parsed = AgentFamilyStateSchema.safeParse(raw);
  if (parsed.success) return { ok: true, value: parsed.data };

  const issues = parsed.error.issues.slice(0, 5).map(
    (i) => `${i.path.join('.') || '<root>'}: ${i.message}`,
  );
  return { ok: false, issues };
}
