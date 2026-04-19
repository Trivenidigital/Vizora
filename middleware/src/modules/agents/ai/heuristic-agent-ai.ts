import type {
  AgentAI,
  TicketSignal, RankedTicket,
  OnboardingSignal, NudgeSuggestion,
  ContentPerfSignal, ContentRec,
} from './agent-ai.interface';

/** Deterministic, no-network default. Mirrors scripts/agents/lib/ai.ts. */
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
      const ageBoost = Math.min(t.ageMinutes / 1440, 0.2);
      const attachmentBoost = t.hasAttachment ? 0.05 : 0;
      const categoryBoost =
        t.category === 'billing'   ? 0.10 :
        t.category === 'display'   ? 0.08 :
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
      const peakHour = p.hourBuckets.indexOf(Math.max(...p.hourBuckets));
      const totalImpr = p.hourBuckets.reduce((a, b) => a + b, 0);
      const peakShare = totalImpr > 0 ? p.hourBuckets[peakHour] / totalImpr : 0;
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
