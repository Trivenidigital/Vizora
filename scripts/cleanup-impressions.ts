/**
 * Vizora — ContentImpression Retention Cleanup
 *
 * Deletes ContentImpression records older than a configurable number of days.
 *
 * Usage:
 *   npx ts-node scripts/cleanup-impressions.ts [--days=90]
 *
 * Environment variables:
 *   DATABASE_URL  - PostgreSQL connection string (required, or loaded from .env)
 *   RETENTION_DAYS - Days to keep (default: 90). CLI --days flag takes precedence.
 */

import 'dotenv/config';
import { PrismaClient } from '../packages/database/src/generated/prisma';

async function main() {
  // Parse --days=N from CLI arguments
  const daysArg = process.argv.find((arg) => arg.startsWith('--days='));
  const retentionDays = daysArg
    ? parseInt(daysArg.split('=')[1], 10)
    : parseInt(process.env.RETENTION_DAYS || '90', 10);

  if (isNaN(retentionDays) || retentionDays < 1) {
    console.error('[ERROR] Invalid retention days value. Must be a positive integer.');
    process.exit(1);
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  console.log(`[INFO]  $(date) Cleaning up ContentImpression records older than ${retentionDays} days (before ${cutoffDate.toISOString()})...`);

  const prisma = new PrismaClient();

  try {
    const result = await prisma.contentImpression.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    console.log(`[INFO]  Deleted ${result.count} old ContentImpression record(s).`);
  } catch (error) {
    console.error('[ERROR] Failed to clean up impressions:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
