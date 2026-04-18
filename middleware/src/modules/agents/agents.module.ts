import { Module, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { AgentsController } from './agents.controller';
import { AgentStateService } from './agent-state.service';
import { CustomerIncidentService } from './customer-incident.service';
import { OnboardingService } from './onboarding.service';
import { AGENT_AI_TOKEN, type AgentAI } from './ai/agent-ai.interface';
import { HeuristicAgentAI } from './ai/heuristic-agent-ai';
import { AnthropicAgentAI } from './ai/anthropic-agent-ai.stub';
import { OpenAIAgentAI } from './ai/openai-agent-ai.stub';

/**
 * AgentAI stand-in used when a paid provider fails to initialize in
 * production. Every method throws 503 so AI-dependent endpoints degrade
 * visibly instead of silently falling back to heuristic — but the Nest
 * bootstrap still succeeds, so the rest of the API keeps serving.
 * (R4-review: avoids PM2 restart cascade on transient SDK init errors.)
 */
class FailedAgentAI implements AgentAI {
  constructor(private readonly reason: string) {}
  private fail(): never {
    throw new ServiceUnavailableException(
      `AI provider unavailable: ${this.reason}`,
    );
  }
  rerank(): ReturnType<AgentAI['rerank']> { return this.fail(); }
  suggestNudge(): ReturnType<AgentAI['suggestNudge']> { return this.fail(); }
  analyzeContent(): ReturnType<AgentAI['analyzeContent']> { return this.fail(); }
}

/**
 * Agents module.
 *
 * NOTE: EventEmitterModule is registered globally at app root
 * (middleware/src/app.module.ts). Do NOT re-import it here or @OnEvent
 * listeners fire twice (D-nestjs-R2-1).
 *
 * AGENT_AI_TOKEN uses a custom factory so the provider is swappable via
 * AGENT_AI_PROVIDER env without any wrapper service (D16).
 *
 * Behavior on bad config:
 *   - Unknown provider name: warn + heuristic fallback (typo shouldn't crash).
 *   - Provider explicitly set to anthropic/openai but init fails:
 *       dev/test → warn + heuristic fallback (keep iteration loop cheap).
 *       production → install a FailedAgentAI proxy. Bootstrap still succeeds,
 *       but every AI-dependent endpoint returns 503 with a sanitized reason,
 *       so operators see the outage without taking down the whole API.
 *       (R4-MED9 + review follow-up.)
 */
@Module({
  imports: [DatabaseModule, ConfigModule],
  providers: [
    AgentStateService,
    OnboardingService,
    CustomerIncidentService,
    {
      provide: AGENT_AI_TOKEN,
      useFactory: (cfg: ConfigService): AgentAI => {
        const logger = new Logger('AgentAIFactory');
        const provider = cfg.get<string>('AGENT_AI_PROVIDER', 'heuristic');
        const isProd = cfg.get<string>('NODE_ENV') === 'production';
        try {
          switch (provider) {
            case 'heuristic':
              return new HeuristicAgentAI();
            case 'anthropic':
              return new AnthropicAgentAI(cfg.get<string>('ANTHROPIC_API_KEY', ''));
            case 'openai':
              return new OpenAIAgentAI(cfg.get<string>('OPENAI_API_KEY', ''));
            default:
              logger.warn(`unknown AGENT_AI_PROVIDER='${provider}', falling back to heuristic`);
              return new HeuristicAgentAI();
          }
        } catch (err) {
          // Sanitize err.message — provider init errors may contain API keys
          // (e.g. "invalid key sk-abc..."). Strip sk- / key= style tokens.
          const raw = err instanceof Error ? err.message : String(err);
          const safe = raw
            .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-***')
            .replace(/(api[_-]?key|token|secret)\s*[:=]\s*\S+/gi, '$1=***');
          if (isProd && provider !== 'heuristic') {
            // Never rethrow the raw err — its .stack may include request
            // headers / Authorization bearer values from the SDK's HTTP client.
            // Surface only the sanitized summary and install a 503 proxy so the
            // rest of Nest can bootstrap normally.
            logger.error(
              `provider '${provider}' init failed in production: ${safe}`,
            );
            return new FailedAgentAI(safe);
          }
          logger.warn(
            `provider '${provider}' init failed (${safe}); falling back to heuristic`,
          );
          return new HeuristicAgentAI();
        }
      },
      inject: [ConfigService],
    },
  ],
  controllers: [AgentsController],
  exports: [OnboardingService, CustomerIncidentService, AGENT_AI_TOKEN],
})
export class AgentsModule {}
