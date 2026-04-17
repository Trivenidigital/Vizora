# Vizora Agent System — Design Spec

**Date:** 2026-04-17
**Branch:** `feat/agent-system`
**Supersedes:** `docs/superpowers/plans/2026-04-17-agent-system-plan.md`
**Review cycle 1:** architect, security, nestjs-review — all must-fix items folded in (D1–D20)
**Review cycle 2:** same three reviewers — all must-fix + cheap nice-to-fix items folded in (D-arch-R2-*, D-sec-R2-*, D-nestjs-R2-*)

## Summary

Six customer-facing automation agents built on the existing `scripts/ops/` pattern, split into two layers:

- **External scripts** (`scripts/agents/*.ts`) — PM2 cron, pure read/aggregate, call middleware HTTP API
- **In-process NestJS module** (`middleware/src/modules/agents/`) — owns writes to new Prisma tables, event-driven onboarding tracking, admin HTTP endpoints

2 agents implemented end-to-end (Customer Lifecycle, Support Triage), 4 scaffolded (env-gated, default OFF). LLM-ready via `AgentAI` strategy interface with heuristic default.

## Architecture

### Write-ownership boundaries (D1, D2)

| Entity | Sole writer | Readers |
|---|---|---|
| `Organization.subscriptionStatus` | `BillingLifecycleService` (existing in-process cron) | `billing-revenue.ts` (read-only) |
| `OrganizationOnboarding` | `OnboardingService` (in-process, event-driven) | `customer-lifecycle.ts` (read + nudge send) |
| `CustomerIncident` | `CustomerIncidentService` (in-process, called via API) | all agents (via API), orchestrator |
| `ContentRecommendation` | `ContentIntelligenceService` (in-process) | `content-intelligence.ts` script |
| `SupportRequest`/`SupportMessage` | `SupportService` (existing) | `support-triage.ts` (via API) |
| `logs/agent-state/orchestrator.json` | `agent-orchestrator.ts` only | middleware admin endpoints |
| `logs/agent-state/{customer,content,fleet,billing}.json` | Each respective agent script only | Orchestrator (read-only) |

**Rule:** Orchestrator is forbidden from writing to any state file other than its own. Cross-cutting incidents go to `CustomerIncident` table via `POST /api/v1/agents/incidents`.

### Component diagram

```
┌───────────────────── middleware (NestJS, in-process) ──────────────────────┐
│                                                                             │
│  EventEmitter2 ─ user.welcomed        OnboardingService                     │
│                 ─ display.paired  ──▶ @OnEvent listeners                    │
│                 ─ content.created                                           │
│                 ─ playlist.created                                          │
│                 ─ schedule.created                                          │
│                                                                             │
│  AgentsModule                                                               │
│  ├── AgentsController  (admin-only, @SkipOutputSanitize at class level)     │
│  ├── OnboardingService (event listeners + milestone writer)                 │
│  ├── CustomerIncidentService (writer for CustomerIncident)                  │
│  ├── AgentStateService (reads logs/agent-state/*.json with sanitization)    │
│  └── AGENT_AI_TOKEN provider (useFactory, Symbol) → AgentAI                 │
│                                                                             │
│  BillingLifecycleService (existing, sole writer to subscriptionStatus)      │
└─────────────────────────────────────────────────────────────────────────────┘
                           ▲ HTTP API
                           │
┌──────────────── scripts/agents/ (PM2 cron, standalone Node) ────────────────┐
│                                                                             │
│  scripts/agents/lib/                                                        │
│  ├── ai.ts (AgentAI interface, HeuristicAgentAI, stubs)                     │
│  ├── alerting.ts (re-export + sendCustomerEmail with safeguards)            │
│  ├── api-client.ts (re-export scripts/ops/lib/api-client.ts)                │
│  ├── state.ts (parameterized, per-family locks)                             │
│  └── types.ts (extended with lifecycle types)                               │
│                                                                             │
│  customer-lifecycle.ts  */30 * * * *  IMPLEMENTED                           │
│  support-triage.ts      */5  * * * *  IMPLEMENTED                           │
│  screen-health-customer.ts  */10 * * * *  SCAFFOLD                          │
│  billing-revenue.ts     0 */2 * * *   SCAFFOLD (read-only)                  │
│  content-intelligence.ts  0 4 * * *   SCAFFOLD                              │
│  agent-orchestrator.ts  */15 * * * *  SCAFFOLD                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Interface contracts

### `AgentAI` (D4, D13)

```typescript
// scripts/agents/lib/ai.ts

