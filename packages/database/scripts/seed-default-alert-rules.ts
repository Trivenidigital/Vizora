/**
 * O7 — Seed default alert rules for existing orgs (one-shot backfill).
 *
 * Runs ONCE at deploy time, AFTER `20260519050346_add_alert_rules` has been
 * applied. For each existing Organization that does NOT already have a
 * "Default offline alert (auto-migrated)" rule, inserts:
 *   - One AlertRule: scope=all, triggerEvent=device.offline,
 *     minOfflineSec=120, isActive=true
 *   - One AlertRuleRecipient per active admin (role='admin'): channel=in_app,
 *     target=user.id
 *
 * Preserves the pre-O7 broadcast-to-all-admins behavior 1:1. NEW orgs created
 * post-deploy are handled by `AuthService.register` → `seedDefaultRuleForOrg`
 * (PR #63 follow-up); they get the same default rule automatically at
 * registration time, so this backfill is needed only once for the orgs that
 * pre-date the migration.
 *
 * The runtime side of the same rule shape lives at
 * `middleware/src/modules/notifications/alert-rules/alert-rules.service.ts` →
 * `seedDefaultRuleForOrg(orgId, adminUserIds)`. The two paths MUST stay in
 * sync — if the default-rule shape changes (different scope, recipients,
 * etc.), edit both.
 *
 * Idempotent: the unique `(organizationId, name)` index causes the create to
 * throw P2002 on re-run, which is caught and treated as success.
 *
 * Orgs with zero active admins get an AlertRule with zero recipients — the
 * evaluator's dispatch loop iterates zero times (silent no-op). Logged at
 * INFO so post-deploy ops can spot orgs that need a manual recipient added.
 *
 * Invocation:
 *
 *     npx tsx packages/database/scripts/seed-default-alert-rules.ts
 *
 * The import path below resolves to this repo's generated Prisma client
 * (output configured in `packages/database/prisma/schema.prisma` →
 * `generator client { output = "../src/generated/prisma" }`). The script
 * intentionally does NOT depend on `@prisma/client` or on `@vizora/database`
 * being built — both have failed at deploy time in prior incidents.
 */

import { PrismaClient } from '../src/generated/prisma';

const DEFAULT_RULE_NAME = 'Default offline alert (auto-migrated)';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  let created = 0;
  let skippedExisting = 0;
  let orgsWithNoAdmins = 0;

  try {
    const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
    console.log(`[seed] Found ${orgs.length} organizations to evaluate`);

    for (const org of orgs) {
      // Cheap pre-check before the FK-heavy transaction
      const existing = await prisma.alertRule.findUnique({
        where: { organizationId_name: { organizationId: org.id, name: DEFAULT_RULE_NAME } },
        select: { id: true },
      });
      if (existing) {
        skippedExisting++;
        continue;
      }

      const admins = await prisma.user.findMany({
        where: { organizationId: org.id, role: 'admin', isActive: true },
        select: { id: true },
      });

      if (admins.length === 0) {
        orgsWithNoAdmins++;
        console.log(`[seed] org=${org.id} (${org.name}) has zero admins — creating rule with zero recipients (no-op until an admin is added as recipient)`);
      }

      try {
        await prisma.alertRule.create({
          data: {
            organizationId: org.id,
            name: DEFAULT_RULE_NAME,
            triggerEvent: 'device.offline',
            isActive: true,
            scope: 'all',
            minOfflineSec: 120,
            recipients: {
              create: admins.map((a) => ({ channel: 'in_app', target: a.id })),
            },
          },
        });
        created++;
      } catch (err: unknown) {
        // P2002 is the unique-constraint violation — could happen if a parallel
        // run beat us between the findUnique and the create. Treat as success.
        if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
          skippedExisting++;
        } else {
          throw err;
        }
      }
    }

    console.log(`[seed] Done. created=${created} skipped_existing=${skippedExisting} orgs_with_no_admins=${orgsWithNoAdmins}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[seed] Fatal error:', err);
  process.exit(1);
});
