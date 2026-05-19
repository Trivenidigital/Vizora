# O7 — Configurable Downtime Alert Rules — Design

**Plan ref:** `tasks/plans/o7-configurable-alert-rules-plan.md`
**Drift-check tag:** `extends-Hermes`
**Branch:** `feat/o7-configurable-alert-rules`

This is the implementation layer of the plan — concrete file shapes, code skeletons, migration SQL, test cases. The plan owns *what + why*; this owns *exactly how*.

## Hermes-first capability checklist

All design decisions stay inside Vizora middleware (NestJS, TypeScript, Prisma). Hermes substrate is orthogonal as documented in the plan.

| # | Step | Tag | Why |
|---|------|-----|-----|
| 1 | Prisma model + migration | `[net-new]` | Vizora schema |
| 2 | `AlertRulesService` (CRUD + cross-org guard) | `[net-new]` | NestJS DI |
| 3 | `AlertRuleEvaluator` (`@OnEvent` handler) | `[net-new]` | NestJS event bus |
| 4 | Channel dispatchers (in_app/email/slack) | `[net-new]` | Vizora MailService + Notification table |
| 5 | REST controller + DTOs | `[net-new]` | NestJS controllers |
| 6 | Migration data seed for existing orgs | `[net-new]` | Prisma migrate |
| 7 | Unit tests | `[net-new]` | Jest + mocked Prisma |
| 8 | Module wiring (add MailModule import) | `[net-new]` | NestJS module |
| 9 | DTO validation (class-validator) | `[net-new]` | Existing pattern |
| 10 | SSRF allowlist for slack_webhook URL | `[net-new]` | Application logic |
| 11 | Dedup window state on AlertRule.lastFiredAt | `[net-new]` | Prisma write |
| 12 | Remove old hard-coded `device.offline` handler | `[net-new]` | Source delete |

## Drift-rule self-checks

- ✅ Read `middleware/src/modules/mail/mail.service.ts` (1-373) — `wrapInTemplate(bodyContent)` exists (lines 96-128); `sendMail(to, subject, html, label, sender)` helper at line 65; `SENDERS` const has `noreply` / `auth` / `billing` / `support` (lines 5-10); password-reset uses `sender='auth'`, billing emails use `sender='billing'`. New `sendDeviceOfflineAlertEmail` will use `sender='noreply'`.
- ✅ Read `middleware/src/modules/notifications/notifications.controller.ts` (1-105) — `@UseGuards(RolesGuard)` at controller level; `@CurrentUser('organizationId') organizationId: string` on every endpoint; `@Roles('admin')` on POST (line 30); `ParseIdPipe` used for path params (line 13).
- ✅ Read `middleware/src/modules/agents/onboarding.service.ts` (1-115) — canonical async-OnEvent pattern: `@OnEvent('event.name', { async: true })`, top-level try/catch in handler, fire-and-forget, `this.logger.error(msg, err.stack)`. Will replicate exactly.
- ✅ Read `middleware/src/modules/notifications/notifications.module.ts` (1-13) — currently imports `DatabaseModule + HttpModule`. Will add `MailModule`. (App-level injection of MailService would work but explicit module import is cleaner + matches existing patterns elsewhere.)

## Test discoverability — Jest config constraint

Jest config at `middleware/jest.config.js:5-7` has `testPathIgnorePatterns: ['/__tests__/']` — `__tests__/` subdirs are EXCLUDED from unit test runs (used for E2E). **All new `*.spec.ts` files must be siblings of the impl files, not nested under `__tests__/`.** This is a blocker if not followed — tests would silently not run.

## File layout