/**
 * Structural signals only — no raw PII, emails, tokens, or billing data.
 * All fields are type-restricted to prevent accidental leak into LLM prompts.
 */
export type TicketCategory =
  | 'billing' | 'technical' | 'content' | 'display' | 'account' | 'other';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type OrgTier = 'free' | 'starter' | 'pro' | 'enterprise';

export interface TicketSignal {
  id: string;
  category: TicketCategory;   // constrained (nestjs-R2-2)
  priority: TicketPriority;   // constrained
  orgTier: OrgTier;
  deviceCount: number;
  wordCount: number;          // not the words themselves
  hasAttachment: boolean;
  ageMinutes: number;
}

export interface RankedTicket {
  id: string;
  score: number;          // 0.0-1.0
  reason: string;         // short, sanitized
}

export interface OnboardingSignal {
  orgId: string;
  tier: string;
  milestoneFlags: {
    welcomed: boolean;
    screenPaired: boolean;
    contentUploaded: boolean;
    playlistCreated: boolean;
    scheduleCreated: boolean;
  };
  daysSinceSignup: number;
}

export interface NudgeSuggestion {
  template: 'day1-pair-screen' | 'day3-upload-content' | 'day7-create-schedule' | 'none';
  reason: string;
  confidence: number;
}

export interface ContentPerfSignal {
  contentId: string;
  avgDwellSeconds: number;
  completionRate: number;
  hourBuckets: number[];  // 24 values
  impressionCount: number;
}

export interface ContentRec {
  kind: 'time-of-day' | 'underperforming' | 'rotation';
  summary: string;        // short, <200 chars, no user data
  confidence: number;
  details: Record<string, number | string>; // structural only
}

/**
 * Swappable provider. Default: HeuristicAgentAI. Factory reads AGENT_AI_PROVIDER.
 * Unknown values log a warning and fall back to heuristic (NOT throw).
 */
export interface AgentAI {
  rerank(tickets: TicketSignal[]): Promise<RankedTicket[]>;
  suggestNudge(signal: OnboardingSignal): Promise<NudgeSuggestion>;
  analyzeContent(perf: ContentPerfSignal[]): Promise<ContentRec[]>;
}
```

### Middleware DI registration (D16)

```typescript
// middleware/src/modules/agents/agents.module.ts

export const AGENT_AI_TOKEN = Symbol('AGENT_AI_TOKEN');

