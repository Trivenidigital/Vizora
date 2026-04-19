/**
 * Vizora Agent System — AgentAI strategy interface
 *
 * The heuristic default is always available. LLM providers are stubs —
 * the factory falls back to heuristic on unknown provider (does NOT throw)
 * so a bad env value can't crash agent startup (R2 nice-3).
 */

import type {
  TicketSignal,
  RankedTicket,
  OnboardingSignal,
  NudgeSuggestion,
  ContentPerfSignal,
  ContentRec,
} from './types.js';

export interface AgentAI {
  rerank(tickets: TicketSignal[]): Promise<RankedTicket[]>;
  suggestNudge(signal: OnboardingSignal): Promise<NudgeSuggestion>;
  analyzeContent(perf: ContentPerfSignal[]): Promise<ContentRec[]>;
}

// ─── Heuristic (default, deterministic, no network) ─────────────────────────

export class HeuristicAgentAI implements AgentAI {
  async rerank(tickets: TicketSignal[]): Promise<RankedTicket[]> {
    return tickets.map((t) => {
      const priorityWeight =
        t.priority === 'urgent' ? 1.0 :
        t.priority === 'high'   ? 0.75 :
        t.priority === 'normal' ? 0.5 :
        0.25;
      const tierBoost =
        t.orgTier === 'enterprise' ? 0.15 :
        t.orgTier === 'pro'        ? 0.10 :
        t.orgTier === 'starter'    ? 0.05 :
        0;
      const ageBoost = Math.min(t.ageMinutes / 1440, 0.2); // max +0.2 after 24h
      const attachmentBoost = t.hasAttachment ? 0.05 : 0;
      const categoryBoost =
        t.category === 'billing'  ? 0.10 :
        t.category === 'display'  ? 0.08 :
        t.category === 'technical' ? 0.05 :
        0;

      const score = Math.min(
        priorityWeight + tierBoost + ageBoost + attachmentBoost + categoryBoost,
        1.0,
      );
      return {
        id: t.id,
        score,
        reason: `priority=${t.priority} tier=${t.orgTier} age=${t.ageMinutes}m`,
      };
    }).sort((a, b) => b.score - a.score);
  }

  async suggestNudge(signal: OnboardingSignal): Promise<NudgeSuggestion> {
    const { milestoneFlags: m, daysSinceSignup } = signal;
    if (daysSinceSignup >= 1 && daysSinceSignup <= 2 && !m.screenPaired) {
      return { template: 'day1-pair-screen', reason: 'no screen paired after day 1', confidence: 0.9 };
    }
    if (daysSinceSignup >= 3 && daysSinceSignup <= 4 && !m.contentUploaded) {
      return { template: 'day3-upload-content', reason: 'no content uploaded after day 3', confidence: 0.85 };
    }
    if (daysSinceSignup >= 7 && daysSinceSignup <= 10 && !m.scheduleCreated) {
      return { template: 'day7-create-schedule', reason: 'no schedule after week 1', confidence: 0.8 };
    }
    return { template: 'none', reason: 'no nudge window matched', confidence: 1.0 };
  }

  async analyzeContent(perf: ContentPerfSignal[]): Promise<ContentRec[]> {
    const recs: ContentRec[] = [];
    for (const p of perf) {
      if (p.completionRate < 0.3 && p.impressionCount > 50) {
        recs.push({
          kind: 'underperforming',
          summary: `Completion rate ${(p.completionRate * 100).toFixed(0)}% on ${p.impressionCount} impressions`,
          confidence: 0.7,
          details: { contentId: p.contentId, completionRate: p.completionRate, impressionCount: p.impressionCount },
        });
      }
      // Time-of-day: find peak hour
      const peakHour = p.hourBuckets.indexOf(Math.max(...p.hourBuckets));
      const peakShare = p.hourBuckets[peakHour] / (p.hourBuckets.reduce((a, b) => a + b, 0) || 1);
      if (peakShare > 0.25) {
        recs.push({
          kind: 'time-of-day',
          summary: `Peak engagement at ${peakHour}:00 (${(peakShare * 100).toFixed(0)}% of impressions)`,
          confidence: 0.6,
          details: { contentId: p.contentId, peakHour, peakShare },
        });
      }
    }
    return recs;
  }
}

// ─── LLM stubs (not implemented — factory logs warning and falls back) ──────

export class AnthropicAgentAI implements AgentAI {
  constructor(_apiKey: string) {
    // Stub — real implementation pending LLM provider choice
    throw new Error(
      'AnthropicAgentAI not implemented; set AGENT_AI_PROVIDER=heuristic or provide a real adapter',
    );
  }
  async rerank(): Promise<RankedTicket[]> { throw new Error('unreachable'); }
  async suggestNudge(): Promise<NudgeSuggestion> { throw new Error('unreachable'); }
  async analyzeContent(): Promise<ContentRec[]> { throw new Error('unreachable'); }
}

export class OpenAIAgentAI implements AgentAI {
  constructor(_apiKey: string) {
    throw new Error(
      'OpenAIAgentAI not implemented; set AGENT_AI_PROVIDER=heuristic or provide a real adapter',
    );
  }
  async rerank(): Promise<RankedTicket[]> { throw new Error('unreachable'); }
  async suggestNudge(): Promise<NudgeSuggestion> { throw new Error('unreachable'); }
  async analyzeContent(): Promise<ContentRec[]> { throw new Error('unreachable'); }
}

/**
 * Construct an AgentAI from the `AGENT_AI_PROVIDER` env var.
 * Unknown provider → logs warning + falls back to HeuristicAgentAI.
 * This matches the NestJS custom-provider factory pattern.
 */
export function createAgentAI(
  provider: string = process.env.AGENT_AI_PROVIDER || 'heuristic',
): AgentAI {
  switch (provider) {
    case 'heuristic':
      return new HeuristicAgentAI();
    case 'anthropic':
      try {
        return new AnthropicAgentAI(process.env.ANTHROPIC_API_KEY || '');
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[agents] anthropic adapter failed: ${err instanceof Error ? err.message : err}; falling back to heuristic`);
        return new HeuristicAgentAI();
      }
    case 'openai':
      try {
        return new OpenAIAgentAI(process.env.OPENAI_API_KEY || '');
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[agents] openai adapter failed: ${err instanceof Error ? err.message : err}; falling back to heuristic`);
        return new HeuristicAgentAI();
      }
    default:
      // eslint-disable-next-line no-console
      console.warn(`[agents] unknown AGENT_AI_PROVIDER='${provider}', falling back to heuristic`);
      return new HeuristicAgentAI();
  }
}