```
middleware/src/modules/notifications/
├── notifications.module.ts                                          (MODIFIED — add MailModule import, register alert-rules providers/controller)
├── notifications.service.ts                                          (MODIFIED — remove device.offline @OnEvent handler at line 277-284)
├── alert-rules/
│   ├── alert-rules.service.ts                                        (NEW)
│   ├── alert-rules.controller.ts                                     (NEW)
│   ├── alert-rule.evaluator.ts                                       (NEW)
│   ├── alert-rule.types.ts                                           (NEW — TriggerEvent / Scope / Channel literal unions + constants)
│   ├── dto/
│   │   ├── create-alert-rule.dto.ts                                  (NEW)
│   │   ├── update-alert-rule.dto.ts                                  (NEW)
│   │   ├── create-recipient.dto.ts                                   (NEW)
│   │   └── alert-rule-response.dto.ts                                (NEW)
│   ├── alert-rules.service.spec.ts                                   (NEW — sibling, NOT in __tests__/)
│   ├── alert-rules.controller.spec.ts                                (NEW)
│   └── alert-rule.evaluator.spec.ts                                  (NEW)

packages/database/prisma/
├── schema.prisma                                                     (MODIFIED — add AlertRule + AlertRuleRecipient)
└── migrations/<timestamp>_add_alert_rules/
    └── migration.sql                                                 (NEW — auto-generated + manual data-seed block)
```

## Prisma schema (literal)

```prisma
model AlertRule {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  triggerEvent   String                                 // "device.offline" (extensible)
  isActive       Boolean  @default(true)
  scope          String                                 // "all" | "tag" | "group" | "display"
  scopeTagId     String?
  scopeGroupId   String?
  scopeDisplayId String?
  minOfflineSec  Int      @default(120)
  lastFiredAt    DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  organization Organization        @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  scopeTag     Tag?                @relation(fields: [scopeTagId],     references: [id], onDelete: SetNull)
  scopeGroup   DisplayGroup?       @relation(fields: [scopeGroupId],   references: [id], onDelete: SetNull)
  scopeDisplay Display?            @relation(fields: [scopeDisplayId], references: [id], onDelete: SetNull)
  recipients   AlertRuleRecipient[]

  @@unique([organizationId, name])                      // for seed idempotency + UI uniqueness
  @@index([organizationId, isActive])
  @@index([scopeTagId])
  @@index([scopeGroupId])
  @@index([scopeDisplayId])
  @@map("alert_rules")
}

model AlertRuleRecipient {
  id          String   @id @default(cuid())
  alertRuleId String
  channel     String                                    // "in_app" | "email" | "slack_webhook"
  target      String                                    // userId | email | webhook URL
  createdAt   DateTime @default(now())

  alertRule AlertRule @relation(fields: [alertRuleId], references: [id], onDelete: Cascade)

  @@index([alertRuleId])
  @@map("alert_rule_recipients")
}
```

**Back-relations on existing models:** Organization, Tag, DisplayGroup, Display each gain one back-relation field:
```prisma
model Organization {
  ...existing fields...
  alertRules AlertRule[]
}
model Tag {
  ...existing fields...
  alertRulesScopedHere AlertRule[]
}
model DisplayGroup {
  ...existing fields...
  alertRulesScopedHere AlertRule[]
}
model Display {
  ...existing fields...
  alertRulesScopedHere AlertRule[]
}
```

(Prisma 5 requires explicit back-relations when relations are bidirectional. Structural reviewer noted these are optional from the *user* API perspective, but Prisma errors at generation without them when forward relations are declared.)

## `alert-rule.types.ts` (literal)

```ts
export const TRIGGER_EVENTS = ['device.offline'] as const;
export type TriggerEvent = typeof TRIGGER_EVENTS[number];

export const SCOPES = ['all', 'tag', 'group', 'display'] as const;
export type Scope = typeof SCOPES[number];

export const CHANNELS = ['in_app', 'email', 'slack_webhook'] as const;
export type Channel = typeof CHANNELS[number];

export const DEDUP_WINDOW_MS = 15 * 60 * 1000;             // 15 minutes
export const MIN_OFFLINE_SEC_FLOOR = 120;                  // matches stale-heartbeat cron threshold
export const MAX_RECIPIENTS_PER_RULE = 20;
export const SLACK_WEBHOOK_REGEX = /^https:\/\/hooks\.slack\.com\/services\//;
```

## `AlertRulesService` shape

