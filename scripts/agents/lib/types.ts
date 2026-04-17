/**
 * Vizora Agent System — Shared Types
 *
 * Extends the ops-layer types with agent-specific signals.
 * Intentionally NO raw user data types in here — everything the AI sees
 * must be structural (counts, flags, enums) to prevent PII leak into
 * LLM prompts (D13).
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

// ─── Constrained unions (R2 nice-to-fix) ────────────────────────────────────

export type TicketCategory =
  | 'billing'
  | 'technical'
  | 'content'
  | 'display'
  | 'account'
  | 'other';

export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type OrgTier = 'free' | 'starter' | 'pro' | 'enterprise';

// ─── Structural signals (AI input; no PII) ──────────────────────────────────

export interface TicketSignal {
  id: string;
  category: TicketCategory;
  priority: TicketPriority;
  orgTier: OrgTier;
  deviceCount: number;
  wordCount: number;
  hasAttachment: boolean;
  ageMinutes: number;
}

export interface RankedTicket {
  id: string;
  score: number;   // 0.0 – 1.0
  reason: string;  // short, sanitized
}

export interface OnboardingSignal {
  orgId: string;
  tier: OrgTier;
  milestoneFlags: {
    welcomed: boolean;
    screenPaired: boolean;
    contentUploaded: boolean;
    playlistCreated: boolean;
    scheduleCreated: boolean;
  };
  daysSinceSignup: number;
}

export type NudgeTemplate =
  | 'day1-pair-screen'
  | 'day3-upload-content'
  | 'day7-create-schedule'
  | 'none';

export interface NudgeSuggestion {
  template: NudgeTemplate;
  reason: string;
  confidence: number;
}

export interface ContentPerfSignal {
  contentId: string;
  avgDwellSeconds: number;
  completionRate: number;
  hourBuckets: number[];   // 24 values
  impressionCount: number;
}

export interface ContentRec {
  kind: 'time-of-day' | 'underperforming' | 'rotation';
  summary: string;   // <200 chars, no user data
  confidence: number;
  details: Record<string, number | string>;
}

// ─── Per-family agent state (extends OpsState) ──────────────────────────────

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
