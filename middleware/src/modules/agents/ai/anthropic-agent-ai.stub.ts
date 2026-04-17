import type { AgentAI } from './agent-ai.interface';

/**
 * Stub — factory logs a warning and falls back to HeuristicAgentAI if
 * AGENT_AI_PROVIDER=anthropic is set without a real adapter.
 */
export class AnthropicAgentAI implements AgentAI {
  constructor(_apiKey: string) {
    throw new Error(
      'AnthropicAgentAI not implemented; set AGENT_AI_PROVIDER=heuristic or wire a real adapter',
    );
  }
  async rerank(): Promise<never> { throw new Error('unreachable'); }
  async suggestNudge(): Promise<never> { throw new Error('unreachable'); }
  async analyzeContent(): Promise<never> { throw new Error('unreachable'); }
}