```ts
@Injectable()
export class AlertRulesService {
  constructor(private readonly db: DatabaseService) {}

  async create(orgId: string, dto: CreateAlertRuleDto): Promise<AlertRule>;     // transaction: rule + recipients
  async findAll(orgId: string, filters?: { isActive?: boolean; triggerEvent?: TriggerEvent }): Promise<AlertRule[]>;
  async findOne(orgId: string, id: string): Promise<AlertRule>;                  // throws NotFoundException on cross-org
  async update(orgId: string, id: string, dto: UpdateAlertRuleDto): Promise<AlertRule>;
  async remove(orgId: string, id: string): Promise<void>;
  async addRecipient(orgId: string, ruleId: string, dto: CreateRecipientDto): Promise<AlertRuleRecipient>;
  async removeRecipient(orgId: string, ruleId: string, recipientId: string): Promise<void>;

  // Internal helpers
  async findActiveForEvent(
    orgId: string,
    triggerEvent: TriggerEvent
  ): Promise<(AlertRule & { recipients: AlertRuleRecipient[] })[]>;    // evaluator's query

  /**
   * Atomic CAS-style claim of the 15-min dedup window. Returns true if THIS
   * caller successfully claimed the window (and should dispatch), false if
   * another instance (PM2 cluster) already claimed it within the window.
   *
   * Implementation: updateMany({ where: { id, OR: [lastFiredAt < threshold, lastFiredAt IS NULL] }, data: { lastFiredAt: now } })
   * — count===1 means we won the race; count===0 means we lost.
   */
  async tryClaimDedupWindow(ruleId: string, now: Date): Promise<boolean>;

  /**
   * Validation helper called by `create` AND `addRecipient`.
   * For `in_app` channel: verifies target userId exists AND belongs to the same org.
   * For `email`: validates email shape (also done at DTO layer; belt-and-braces).
   * For `slack_webhook`: re-checks the regex.
   * Throws ForbiddenException on cross-tenant in_app target.
   */
  private async validateRecipient(orgId: string, dto: { channel: Channel; target: string }): Promise<void>;
}
```

**Cross-org guard pattern:** `findOne` uses `{ where: { id, organizationId } }` so a cross-org lookup returns null and the service throws `NotFoundException`. Tested.

**Cross-tenant in_app target guard (Critical):** when `dto.channel === 'in_app'`, both `create` and `addRecipient` MUST call `validateRecipient(orgId, dto)` which loads the target userId and asserts `targetUser.organizationId === orgId`. Without this guard an org-A admin could route an `in_app` notification to an org-B userId. DTO-layer validation can't catch this because the DTO doesn't know the caller's orgId. Tested with a dedicated case.

## `AlertRuleEvaluator` shape

