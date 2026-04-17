import { HeuristicAgentAI } from './heuristic-agent-ai';
import type { OnboardingSignal, TicketSignal } from './agent-ai.interface';

describe('HeuristicAgentAI', () => {
  const ai = new HeuristicAgentAI();

  describe('suggestNudge', () => {
    const baseFlags = {
      welcomed: true,
      screenPaired: false,
      contentUploaded: false,
      playlistCreated: false,
      scheduleCreated: false,
    };
    const baseSignal: OnboardingSignal = {
      orgId: 'o1',
      tier: 'free',
      daysSinceSignup: 0,
      milestoneFlags: baseFlags,
    };

    it('returns day1-pair-screen on day 1 when no screen paired', async () => {
      const s = await ai.suggestNudge({ ...baseSignal, daysSinceSignup: 1 });
      expect(s.template).toBe('day1-pair-screen');
    });

    it('returns day3-upload-content on day 3 when screen paired but no content', async () => {
      const s = await ai.suggestNudge({
        ...baseSignal,
        daysSinceSignup: 3,
        milestoneFlags: { ...baseFlags, screenPaired: true },
      });
      expect(s.template).toBe('day3-upload-content');
    });

    it('returns day7-create-schedule on day 8 when content uploaded but no schedule', async () => {
      const s = await ai.suggestNudge({
        ...baseSignal,
        daysSinceSignup: 8,
        milestoneFlags: {
          ...baseFlags,
          screenPaired: true,
          contentUploaded: true,
        },
      });
      expect(s.template).toBe('day7-create-schedule');
    });

    it('returns none when milestone already achieved', async () => {
      const s = await ai.suggestNudge({
        ...baseSignal,
        daysSinceSignup: 1,
        milestoneFlags: { ...baseFlags, screenPaired: true },
      });
      expect(s.template).toBe('none');
    });

    it('returns none outside nudge windows', async () => {
      const s = await ai.suggestNudge({ ...baseSignal, daysSinceSignup: 15 });
      expect(s.template).toBe('none');
    });
  });

  describe('rerank', () => {
    const mkTicket = (over: Partial<TicketSignal>): TicketSignal => ({
      id: 't',
      category: 'other',
      priority: 'normal',
      orgTier: 'free',
      deviceCount: 1,
      wordCount: 10,
      hasAttachment: false,
      ageMinutes: 0,
      ...over,
    });

    it('sorts urgent enterprise tickets above low free', async () => {
      const ranked = await ai.rerank([
        mkTicket({ id: 'low', priority: 'low', orgTier: 'free' }),
        mkTicket({ id: 'urg', priority: 'urgent', orgTier: 'enterprise' }),
      ]);
      expect(ranked[0].id).toBe('urg');
      expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
    });

    it('clamps score to 1.0 even with all boosts stacked', async () => {
      const ranked = await ai.rerank([
        mkTicket({
          priority: 'urgent',
          orgTier: 'enterprise',
          category: 'billing',
          hasAttachment: true,
          ageMinutes: 99999,
        }),
      ]);
      expect(ranked[0].score).toBeLessThanOrEqual(1.0);
    });

    it('produces deterministic scores for identical inputs', async () => {
      const a = await ai.rerank([mkTicket({ id: 'x', priority: 'high', orgTier: 'pro' })]);
      const b = await ai.rerank([mkTicket({ id: 'x', priority: 'high', orgTier: 'pro' })]);
      expect(a[0].score).toBe(b[0].score);
    });
  });
});
