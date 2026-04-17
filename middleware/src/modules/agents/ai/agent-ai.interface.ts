/**
 * AgentAI strategy contract for the middleware module.
 * Mirrors scripts/agents/lib/ai.ts — only structural signals (D13).
 */

export type TicketCategory =
  | 'billing' | 'technical' | 'content' | 'display' | 'account' | 'other';
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
export interface RankedTicket { id: string; score: number; reason: string; }

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
  | 'day1-pair-screen' | 'day3-upload-content' | 'day7-create-schedule' | 'none';
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

export interface AgentAI {
  rerank(tickets: TicketSignal[]): Promise<RankedTicket[]>;
  suggestNudge(signal: OnboardingSignal): Promise<NudgeSuggestion>;
  analyzeContent(perf: ContentPerfSignal[]): Promise<ContentRec[]>;
}

export const AGENT_AI_TOKEN = Symbol('AGENT_AI_TOKEN');