```ts
@Injectable()
export class AlertRuleEvaluator {
  private readonly logger = new Logger(AlertRuleEvaluator.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly alertRulesService: AlertRulesService,
    private readonly mail: MailService,
    private readonly http: HttpService,
  ) {}

  @OnEvent('device.offline', { async: true })
  async handleDeviceOffline(payload: {
    deviceId: string;
    deviceName: string;
    organizationId: string;
  }): Promise<void> {
    try {
      await this.evaluate(payload);
    } catch (err) {
      this.logger.error(
        `Alert rule evaluation failed for device ${payload.deviceId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private async evaluate(payload: { ... }): Promise<void> {
    // 1. Load device with tags + group (we need these for scope-match)
    const device = await this.db.display.findUnique({
      where: { id: payload.deviceId },
      include: {
        tags:   { select: { tagId: true } },
        groups: { select: { displayGroupId: true } },
      },
    });
    if (!device) {
      this.logger.warn(`device.offline for unknown device ${payload.deviceId} — skipping rules`);
      return;
    }

    // 2. Load active rules
    const rules = await this.alertRulesService.findActiveForEvent(
      payload.organizationId,
      'device.offline',
    );

    const now = new Date();
    const offlineSec = device.lastHeartbeat
      ? Math.floor((now.getTime() - device.lastHeartbeat.getTime()) / 1000)
      : Number.POSITIVE_INFINITY;

    for (const rule of rules) {
      if (!this.scopeMatches(rule, device)) continue;
      if (offlineSec < rule.minOfflineSec) continue;

      // ATOMIC dedup claim — under PM2 cluster, two instances reading rule.lastFiredAt
      // simultaneously and both passing the check would both dispatch. The CAS-style
      // updateMany makes the claim atomic at the DB level: only the instance whose
      // UPDATE affects 1 row dispatches.
      const claimed = await this.alertRulesService.tryClaimDedupWindow(rule.id, now);
      if (!claimed) continue;

      await this.dispatchAll(rule, device, payload);
    }
  }

  private scopeMatches(rule: AlertRule, device: { id: string; tags: {tagId:string}[]; groups: {displayGroupId:string}[] }): boolean {
    switch (rule.scope) {
      case 'all':     return true;
      case 'tag':
        if (rule.scopeTagId == null) {
          this.logger.warn(`Rule ${rule.id} has scope=tag but scopeTagId=null (referenced Tag was deleted). Rule will never fire — consider disabling it or fixing the scope.`);
          return false;
        }
        return device.tags.some(t => t.tagId === rule.scopeTagId);
      case 'group':
        if (rule.scopeGroupId == null) {
          this.logger.warn(`Rule ${rule.id} has scope=group but scopeGroupId=null (referenced DisplayGroup was deleted).`);
          return false;
        }
        return device.groups.some(g => g.displayGroupId === rule.scopeGroupId);
      case 'display':
        if (rule.scopeDisplayId == null) {
          this.logger.warn(`Rule ${rule.id} has scope=display but scopeDisplayId=null (referenced Display was deleted).`);
          return false;
        }
        return rule.scopeDisplayId === device.id;
      default:
        this.logger.warn(`Unknown scope ${rule.scope} on rule ${rule.id} — skipping`);
        return false;
    }
  }

  private async dispatchAll(rule: AlertRule & { recipients: AlertRuleRecipient[] }, device, payload): Promise<void> {
    for (const r of rule.recipients) {
      try {
        switch (r.channel) {
          case 'in_app':        await this.dispatchInApp(r, payload); break;
          case 'email':         await this.dispatchEmail(r, payload); break;
          case 'slack_webhook': await this.dispatchSlack(r, payload); break;
          default:
            this.logger.warn(`Unknown channel ${r.channel} on recipient ${r.id} — skipping`);
        }
      } catch (err) {
        this.logger.error(
          `Recipient dispatch failed (rule=${rule.id}, recipient=${r.id}, channel=${r.channel})`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }

  private async dispatchInApp(r, payload): Promise<void> {
    await this.db.notification.create({
      data: {
        organizationId: payload.organizationId,
        userId: r.target,                    // recipient user id
        type: 'device_offline',
        severity: 'warning',
        title: 'Device offline',
        message: `${payload.deviceName} is offline`,
        metadata: { deviceId: payload.deviceId },
      },
    });
  }

  private async dispatchEmail(r, payload): Promise<void> {
    await this.mail.sendDeviceOfflineAlertEmail(r.target, payload.deviceName);
  }

  private async dispatchSlack(r, payload): Promise<void> {
    if (!SLACK_WEBHOOK_REGEX.test(r.target)) {
      // SSRF guard: defense in depth — DTO validates at create-time, but a tampered
      // record or an admin who pasted a non-Slack URL via direct DB write is rejected here.
      this.logger.error(`Slack webhook ${r.id} rejected at dispatch — URL fails allowlist`);
      return;
    }
    // SSRF defense: maxRedirects=0 prevents Slack 302 → attacker chain.
    // timeout=5000 prevents slow-loris hold-open.
    await firstValueFrom(this.http.post(
      r.target,
      { text: `🔴 *${escapeSlackText(payload.deviceName)}* is offline` },
      { maxRedirects: 0, timeout: 5000 },
    ));
  }
}

// Helper (lives in alert-rule.types.ts or alongside the evaluator):
// Slack `text` field renders backticks/`*_~|` as markdown. Escape user-controlled
// names before interpolation so a device named "*pwn*" doesn't break the layout.
export function escapeSlackText(s: string): string {
  return s.replace(/[`*_~|]/g, (c) => `\\${c}`);
}
```

## `AlertRulesController` shape

```ts
@UseGuards(RolesGuard)
@Controller('notifications/alert-rules')
export class AlertRulesController {
  constructor(private readonly service: AlertRulesService) {}

  @Post()
  create(@CurrentUser('organizationId') orgId: string, @Body() dto: CreateAlertRuleDto) {
    return this.service.create(orgId, dto);
  }

  @Get()
  findAll(@CurrentUser('organizationId') orgId: string, @Query() q: ListAlertRulesQueryDto) {
    return this.service.findAll(orgId, q);
  }

  @Get(':id')
  findOne(@CurrentUser('organizationId') orgId: string, @Param('id', ParseIdPipe) id: string) {
    return this.service.findOne(orgId, id);
  }

  @Patch(':id')
  @Roles('admin')                                                  // <-- gated: PATCH can flip isActive, change scope, change minOfflineSec — effectively rule disablement
  update(@CurrentUser('organizationId') orgId: string, @Param('id', ParseIdPipe) id: string, @Body() dto: UpdateAlertRuleDto) {
    return this.service.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles('admin')                                                  // <-- gated per plan revision
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser('organizationId') orgId: string, @Param('id', ParseIdPipe) id: string) {
    return this.service.remove(orgId, id);
  }

  @Post(':id/recipients')
  @Roles('admin')                                                  // <-- gated: adding a recipient is privileged (could route alerts to attacker)
  addRecipient(@CurrentUser('organizationId') orgId: string, @Param('id', ParseIdPipe) id: string, @Body() dto: CreateRecipientDto) {
    return this.service.addRecipient(orgId, id, dto);
  }

  @Delete(':id/recipients/:recipientId')
  @Roles('admin')                                                  // <-- gated per plan revision
  @HttpCode(HttpStatus.NO_CONTENT)
  removeRecipient(
    @CurrentUser('organizationId') orgId: string,
    @Param('id', ParseIdPipe) id: string,
    @Param('recipientId', ParseIdPipe) recipientId: string,
  ) {
    return this.service.removeRecipient(orgId, id, recipientId);
  }
}
```

## DTOs (class-validator)

```ts
// create-alert-rule.dto.ts
export class CreateRecipientInlineDto {
  @IsIn(CHANNELS)
  channel!: Channel;

  @IsString()
  @MaxLength(2000)
  @ValidateIf((o) => o.channel === 'slack_webhook')
  @Matches(SLACK_WEBHOOK_REGEX, { message: 'slack_webhook target must match https://hooks.slack.com/services/' })
  target!: string;
}

export class CreateAlertRuleDto {
  @IsString() @MinLength(1) @MaxLength(120)
  name!: string;

  @IsIn(TRIGGER_EVENTS)
  triggerEvent!: TriggerEvent;

  @IsIn(SCOPES)
  scope!: Scope;

  @ValidateIf((o) => o.scope === 'tag')      @IsString() scopeTagId?: string;
  @ValidateIf((o) => o.scope === 'group')    @IsString() scopeGroupId?: string;
  @ValidateIf((o) => o.scope === 'display')  @IsString() scopeDisplayId?: string;

  @IsInt() @Min(MIN_OFFLINE_SEC_FLOOR)
  minOfflineSec: number = MIN_OFFLINE_SEC_FLOOR;

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(MAX_RECIPIENTS_PER_RULE)
  @ValidateNested({ each: true }) @Type(() => CreateRecipientInlineDto)
  recipients!: CreateRecipientInlineDto[];

  @IsBoolean() @IsOptional()
  isActive?: boolean;
}
```

`UpdateAlertRuleDto` = `PartialType(CreateAlertRuleDto)` minus `recipients` (recipients are managed via the dedicated endpoints).

## New MailService method (literal addition)

Append to `mail.service.ts` after `sendPasswordResetEmail`:

```ts
async sendDeviceOfflineAlertEmail(to: string, deviceName: string): Promise<void> {
  const subject = `Device offline: ${deviceName}`;
  const html = this.wrapInTemplate(`
        <h1 style="color:#F0ECE8;font-size:22px;font-weight:700;margin:0 0 8px 0;">Device offline</h1>
        <p style="color:#8A9BA3;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
          The display <strong style="color:#F0ECE8;">${escapeHtml(deviceName)}</strong> is currently offline.
          You're receiving this because an alert rule on your Vizora account matches this device.
        </p>
        ${this.ctaButton('View Devices', `${this.appUrl}/dashboard/devices`)}
        <p style="color:#5A6B73;font-size:12px;line-height:1.5;margin:16px 0 0 0;">
          Manage your alert rules in Settings &rarr; Alerts.
        </p>
  `);
  await this.sendMail(to, subject, html, 'Device offline alert', 'noreply');
}
```

`escapeHtml` is a tiny helper added to `mail.service.ts` to escape device names in HTML (XSS defense — device names are user-controlled). Implementation: standard `&`/`<`/`>`/`"`/`'` replacement.

## Migration approach (verified)

**Decision:** `gen_random_uuid()` is NOT used anywhere in `packages/database/prisma/migrations/` (verified by grep). The codebase uses Prisma's `@default(cuid())` (application-side CUID generation). So the data seed cannot use a raw SQL CTE — the IDs would have a different shape from Prisma-generated CUIDs.

**Approach:** Two migrations.

1. **`<ts>_add_alert_rules`** — Prisma-generated schema migration only (tables, indexes, FKs). No data step.
2. **`<ts+1>_seed_default_alert_rules`** — a custom migration that includes a Prisma-client-side data seed step. The seed runs as part of the migration's lifecycle (e.g. via a TS script invoked from the migration directory, or a separate one-shot npx script we document and run at deploy time).

**Seed script (TypeScript, runs once at deploy):**

```ts
// packages/database/scripts/seed-default-alert-rules.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true } });
  for (const org of orgs) {
    const admins = await prisma.user.findMany({
      where: { organizationId: org.id, role: 'admin' },
      select: { id: true },
    });

    // Idempotent: skip if a rule with this name already exists (the unique index enforces it)
    const existing = await prisma.alertRule.findUnique({
      where: { organizationId_name: { organizationId: org.id, name: 'Default offline alert (auto-migrated)' } },
    });
    if (existing) continue;

    await prisma.alertRule.create({
      data: {
        organizationId: org.id,
        name: 'Default offline alert (auto-migrated)',
        triggerEvent: 'device.offline',
        isActive: true,
        scope: 'all',
        minOfflineSec: 120,
        recipients: { create: admins.map(a => ({ channel: 'in_app', target: a.id })) },
      },
    });

    if (admins.length === 0) {
      console.log(`[seed] org=${org.id} has no admins — default rule created with 0 recipients (no-op until admins added)`);
    }
  }
}

main().finally(() => prisma.$disconnect());
```

Invoke at deploy time: `npx tsx packages/database/scripts/seed-default-alert-rules.ts`. Document in `docs/runbooks/deploy.md` as a post-migration step (one-time, idempotent — safe to re-run).

## Module wiring (literal diff)

`notifications.module.ts`:

```diff
 import { Module } from '@nestjs/common';
 import { HttpModule } from '@nestjs/axios';
 import { NotificationsController } from './notifications.controller';
 import { NotificationsService } from './notifications.service';
 import { DatabaseModule } from '../database/database.module';
+import { MailModule } from '../mail/mail.module';
+import { AlertRulesController } from './alert-rules/alert-rules.controller';
+import { AlertRulesService }    from './alert-rules/alert-rules.service';
+import { AlertRuleEvaluator }   from './alert-rules/alert-rule.evaluator';

 @Module({
-  imports: [DatabaseModule, HttpModule],
-  controllers: [NotificationsController],
-  providers: [NotificationsService],
-  exports: [NotificationsService],
+  imports: [DatabaseModule, HttpModule, MailModule],
+  controllers: [NotificationsController, AlertRulesController],
+  providers: [NotificationsService, AlertRulesService, AlertRuleEvaluator],
+  exports: [NotificationsService, AlertRulesService],
 })
 export class NotificationsModule {}
```

## Removal of old handler

`notifications.service.ts`:
- Delete lines 274-284 (the `@OnEvent('device.offline') handleDeviceOffline` method + its `/** ... */` doc)
- Keep lines 262-272 (`@OnEvent('device.online') handleDeviceOnline`) — `device.online` recovery alerts are out of scope per the plan
- Delete the corresponding test block in `middleware/src/modules/notifications/notifications.service.spec.ts` (test reviewer confirmed: lines 369-398, `describe('createDeviceOfflineNotification', ...)` — verify exact range during build before deleting)
- Keep `createDeviceOfflineNotification` factory method only IF it's still used by the new evaluator; otherwise delete it too. Decision at build time once the evaluator's `dispatchInApp` is wired — the evaluator inlines the Notification creation, so the helper is likely dead-code-eligible.

## Test plan

### `alert-rules.service.spec.ts` (~14 cases)
- `create` happy path → rule + N recipients in one transaction
- `create` with `MAX_RECIPIENTS_PER_RULE + 1` recipients → 400 (DTO rejects)
- `create` with `in_app` recipient referencing a userId from another org → ForbiddenException (the cross-tenant guard)
- `findOne` with foreign orgId → NotFoundException
- `update` with foreign orgId → NotFoundException
- `remove` with foreign orgId → NotFoundException (cross-org guard)
- `findActiveForEvent` filters by isActive + triggerEvent
- `addRecipient` happy path
- `addRecipient` with `in_app` target from another org → ForbiddenException
- `removeRecipient` with foreign orgId → NotFoundException
- `tryClaimDedupWindow` returns true on first call within window
- `tryClaimDedupWindow` returns false on second call within window (atomic CAS verified via setting lastFiredAt in fixture)
- `tryClaimDedupWindow` returns true after window elapses

### `alert-rule.evaluator.spec.ts` (~19 cases)
- Unknown device id → skip (warn logged)
- Device with `lastHeartbeat=null` (never sent heartbeat) → `offlineSec=Infinity` → fires any rule with minOfflineSec >= 120
- No active rules → no-op
- `scope=all` matches every device in org
- `scope=tag` matches device with that tag, skips device without
- `scope=tag` with `scopeTagId=null` (Tag was deleted, SetNull tripped) → skip with WARN log
- `scope=group` matches device in that group; `scopeGroupId=null` → skip with WARN log
- `scope=display` matches only that specific display; `scopeDisplayId=null` → skip with WARN log
- `minOfflineSec=300` and device offline 200s → skip
- `minOfflineSec=300` and device offline 400s → fire
- Atomic dedup: `tryClaimDedupWindow` returns false → skip dispatch even if scope matches
- Atomic dedup: same rule fires for device A; then fires for device B within 15min → BOTH events evaluate the rule; second one's `tryClaimDedupWindow` returns false (rule-level dedup is intentional — documented limitation, see plan)
- Rule with `isActive=true` but zero recipients → no error, no notifications, no warn (silent no-op)
- One recipient throws (e.g. `in_app` target userId no longer exists → FK error) → other recipients still dispatch (per-recipient try/catch)
- `slack_webhook` with non-Slack URL at dispatch time → log error + skip dispatch (defense in depth even though DTO validates)
- Slack dispatch includes `maxRedirects: 0` and `timeout: 5000` (verified via HttpService mock spy)
- All three channels dispatch independently (assert each was called exactly once on same rule)
- `device.online` events do NOT invoke this evaluator (only `device.offline` decorator)
- Top-level try/catch swallows DB failure → no unhandled rejection

### `alert-rules.controller.spec.ts` (~14 cases)
- `POST /alert-rules` happy path (logged-in non-admin user can create)
- `POST /alert-rules` bad DTO (`minOfflineSec=60` below floor) → 400
- `POST /alert-rules` with `slack_webhook` non-Slack URL → 400
- `GET /alert-rules` returns only this org's rules
- `GET /alert-rules/:id` cross-org → 404
- `GET /alert-rules/:id` happy path
- `PATCH /alert-rules/:id` as non-admin → 403 (RolesGuard)
- `PATCH /alert-rules/:id` as admin → 200 + updatedAt timestamp moved
- `PATCH /alert-rules/:id` cross-org → 404
- `DELETE /alert-rules/:id` non-admin → 403
- `DELETE /alert-rules/:id` admin → 204
- `POST /alert-rules/:id/recipients` as non-admin → 403
- `POST /alert-rules/:id/recipients` admin happy path
- `DELETE /alert-rules/:id/recipients/:rid` cross-org → 404

## Risks discovered during design

1. **`gen_random_uuid()` is unused in repo** — RESOLVED: switched to a TypeScript Prisma-client seed script (`packages/database/scripts/seed-default-alert-rules.ts`) invoked as a documented post-migration deploy step.
2. **`HttpModule` already in NotificationsModule but no current consumer** — the Slack dispatch will be the first real use. No risk; just noting.
3. **`escapeHtml` helper is net-new in MailService** — small, but new utility. Will live as a private method on MailService (not exported).
4. **`AlertRule.lastFiredAt` race condition under PM2 cluster (2 instances)** — RESOLVED: switched to atomic CAS via `tryClaimDedupWindow`. Only the instance whose `updateMany(where: lastFiredAt < threshold OR null)` returns count=1 dispatches.
5. **Test suite size growth** — ~47 new test cases (revised after design review). Existing middleware suite is 2335 tests; impact is +2%. Negligible.
6. **Per-device vs per-rule dedup semantics** — dedup is per-rule, not per-(rule, device). The 15-min window applies to the rule as a whole. If a single rule with `scope=all` fires for device A, then 5 min later device B goes offline, the rule will NOT fire for B. This is intentional v1 behavior (prevents alert storms during a region-wide outage). Per-(rule, device) dedup is a fast-follow if customers report missed alerts.

## Build sequence (commits)

1. `feat(db): add AlertRule + AlertRuleRecipient models + migration + seed script`
2. `feat(mail): sendDeviceOfflineAlertEmail + escapeHtml helper`
3. `feat(notifications): alert-rules types + DTOs + AlertRulesService + tests`
4. `feat(notifications): AlertRuleEvaluator + tests + remove hard-coded device.offline handler`
5. `feat(notifications): AlertRulesController + tests + wire in NotificationsModule`

If a commit's tests reveal a bug, fix is its own commit, never `--amend`.

## Acceptance criteria (refined from plan + reviews)

- [ ] All 4 new file types compile with `tsc --noEmit`
- [ ] All ~47 new test cases pass (revised after review)
- [ ] Existing 2335-test middleware suite has 0 regressions
- [ ] Migration applies forward + reset cleanly on a dev DB
- [ ] `npx tsx packages/database/scripts/seed-default-alert-rules.ts` runs idempotently and seeds one default rule + N admin recipients per existing org (verified via Prisma client query)
- [ ] Manually fire `device.offline` via `eventEmitter.emit(...)` from a debug REPL → in-app notification appears + email logged in DEV mode
- [ ] Cross-org isolation: rule in org A doesn't fire for org B's device (covered by evaluator unit test)
- [ ] Cross-tenant in_app guard: POST recipient with userId from another org returns 403 (service test)
- [ ] SSRF guard: POST recipient with `http://internal/...` returns 400 (DTO test); Slack dispatch uses `maxRedirects:0` + `timeout:5000`
- [ ] DELETE rule as non-admin returns 403; PATCH rule as non-admin returns 403; POST recipient as non-admin returns 403 (controller tests)
- [ ] Atomic dedup: two simulated evaluator instances racing → exactly one dispatches (service test)
- [ ] Test files are SIBLINGS of impl files (NOT in `__tests__/` — Jest excludes that dir per `middleware/jest.config.js:5-7`)
