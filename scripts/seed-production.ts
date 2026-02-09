#!/usr/bin/env ts-node
/**
 * Production seed script — idempotent upserts for default Plans and SystemConfig.
 *
 * Usage:
 *   ts-node scripts/seed-production.ts
 *
 * This is safe to run multiple times; it uses upsert to avoid duplicates.
 */

import { PrismaClient } from '../packages/database/src/generated/prisma';

const prisma = new PrismaClient();

const PLANS = [
  {
    id: 'plan-free',
    name: 'Free',
    slug: 'free',
    description: 'Get started with basic digital signage',
    monthlyPrice: 0,
    yearlyPrice: 0,
    screenQuota: 2,
    storageQuotaMB: 500,
    features: ['2 screens', '500 MB storage', 'Basic templates', 'Community support'],
    isActive: true,
    sortOrder: 0,
  },
  {
    id: 'plan-basic',
    name: 'Basic',
    slug: 'basic',
    description: 'For small businesses with a few displays',
    monthlyPrice: 1999, // $19.99 in cents
    yearlyPrice: 19990, // $199.90 in cents
    screenQuota: 10,
    storageQuotaMB: 5000,
    features: ['10 screens', '5 GB storage', 'All templates', 'Email support', 'Basic analytics'],
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'plan-pro',
    name: 'Pro',
    slug: 'pro',
    description: 'For growing businesses with multiple locations',
    monthlyPrice: 4999, // $49.99 in cents
    yearlyPrice: 49990, // $499.90 in cents
    screenQuota: 50,
    storageQuotaMB: 25000,
    features: ['50 screens', '25 GB storage', 'All templates', 'Priority support', 'Advanced analytics', 'Custom branding'],
    isActive: true,
    sortOrder: 2,
  },
  {
    id: 'plan-enterprise',
    name: 'Enterprise',
    slug: 'enterprise',
    description: 'For large organizations with custom needs',
    monthlyPrice: 14999, // $149.99 in cents
    yearlyPrice: 149990, // $1499.90 in cents
    screenQuota: 500,
    storageQuotaMB: 100000,
    features: ['Unlimited screens', '100 GB storage', 'All templates', 'Dedicated support', 'Full analytics', 'Custom branding', 'API access', 'SSO'],
    isActive: true,
    sortOrder: 3,
  },
];

const SYSTEM_CONFIGS = [
  { key: 'maintenance_mode', value: 'false', dataType: 'boolean', category: 'general', description: 'Enable maintenance mode across the platform' },
  { key: 'max_upload_size_mb', value: '100', dataType: 'number', category: 'limits', description: 'Maximum file upload size in MB' },
  { key: 'default_content_duration', value: '30', dataType: 'number', category: 'general', description: 'Default content display duration in seconds' },
  { key: 'signup_enabled', value: 'true', dataType: 'boolean', category: 'features', description: 'Allow new user registrations' },
  { key: 'trial_duration_days', value: '14', dataType: 'number', category: 'general', description: 'Free trial duration in days' },
  { key: 'max_devices_per_org', value: '500', dataType: 'number', category: 'limits', description: 'Maximum number of devices per organization' },
];

async function main() {
  console.log('Seeding production data...');

  // Upsert plans
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { id: plan.id },
      update: {
        name: plan.name,
        slug: plan.slug,
        description: plan.description,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        screenQuota: plan.screenQuota,
        storageQuotaMB: plan.storageQuotaMB,
        features: plan.features,
        isActive: plan.isActive,
        sortOrder: plan.sortOrder,
      },
      create: plan,
    });
    console.log(`  Plan "${plan.name}" upserted.`);
  }

  // Upsert system configs
  for (const config of SYSTEM_CONFIGS) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: {
        description: config.description,
        dataType: config.dataType,
        category: config.category,
      },
      create: {
        key: config.key,
        value: config.value,
        dataType: config.dataType,
        category: config.category,
        description: config.description,
      },
    });
    console.log(`  Config "${config.key}" upserted.`);
  }

  console.log('Production seed complete.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
