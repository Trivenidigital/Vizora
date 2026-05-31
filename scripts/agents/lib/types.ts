/**
 * Vizora Agent System — Shared Types
 *
 * Structural signal types (TicketSignal, OnboardingSignal, ...) live in
 * `@vizora/database` so the middleware agents module and these cron scripts
 * share one source of truth (R4-MED3). Ops/state types are still re-exported
 * from scripts/ops/lib/types.js.
 *
 * Intentionally NO raw user data types in here — everything the AI sees must
 * be structural (counts, flags, enums) to prevent PII leak into LLM prompts
 * (D13).
 */

export type {
  Severity,
  SystemStatus,
  IncidentStatus,
  Incident,
  RemediationAction,
  AgentResult,
  OpsState,
} from '../../ops/lib/types.js';

export type {
  TicketCategory,
  TicketCategoryV2,
  TicketPriority,
  OrgTier,
  TicketSignal,
  RankedTicket,
  OnboardingSignal,
  NudgeTemplate,
  NudgeSuggestion,
  ContentPerfSignal,
  ContentRec,
} from '@vizora/database';

import type { OpsState } from '../../ops/lib/types.js';

export interface AgentFamilyState extends OpsState {
  /** Counter for lifecycle email budget (D-sec-R2-3). Persisted — NOT in-memory. */
  emailsSentThisRun?: number;
  /** Manual trigger flag set by POST /api/v1/agents/:name/run (D-arch-R2-2). */
  pendingManualRun?: boolean;
}

export type AgentFamily =
  | 'customer'
  | 'content'
  | 'fleet'
  | 'billing'
  | 'ops';
