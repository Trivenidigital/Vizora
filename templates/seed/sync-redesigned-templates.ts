/**
 * Sync redesigned template HTML files to the database.
 *
 * Reads all templates/seed/<category>/*.html files and updates the
 * corresponding database records' metadata.templateHtml with the new
 * content. Matches by index within each category (same as thumbnail
 * assignment in seed-templates.command.ts).
 *
 * Usage:
 *   TS_NODE_COMPILER_OPTIONS='{"lib":["es2020","dom"]}' npx ts-node templates/seed/sync-redesigned-templates.ts
 */

import { PrismaClient } from '@vizora/database';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';

const SEED_DIR = path.resolve(__dirname);
const CATEGORIES = ['restaurant', 'retail', 'general', 'corporate', 'education', 'healthcare', 'events', 'indian'];

function renderWithSampleData(templateHtml: string, sampleData: Record<string, unknown>): string {
  try {
    const template = Handlebars.compile(templateHtml, { strict: false, noEscape: true });
    return template(sampleData || {});
  } catch {
    return templateHtml;
  }
}

async function main() {
  const prisma = new PrismaClient();
  let updated = 0;
  let skipped = 0;

  try {
    console.log('Syncing redesigned template HTML files to database...');
    console.log('='.repeat(50));

    for (const category of CATEGORIES) {
      const catDir = path.join(SEED_DIR, category);
      if (!fs.existsSync(catDir)) continue;

      const htmlFiles = fs
        .readdirSync(catDir)
        .filter((f) => f.endsWith('.html'))
        .sort();

      console.log(`\n[${category}] ${htmlFiles.length} HTML files`);

      // Get existing templates for this category (category is in metadata, not a column)
      const allTemplates = await prisma.content.findMany({
        where: { isGlobal: true, type: 'template' },
        select: { id: true, name: true, metadata: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      });
      const templates = allTemplates.filter((t) => {
        const meta = (t.metadata as Record<string, unknown>) || {};
        return meta.category === category;
      });

      console.log(`  Database has ${templates.length} templates for this category`);

      for (let i = 0; i < Math.min(htmlFiles.length, templates.length); i++) {
        const htmlFile = htmlFiles[i];
        const template = templates[i];
        const htmlPath = path.join(catDir, htmlFile);
        const newHtml = fs.readFileSync(htmlPath, 'utf-8');

        const meta = (template.metadata as Record<string, unknown>) || {};
        const sampleData = (meta.sampleData || {}) as Record<string, unknown>;
        const renderedHtml = renderWithSampleData(newHtml, sampleData);

        await prisma.content.update({
          where: { id: template.id },
          data: {
            metadata: {
              ...meta,
              templateHtml: newHtml,
              renderedHtml,
              renderedAt: new Date().toISOString(),
              redesignedAt: new Date().toISOString(),
            },
          },
        });

        console.log(`  OK: ${htmlFile} → "${template.name}"`);
        updated++;
      }

      if (htmlFiles.length > templates.length) {
        console.log(`  SKIP: ${htmlFiles.length - templates.length} new HTML files (need to be added via seed)`);
        skipped += htmlFiles.length - templates.length;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`Updated: ${updated}`);
    console.log(`Skipped (not in DB): ${skipped}`);
    console.log('Done!');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
