/**
 * Canonical structural-signal types shared by:
 *   - middleware/src/modules/agents (AgentAI interface consumers)
 *   - scripts/agents/** (standalone cron workers)
 *
 * These types describe AI-safe inputs: counts, flags, enums — never raw user
 * data. A single source of truth prevents silent divergence (e.g. adding an
 * OrgTier in one file while HeuristicAgentAI falls through to 'free' in
 * another). Exported at the `@vizora/database` package root.
 */

export type TicketCategory =
  | 'billing'
  | 'technical'
  | 'content'
  | 'display'
  | 'account'
  | 'other';

export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type OrgTier = 'free' | 'starter' | 'pro' | 'enterprise';

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
  score: number;
  reason: string;
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
  hourBuckets: number[];
  impressionCount: number;
}

export interface ContentRec {
  kind: 'time-of-day' | 'underperforming' | 'rotation';
  summary: string;
  confidence: number;
  details: Record<string, number | string>;
}
