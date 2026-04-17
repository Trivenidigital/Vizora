import { Module, Logger } from '@nestjs/common';
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
 * Agents module.
 *
 * NOTE: EventEmitterModule is registered globally at app root
 * (middleware/src/app.module.ts). Do NOT re-import it here or @OnEvent
 * listeners fire twice (D-nestjs-R2-1).
 *
 * AGENT_AI_TOKEN uses a custom factory so the provider is swappable via
 * AGENT_AI_PROVIDER env without any wrapper service (D16). Unknown
 * provider logs a warning and falls back to heuristic — a bad env value
 * cannot crash startup (R2 nice-3).
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
          logger.warn(
            `provider '${provider}' init failed (${err instanceof Error ? err.message : err}); falling back to heuristic`,
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
