import type { AgentAI } from './agent-ai.interface';

export class OpenAIAgentAI implements AgentAI {
  constructor(_apiKey: string) {
    throw new Error(
      'OpenAIAgentAI not implemented; set AGENT_AI_PROVIDER=heuristic or wire a real adapter',
    );
  }
  async rerank(): Promise<never> { throw new Error('unreachable'); }
  async suggestNudge(): Promise<never> { throw new Error('unreachable'); }
  async analyzeContent(): Promise<never> { throw new Error('unreachable'); }
}
