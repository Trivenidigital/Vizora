/**
 * O7 — Seed default alert rules for existing orgs.
 *
 * The same rule shape is also implemented in
 * `middleware/src/modules/notifications/alert-rules/alert-rules.service.ts`
 * → `seedDefaultRuleForOrg(orgId, adminUserIds)`. That path is what auto-seeds
 * NEW orgs at registration time. This standalone script is the one-shot
 * backfill for orgs that already existed before the migration landed.
 *
 * Both paths must stay in sync — if the default-rule shape changes (different
 * scope, recipients, etc.), edit both.
 *
 * Run ONCE at deploy time after the `20260519050346_add_alert_rules` migration:
 *
 *     npx tsx packages/database/scripts/seed-default-alert-rules.ts
 *
 * For every existing Organization that does NOT already have a rule named
 * "Default offline alert (auto-migrated)", inserts:
 *   - One AlertRule row: scope=all, triggerEvent=device.offline,
 *     minOfflineSec=120, isActive=true
 *   - One AlertRuleRecipient per admin user (role='admin'): channel=in_app,
 *     target=user.id
 *
 * This preserves the pre-O7 broadcast-to-all-admins behavior 1:1 for current
 * orgs. New orgs created post-deploy get NO default rule — they explicitly
 * opt in via the UI / API.
 *
 * Idempotent: re-running is safe because the unique index
 * `(organizationId, name)` on alert_rules causes `prisma.alertRule.create`
 * to throw P2002, which we catch and skip.
 *
 * Orgs with zero admin users get an AlertRule with zero recipients — the
 * evaluator's dispatch loop iterates zero times → silent no-op. Logged at
 * INFO so post-deploy ops can spot orgs that need a manual recipient added.
 */

import { PrismaClient } from '@prisma/client';

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
