import type {
  AgentAI,
  ContentPerfSignal,
  ContentRec,
  NudgeSuggestion,
  OnboardingSignal,
  RankedTicket,
  TicketSignal,
} from './agent-ai.interface';

/**
 * Stub — factory logs a warning and falls back to HeuristicAgentAI if
 * AGENT_AI_PROVIDER=anthropic is set without a real adapter.
 *
 * Parameter signatures mirror AgentAI exactly so a future implementer
 * gets full editor autocomplete when filling in the bodies.
 */
export class AnthropicAgentAI implements AgentAI {
  constructor(_apiKey: string) {
    throw new Error(
      'AnthropicAgentAI not implemented; set AGENT_AI_PROVIDER=heuristic or wire a real adapter',
    );
  }
  async rerank(_tickets: TicketSignal[]): Promise<RankedTicket[]> {
    throw new Error('AnthropicAgentAI.rerank not implemented');
  }
  async suggestNudge(_signal: OnboardingSignal): Promise<NudgeSuggestion> {
    throw new Error('AnthropicAgentAI.suggestNudge not implemented');
  }
  async analyzeContent(_perf: ContentPerfSignal[]): Promise<ContentRec[]> {
    throw new Error('AnthropicAgentAI.analyzeContent not implemented');
  }
}
