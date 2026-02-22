#!/usr/bin/env node
/**
 * Production template seeder
 *
 * Usage: node scripts/seed-templates-production.js [--clear]
 *
 * Uses the generated Prisma client directly (no @vizora/database resolution needed).
 * Transpiles template-seeds.ts on-the-fly via ts-node/register.
 */

// Register ts-node for importing .ts files
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2020',
    esModuleInterop: true,
    strict: false,
    skipLibCheck: true,
  },
});

const path = require('path');
const { PrismaClient } = require(path.join(__dirname, '..', 'packages', 'database', 'src', 'generated', 'prisma'));
const { allTemplateSeeds, categorySummary } = require(path.join(__dirname, '..', 'middleware', 'src', 'modules', 'template-library', 'seed', 'template-seeds'));

async function main() {
  const prisma = new PrismaClient();
  const clearFirst = process.argv.includes('--clear');

  try {
    console.log('Template Library Seeder (Production)');
    console.log('='.repeat(40));
    console.log(`Templates to seed: ${categorySummary.total}`);
    console.log(`Categories: ${Object.entries(categorySummary).filter(([k]) => k !== 'total').map(([k, v]) => `${k}(${v})`).join(', ')}`);

    // Find or create a system organization for global templates
    let systemOrg = await prisma.organization.findFirst({
      where: { name: 'Vizora System' },
    });
    if (!systemOrg) {
      systemOrg = await prisma.organization.create({
        data: { name: 'Vizora System', slug: 'vizora-system' },
      });
      console.log(`Created system organization: ${systemOrg.id}`);
    } else {
      console.log(`Using existing system organization: ${systemOrg.id}`);
    }

    if (clearFirst) {
      console.log('\nClearing existing library templates...');
      const deleted = await prisma.content.deleteMany({
        where: { isGlobal: true, type: 'template' },
      });
      console.log(`Deleted ${deleted.count} existing library templates.`);
    }

    // Get existing template names to avoid duplicates
    const existingNames = new Set(
      (await prisma.content.findMany({
        where: { isGlobal: true, type: 'template' },
        select: { name: true },
      })).map((t) => t.name),
    );

    const existing = existingNames.size;
    if (existing > 0 && !clearFirst) {
      console.log(`\nFound ${existing} existing library templates. Use --clear to replace them.`);
      console.log('Skipping seeds that already exist (by name)...');
    }

    let created = 0;
    let skipped = 0;

    for (const seed of allTemplateSeeds) {
      if (existingNames.has(seed.name)) {
        skipped++;
        continue;
      }

      await prisma.content.create({
        data: {
          name: seed.name,
          description: seed.description,
          type: 'template',
          url: '',
          duration: seed.duration,
          templateOrientation: seed.templateOrientation === 'both' ? 'landscape' : seed.templateOrientation,
          isGlobal: true,
          status: 'active',
          organizationId: systemOrg.id,
          metadata: {
            templateHtml: seed.templateHtml,
            isLibraryTemplate: true,
            category: seed.category,
            libraryTags: seed.libraryTags,
            difficulty: seed.difficulty,
            isFeatured: seed.isFeatured || false,
            ...(seed.seasonalStart && { seasonalStart: seed.seasonalStart }),
            ...(seed.seasonalEnd && { seasonalEnd: seed.seasonalEnd }),
            dataSource: { type: 'manual', manualData: seed.sampleData || {} },
            refreshConfig: { enabled: false, intervalMinutes: 0 },
            sampleData: seed.sampleData || {},
          },
        },
      });
      created++;
      if (created % 10 === 0) {
        console.log(`  Created ${created} templates...`);
      }
    }

    console.log(`\nDone! Created: ${created}, Skipped: ${skipped}`);
    console.log('Template library is ready.');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
