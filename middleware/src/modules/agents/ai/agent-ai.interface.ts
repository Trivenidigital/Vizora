/**
 * AgentAI strategy contract for the middleware module.
 *
 * Structural signal types are imported from `@vizora/database` so they cannot
 * drift from the standalone cron scripts (R4-MED3).
 */

export type {
  TicketCategory,
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

import type {
  TicketSignal,
  RankedTicket,
  OnboardingSignal,
  NudgeSuggestion,
  ContentPerfSignal,
  ContentRec,
} from '@vizora/database';

export interface AgentAI {
  rerank(tickets: TicketSignal[]): Promise<RankedTicket[]>;
  suggestNudge(signal: OnboardingSignal): Promise<NudgeSuggestion>;
  analyzeContent(perf: ContentPerfSignal[]): Promise<ContentRec[]>;
}

export const AGENT_AI_TOKEN = Symbol('AGENT_AI_TOKEN');
