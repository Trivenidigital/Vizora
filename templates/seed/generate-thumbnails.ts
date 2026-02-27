/**
 * Thumbnail Generator for Template Library
 *
 * Uses Puppeteer to render each template HTML at full resolution,
 * then saves a 400x225 thumbnail PNG.
 *
 * Usage:
 *   npx ts-node templates/seed/generate-thumbnails.ts
 *   npx ts-node templates/seed/generate-thumbnails.ts --category=restaurant
 *
 * Prerequisites:
 *   pnpm add -D puppeteer
 */

import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

const SEED_DIR = path.resolve(__dirname);
const CATEGORIES = ['restaurant', 'retail', 'general', 'corporate', 'education', 'healthcare', 'events'];
const LANDSCAPE = { width: 1920, height: 1080 };
const PORTRAIT = { width: 1080, height: 1920 };
const THUMB_WIDTH = 400;
const THUMB_HEIGHT = 225;
const THUMB_HEIGHT_PORTRAIT = 711; // Maintain 1080:1920 ratio at 400px width

async function main() {
  const categoryFilter = process.argv.find((a) => a.startsWith('--category='))?.split('=')[1];
  const categories = categoryFilter ? [categoryFilter] : CATEGORIES;

  console.log('Template Thumbnail Generator');
  console.log('='.repeat(50));

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  let generated = 0;
  let errors = 0;

  for (const category of categories) {
    const categoryDir = path.join(SEED_DIR, category);
    const thumbDir = path.join(categoryDir, 'thumbnails');

    if (!fs.existsSync(categoryDir)) {
      console.log(`[${category}] Directory not found, skipping.`);
      continue;
    }

    // Ensure thumbnails directory exists
    if (!fs.existsSync(thumbDir)) {
      fs.mkdirSync(thumbDir, { recursive: true });
    }

    const htmlFiles = fs.readdirSync(categoryDir).filter((f) => f.endsWith('.html')).sort();
    console.log(`\n[${category}] Generating ${htmlFiles.length} thumbnails...`);

    for (const file of htmlFiles) {
      const htmlPath = path.join(categoryDir, file);
      const thumbName = file.replace('.html', '.png');
      const thumbPath = path.join(thumbDir, thumbName);

      try {
        const html = fs.readFileSync(htmlPath, 'utf-8');

        // Detect orientation from HTML
        const isPortrait = html.includes('width:1080px') && html.includes('height:1920px');
        const viewport = isPortrait ? PORTRAIT : LANDSCAPE;
        const thumbH = isPortrait ? THUMB_HEIGHT_PORTRAIT : THUMB_HEIGHT;

        const page = await browser.newPage();
        await page.setViewport(viewport);

        // Load template HTML
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });

        // Wait a bit for fonts to load
        await page.evaluate(() => document.fonts?.ready);
        await new Promise((r) => setTimeout(r, 500));

        // Take full-page screenshot
        const screenshotBuffer = await page.screenshot({
          type: 'png',
          clip: { x: 0, y: 0, width: viewport.width, height: viewport.height },
        });

        // Resize to thumbnail
        await sharp(screenshotBuffer)
          .resize(THUMB_WIDTH, thumbH, { fit: 'cover' })
          .png({ quality: 90 })
          .toFile(thumbPath);

        console.log(`  OK: ${thumbName} (${THUMB_WIDTH}x${thumbH})`);
        generated++;

        await page.close();
      } catch (err) {
        console.error(`  ERROR: ${file} — ${(err as Error).message}`);
        errors++;
      }
    }
  }

  await browser.close();

  console.log('\n' + '='.repeat(50));
  console.log(`Done! Generated: ${generated}, Errors: ${errors}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
