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

/**
 * Finer-grained classification for Hermes / Path B conversational routing.
 * See `docs/hermes/ticket-categories-2026-04-24.md` for taxonomy rationale,
 * v1/v2/fix/escalate tiering, and the 30-day measurement gate.
 *
 * Additive only — the coarse `TicketCategory` above stays canonical for the
 * priority heuristic and existing consumers. This union is emitted into
 * `SupportRequest.aiCategory` by support-triage and is not yet wired to
 * user-visible surfaces.
 */
export type TicketCategoryV2 =
  | 'device_pairing_failed'
  | 'device_offline'
  | 'device_wrong_content'
  | 'device_playback_error'
  | 'device_display_config'
  | 'content_upload_failed'
  | 'content_not_showing'
  | 'content_expired'
  | 'content_template_broken'
  | 'content_storage_limit'
  | 'schedule_not_playing'
  | 'schedule_timezone_issue'
  | 'schedule_conflict'
  | 'schedule_coverage_gap'
  | 'analytics_missing_data'
  | 'analytics_wrong_count'
  | 'analytics_export_failed'
  | 'account_access_lost'
  | 'account_permissions'
  | 'billing_invoice_question'
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