@Module({
  // EventEmitterModule is registered globally at app root — do NOT re-import
  // here or listeners fire twice (nestjs-R2-1).
  imports: [DatabaseModule, ConfigModule],
  providers: [
    AgentStateService,
    OnboardingService,
    CustomerIncidentService,
    {
      provide: AGENT_AI_TOKEN,
      useFactory: (cfg: ConfigService): AgentAI => {
        const provider = cfg.get<string>('AGENT_AI_PROVIDER', 'heuristic');
        switch (provider) {
          case 'anthropic':
            return new AnthropicAgentAI(cfg.get<string>('ANTHROPIC_API_KEY', ''));
          case 'openai':
            return new OpenAIAgentAI(cfg.get<string>('OPENAI_API_KEY', ''));
          case 'heuristic':
            return new HeuristicAgentAI();
          default:
            // Unknown provider → fall back, log warning (D-arch-7)
            // eslint-disable-next-line no-console
            console.warn(`[agents] unknown AGENT_AI_PROVIDER='${provider}', falling back to heuristic`);
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
```

### OnboardingService — event-driven (D15)

```typescript
@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly events: EventEmitter2, // for testing only; listeners wire via decorators
  ) {}

  /**
   * ALL milestone methods are idempotent — upsert with coalesce.
   * orgId is derived from event payload. Event publishers must include
   * a trusted orgId (JWT-derived in the calling service).
   */

  @OnEvent('user.welcomed', { async: true })
  async onUserWelcomed(evt: { orgId: string; userId: string }): Promise<void> {
    await this.markMilestone(evt.orgId, 'welcomeEmailSentAt');
  }

  @OnEvent('display.paired', { async: true })
  async onDisplayPaired(evt: { orgId: string; displayId: string }): Promise<void> {
    await this.markMilestone(evt.orgId, 'firstScreenPairedAt');
  }

  @OnEvent('content.created', { async: true })
  async onContentCreated(evt: { orgId: string; contentId: string }): Promise<void> {
    await this.markMilestone(evt.orgId, 'firstContentUploadedAt');
  }

  @OnEvent('playlist.created', { async: true })
  async onPlaylistCreated(evt: { orgId: string; playlistId: string }): Promise<void> {
    await this.markMilestone(evt.orgId, 'firstPlaylistCreatedAt');
  }

  @OnEvent('schedule.created', { async: true })
  async onScheduleCreated(evt: { orgId: string; scheduleId: string }): Promise<void> {
    await this.markMilestone(evt.orgId, 'firstScheduleCreatedAt');
  }

  /**
   * Private — never exposed to HTTP. Idempotent by design: single upsert with
   * empty `update` block means re-firing the event is a no-op on already-set
   * timestamps. Race-safe via Postgres ON CONFLICT DO UPDATE atomicity.
   *
   * NOTE: `suppressErrors` is NOT a real EventEmitter2 option — the inner
   * try/catch is the authoritative error guard (D3, fire-and-forget).
   *
   * NOTE: orgId comes from event payload, which originates from JWT-derived
   * `user.organizationId` in the publishing service (D6). Event publishers
   * MUST NOT accept orgId from request body/params.
   */
  private async markMilestone(
    orgId: string,
    field:
      | 'welcomeEmailSentAt'
      | 'firstScreenPairedAt'
      | 'firstContentUploadedAt'
      | 'firstPlaylistCreatedAt'
      | 'firstScheduleCreatedAt',
  ): Promise<void> {
    try {
      await this.db.organizationOnboarding.upsert({
        where: { organizationId: orgId },
        create: {
          organizationId: orgId,
          [field]: new Date(),
        },
        // Empty update → on conflict, existing timestamps are preserved.
        // Re-firing the event becomes a no-op. No second coalesce query needed.
        update: {},
      });
      // Single coalesce: if row existed WITHOUT this field set, fill it.
      await this.db.organizationOnboarding.updateMany({
        where: {
          organizationId: orgId,
          [field]: null,
        },
        data: { [field]: new Date() },
      });
    } catch (err) {
      // Fire-and-forget — never break the publisher's operation (D3)
      this.logger.warn(
        `markMilestone failed for org=${orgId} field=${field}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
```

Event publishers must add one line to their existing code:

```typescript
// pairing.service.ts — completePairing() (actual emit site; D-arch-R2-5)
this.events.emit('display.paired', { orgId: display.organizationId, displayId: display.id });

// auth.service.ts (after sendWelcomeEmail)
this.events.emit('user.welcomed', { orgId: newUser.organizationId, userId: newUser.id });

// content.service.ts (after create)
this.events.emit('content.created', { orgId: user.organizationId, contentId: content.id });

// playlists.service.ts, schedules.service.ts — same pattern
```

All `orgId` values come from `user.organizationId` (authenticated JWT claim), never from request body/params (D6).

## Prisma schema additions (D5)

```prisma
model OrganizationOnboarding {
  id                        String   @id @default(cuid())
  organizationId            String   @unique
  organization              Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  welcomeEmailSentAt        DateTime?
  firstScreenPairedAt       DateTime?
  firstContentUploadedAt    DateTime?
  firstPlaylistCreatedAt    DateTime?
  firstScheduleCreatedAt    DateTime?

  day1NudgeSentAt           DateTime?
  day3NudgeSentAt           DateTime?
  day7NudgeSentAt           DateTime?

  completedAt               DateTime?
  createdAt                 DateTime @default(now())
  updatedAt                 DateTime @updatedAt

  // NOTE: @@index([organizationId]) dropped — @unique already creates the index (D5)
}

model CustomerIncident {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  agent           String   // 'screen-health-customer' | 'billing-revenue' | ...
  type            String   // 'cluster-offline' | 'failed-payment-retry-exhausted' | ...
  severity        String   // 'critical' | 'warning' | 'info'
  target          String
  targetId        String
  message         String   @db.Text
  remediation     String   @db.Text

  status          String   @default("open")  // 'open' | 'resolved' | 'escalated'
  detectedAt      DateTime @default(now())
  resolvedAt      DateTime?
  notifiedAt      DateTime?

  @@index([organizationId, status])
  @@index([agent, type])
  // `@@index([organizationId, targetId])` intentionally NOT added — orchestrator
  // correlation uses `organizationId + status='open'` (covered by first index).
  // targetId joins happen in-memory after filtering by org. (arch-R2-3)
}

model ContentRecommendation {
  id              String   @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  kind            String   // 'time-of-day' | 'underperforming' | 'rotation-frequency'
  contentId       String?
  playlistId      String?

  summary         String   @db.Text
  details         Json
  confidence      Float

  createdAt       DateTime @default(now())
  dismissedAt     DateTime?

  @@index([organizationId, createdAt])
}

// Modify existing SupportMessage to add authorType (D7)
// The SupportMessage table already has a `role` field ('user'|'assistant'|'admin')
// — we will use role='agent' convention rather than adding a new column,
// since 'assistant' semantically covers automated responses but 'agent'
// is clearer. Decision: add `authorType` to distinguish automated from human.

model SupportMessage {
  // existing fields...
  authorType      String   @default("user")  // 'user' | 'admin' | 'agent'
  // ...
}
```

**Migration safety:** All three new tables are additive. `SupportMessage.authorType` is additive with a safe default. No alters, no drops. Safe for prod.

## Customer Lifecycle agent — `scripts/agents/customer-lifecycle.ts`

### Safeguards (D10, D11, D12)

```typescript
import { createHash } from 'node:crypto';

const MAX_EMAILS_PER_RUN = 50;
const LIFECYCLE_LIVE = process.env.LIFECYCLE_LIVE === 'true';
const TEST_EMAILS = (process.env.LIFECYCLE_TEST_EMAILS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

/** SHA-256 first-10-hex of email for audit (D-sec-R2-1 — no PII in logs). */
function maskEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 10);
}

/**
 * Resolve recipient list.
 * - TEST_EMAILS non-empty → redirect to ALL allowlist entries (not just [0])
 *   so a multi-recipient allowlist actually gets all mail (D-sec-R2-2).
 * - LIFECYCLE_LIVE true → org admin real email.
 * - else → empty (dry-run).
 */
function resolveRecipients(orgAdmin: { email: string }): string[] {
  if (TEST_EMAILS.length > 0) return [...TEST_EMAILS];
  if (LIFECYCLE_LIVE) return [orgAdmin.email];
  return [];
}

async function sendCustomerEmail(
  orgAdmin: { email: string },
  template: string,
  payload: { orgId: string },
  state: AgentState, // passed in — for persisted counter (D-sec-R2-3)
) {
  const recipients = resolveRecipients(orgAdmin);
  const action = {
    type: 'lifecycle-send-decision',
    orgId: payload.orgId,
    template,
    recipientCount: recipients.length,
    recipientHashes: recipients.map(maskEmail), // masked; no PII
    wouldSend: recipients.length > 0,
    ts: new Date().toISOString(),
  };

  // Structured JSON audit — grep-able, no PII
  process.stdout.write(JSON.stringify(action) + '\n');

  if (recipients.length === 0) return;
  for (const to of recipients) {
    await mailApi.send(to, template, payload);
    state.emailsSentThisRun += 1;          // mutate persisted counter
    await writeAgentState('customer', state); // flush immediately — manual
                                              // re-trigger cannot reset the budget
  }
}
```

**Persisted counter rationale (D-sec-R2-3):** `emailsSentThisRun` lives in `logs/agent-state/customer.json`, not an in-memory variable. A manual `POST /api/v1/agents/customer-lifecycle/run` while a scheduled run is in flight sees the same counter and cannot double-blast. Counter resets at the start of each scheduled cron (first line of `main()`): `state.emailsSentThisRun = 0;`.

### Logic flow

1. Query candidate orgs (deterministic ordering prevents starvation at `LIMIT 200`):
   ```sql
   SELECT org.id, org.createdAt, onboarding.*
   FROM Organization org
   LEFT JOIN OrganizationOnboarding onboarding ON onboarding.organizationId = org.id
   WHERE org.createdAt > now() - interval '30 days'
     AND (onboarding.completedAt IS NULL)
   ORDER BY org.createdAt ASC   -- oldest un-nudged first (R2 nice-7)
   LIMIT 200
   ```
2. For each org, compute `daysSinceSignup` and build `OnboardingSignal`.
3. Call `ai.suggestNudge(signal)` — heuristic default:
   - Day 1–2 + no `firstScreenPairedAt` → `day1-pair-screen`
   - Day 3–4 + no `firstContentUploadedAt` → `day3-upload-content`
   - Day 7–10 + no `firstScheduleCreatedAt` → `day7-create-schedule`
   - else → `none`
4. Transaction per org:
   ```typescript
   await db.$transaction(async (tx) => {
     const current = await tx.organizationOnboarding.findUnique({ where: { organizationId: orgId } });
     if (current[nudgeCol] !== null) return;      // already sent — dedup (D11)
     if (emailsSentThisRun >= MAX_EMAILS_PER_RUN) {
       abort = true; return;                        // circuit breaker (D10)
     }
     await tx.organizationOnboarding.update({
       where: { organizationId: orgId },
       data: { [nudgeCol]: new Date() },
     });
     await sendCustomerEmail(admin, template, { orgId });
     emailsSentThisRun++;
   });
   ```
5. If `abort`, write a CRITICAL incident to `logs/agent-state/customer.json` and Slack-alert operators via existing alerting.
6. Auto-complete orgs > 7 days old with `completedAt=now()` to skip future nudges (backfill-less).

### State file `logs/agent-state/customer.json`

Same shape as ops state, with `agent: 'customer-lifecycle'` entries.

## Support Triage agent — `scripts/agents/support-triage.ts`

### Scope

- Runs every 5 minutes
- Picks 20 most recent `SupportRequest` rows with `status='open'` and not already touched by agent (no `SupportMessage` with `authorType='agent'` in the thread — D7)
- For each: builds `TicketSignal`, calls `ai.rerank([...tickets])` → `RankedTicket[]`
- Writes agent summary + suggested reply to `SupportMessage` row with `authorType='agent'` (visible to admins only; customers see it only if admin unhides — configurable)
- Updates priority on `SupportRequest` if re-rank differs from heuristic priority by >0.4

### Cross-org guard (D8)

Every DB query:
```typescript
await db.supportRequest.findMany({
  where: {
    organizationId: targetOrgId,  // always explicit, never implicit
    status: 'open',
    messages: {
      none: { authorType: 'agent' },
    },
  },
  ...
});
```

Agent never calls a SupportRequest without a known `organizationId` in the query. The triage script iterates orgs one at a time.

### Prompt-injection defense (for future LLM adapter)

`buildTicketSignal()` never includes raw message body in `TicketSignal`. Only structural counts (wordCount, hasAttachment). When the LLM adapter later needs content, a separate sanitization pass (HTML-strip + 2000-char truncate + prompt-template with hard system/user boundary) will be required in the adapter itself.

### Reply-loop prevention (D7)

New messages with `authorType='agent'` are excluded from triage queries. Triage cannot trigger itself.

## Four scaffolded agents

Each is a functional file that early-exits if `*_ENABLED !== 'true'`:

```typescript
// scripts/agents/billing-revenue.ts (template for all 4)
import { log } from './lib/alerting.js';

const AGENT = 'billing-revenue';
const ENABLED = process.env.BILLING_REVENUE_ENABLED === 'true';

async function main() {
  if (!ENABLED) {
    log(AGENT, 'disabled via env — exiting');
    process.exitCode = 0;
    return;
  }
  log(AGENT, 'scaffold — full implementation pending');
  // TODO: MRR snapshot, anomaly detection
  process.exitCode = 0;
}

main().catch(err => { log(AGENT, `fatal: ${err}`); process.exitCode = 1; });
```

Four scaffolds:
- `screen-health-customer.ts` — per-org offline cluster detection (customer-facing)
- `billing-revenue.ts` — **read-only** MRR + anomaly detection (D1)
- `content-intelligence.ts` — content-perf analysis
- `agent-orchestrator.ts` — reads all family state + correlates by `organizationId` first (D14), writes only to own state + `CustomerIncident` via API (D2)

## NestJS module — `middleware/src/modules/agents/`

### Files

```
agents/
├── agents.module.ts
├── agents.controller.ts          (@SkipOutputSanitize, class-level AdminGuard — D17/D18)
├── dto/
│   └── agent-status-query.dto.ts (page, limit — D20)
├── onboarding.service.ts         (event listeners — D15, D3)
├── customer-incident.service.ts
├── agent-state.service.ts        (disk reads + sanitization — D9/D19)
└── ai/
    ├── agent-ai.interface.ts     (exports AgentAI, signals)
    ├── heuristic-agent-ai.ts
    ├── anthropic-agent-ai.stub.ts
    └── openai-agent-ai.stub.ts
```

### Controller

```typescript
@Controller('api/v1/agents')
@UseGuards(JwtAuthGuard, AdminGuard) // class-level (D18)
@SkipOutputSanitize()                 // class-level (D17)
export class AgentsController {
  constructor(
    private readonly state: AgentStateService,
    private readonly incidents: CustomerIncidentService,
  ) {}

  @Get('status')
  async status(@Query() q: AgentStatusQueryDto) {  // pagination (D20)
    return this.state.aggregateStatus(q.page, q.limit);
  }

  @Get(':name/state')
  async agentState(@Param('name') name: string) {
    return this.state.read(name);  // includes sanitization (D9)
  }

  /**
   * Manual agent re-run, strictly allowlisted to prevent shell injection
   * via `:name` param (arch-R2-2). No child_process.spawn with user input.
   * Instead: enqueue a flag in the state file, and PM2 cron picks it up
   * on next tick (<=5min latency). For immediate runs, admins use PM2 CLI
   * directly. Endpoint returns 202 Accepted.
   */
  private static readonly RUNNABLE = new Set([
    'customer-lifecycle',
    'support-triage',
    'screen-health-customer',
    'billing-revenue',
    'content-intelligence',
    'agent-orchestrator',
  ]);

  @Post(':name/run')
  @HttpCode(202)
  async trigger(@Param('name') name: string) {
    if (!AgentsController.RUNNABLE.has(name)) {
      throw new BadRequestException('unknown agent');
    }
    return this.state.enqueueManualRun(name);  // writes `pendingManualRun: true`
                                               // into the agent's state file.
                                               // NO child_process. NO shell.
  }

  @Post('incidents')
  async createIncident(@Body() dto: CreateCustomerIncidentDto) {
    return this.incidents.create(dto);
  }
}
```

### `AgentStateService.read()` sanitization (D9)

```typescript
private static readonly FORBIDDEN_KEY_REGEX =
  /token|secret|key|password|apiKey|webhook|jwt|credential|auth|cookie|session|private|access/i;

private sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(v => this.sanitize(v));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (AgentStateService.FORBIDDEN_KEY_REGEX.test(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = this.sanitize(v);
      }
    }
    return out;
  }
  return value;
}
```

## PM2 entries (env-gated)

```javascript
// ecosystem.config.js additions
{
  name: 'agent-customer-lifecycle',
  script: 'scripts/agents/customer-lifecycle.ts',
  interpreter: 'node',
  interpreter_args: '--loader ts-node/esm',
  cron_restart: '*/30 * * * *',
  autorestart: false,
  max_memory_restart: '256M',
  env: {
    VALIDATOR_BASE_URL: 'http://localhost:3000',
    CUSTOMER_LIFECYCLE_ENABLED: 'true',
    LIFECYCLE_LIVE: 'false',
  },
},
{
  name: 'agent-support-triage',
  script: 'scripts/agents/support-triage.ts',
  cron_restart: '*/5 * * * *',
  env: {
    VALIDATOR_BASE_URL: 'http://localhost:3000',
    SUPPORT_TRIAGE_ENABLED: 'true',
    SUPPORT_TRIAGE_AUTO_RESPOND: 'false', // dry-run by default
  },
},
// 4 more scaffolds with *_ENABLED=false
```

## Testing

### Middleware (Jest, partial DatabaseService mocks per existing convention)

- `onboarding.service.spec.ts` — 5 event-handler paths; idempotent coalesce; error isolation (never throws through to publisher)
- `agent-state.service.spec.ts` — sanitization recursive walk; forbidden-key redaction at every depth
- `customer-incident.service.spec.ts` — create, resolve, org-scoped query
- `agents.controller.spec.ts` — admin guard, pagination, sanitization round-trip

### Agent scripts (Vitest, under `scripts/agents/__tests__/`)

- `customer-lifecycle.nudge-selector.spec.ts` — heuristic rules (day 1/3/7)
- `customer-lifecycle.circuit-breaker.spec.ts` — MAX_EMAILS_PER_RUN stops batch
- `customer-lifecycle.test-allowlist.spec.ts` — `LIFECYCLE_TEST_EMAILS` overrides live
- `customer-lifecycle.dedup.spec.ts` — already-sent-timestamp skips send
- `support-triage.reply-loop.spec.ts` — agent messages excluded from triage
- `support-triage.org-scope.spec.ts` — queries always include organizationId
- `support-triage.rerank.spec.ts` — heuristic AI produces deterministic scores
- `agent-state.path-isolation.spec.ts` — per-family lock files don't collide

### No E2E.

## Non-goals confirmed

- ClickHouse wiring deferred
- Customer-facing Next.js UI deferred (JSON endpoints only)
- Production deploy: stop at PR
- LLM adapter implementation: stubs only, factory falls back to heuristic
- Razorpay test coverage: Stripe-only in Billing scaffold

## Risk register (final)

| Risk | Controls |
|---|---|
| Mass nudge email | D10 circuit breaker, D11 per-org dedup in txn, D12 test allowlist, D3 dry-run default |
| Cross-org data leak | D6 JWT-derived orgId, D8 explicit orgId scope on every triage query, D14 orchestrator groups by org first |
| Reply loop in triage | D7 authorType filter |
| State-file credential exfil | D9 recursive key redaction on admin endpoint |
| Duplicate billing writes | D1 read-only billing-revenue |
| Orchestrator race | D2 orchestrator writes only own state + DB |
| Onboarding service breaks pairing | D3 fire-and-forget via inner try/catch (no `suppressErrors`, that option doesn't exist on `@OnEvent`) |
| Mass email on manual re-trigger | Counter persisted to state file, not in-memory (D-sec-R2-3) |
| PII (emails) in agent audit logs | SHA-256 hash first-10-hex in JSON audit (D-sec-R2-1) |
| Test allowlist single-recipient bug | TEST_EMAILS iterated in full, not index 0 (D-sec-R2-2) |
| Shell injection via manual-run endpoint | Allowlist Set + state-file flag, no child_process (D-arch-R2-2) |
| markMilestone overwriting timestamps | `update: {}` on upsert — race-safe no-op (D-arch-R2-1, D-nestjs-R2-2) |
| LLM PII leak | D13 structural-signals-only interface |
| Unknown LLM provider at boot | Factory falls back to heuristic + warning log |

## Acceptance criteria

- [ ] Build + typecheck pass
- [ ] All 16+ new unit tests pass
- [ ] Prisma migration applies cleanly to dev DB
- [ ] `logs/agent-state/customer.json` appears after first `customer-lifecycle` cycle (smoke)
- [ ] `logs/agent-state/orchestrator.json` remains read-only to other agents
- [ ] `GET /api/v1/agents/status` returns aggregate JSON, sanitized
- [ ] Dry-run audit log written in JSON format per email decision
- [ ] 3 code-review agents sign off on the diff

## Out of scope explicitly

- Prod deploy
- LLM provider choice
- Customer-facing dashboard pages
- Email cadence live mode (requires separate go-live checklist)
- Razorpay deep testing
