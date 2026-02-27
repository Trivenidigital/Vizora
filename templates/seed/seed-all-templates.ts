/**
 * Unified Template Library Seeder — v2 (data-editable HTML files)
 *
 * Reads standalone HTML files from /templates/seed/{category}/ and seeds them
 * into the database as global library templates.
 *
 * Usage:
 *   npx ts-node templates/seed/seed-all-templates.ts
 *   npx ts-node templates/seed/seed-all-templates.ts --clear
 *   npx ts-node templates/seed/seed-all-templates.ts --category=restaurant
 */

import { PrismaClient } from '@vizora/database';
import * as fs from 'fs';
import * as path from 'path';

// ── Template metadata per category ──────────────────────────────────────────

interface TemplateFileConfig {
  filename: string;
  name: string;
  description: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  orientation: 'landscape' | 'portrait';
  duration: number;
  isFeatured?: boolean;
}

interface CategoryConfig {
  category: string;
  templates: TemplateFileConfig[];
}

const CATEGORIES: CategoryConfig[] = [
  {
    category: 'restaurant',
    templates: [
      { filename: '01-daily-specials.html', name: 'Daily Specials', description: 'Warm rustic chalkboard-style daily specials board', tags: ['menu', 'specials', 'restaurant', 'chalkboard'], difficulty: 'beginner', orientation: 'landscape', duration: 30, isFeatured: true },
      { filename: '02-full-menu.html', name: 'Full Menu Board', description: 'Dark elegant fine-dining multi-section menu', tags: ['menu', 'fine-dining', 'restaurant', 'full-menu'], difficulty: 'intermediate', orientation: 'landscape', duration: 45 },
      { filename: '03-coffee-shop.html', name: 'Coffee Shop Menu', description: 'Cozy café menu with handwritten feel', tags: ['menu', 'coffee', 'cafe', 'cozy'], difficulty: 'beginner', orientation: 'landscape', duration: 30 },
      { filename: '04-pizza-menu.html', name: 'Pizza Menu', description: 'Italian energetic pizza menu with sizes and prices', tags: ['menu', 'pizza', 'italian', 'restaurant'], difficulty: 'beginner', orientation: 'landscape', duration: 30 },
      { filename: '05-happy-hour.html', name: 'Happy Hour', description: 'Nightlife neon-style happy hour specials', tags: ['drinks', 'happy-hour', 'bar', 'nightlife', 'promotion'], difficulty: 'beginner', orientation: 'landscape', duration: 30, isFeatured: true },
      { filename: '06-breakfast-menu.html', name: 'Breakfast Menu', description: 'Bright morning breakfast menu with sunrise warmth', tags: ['menu', 'breakfast', 'morning', 'restaurant'], difficulty: 'beginner', orientation: 'landscape', duration: 30 },
      { filename: '07-food-truck.html', name: 'Food Truck Menu', description: 'Bold street-food menu for food trucks', tags: ['menu', 'food-truck', 'street-food', 'bold'], difficulty: 'beginner', orientation: 'portrait', duration: 30 },
      { filename: '08-dessert-menu.html', name: 'Dessert Menu', description: 'Elegant pastel dessert and sweets menu', tags: ['menu', 'dessert', 'sweets', 'bakery'], difficulty: 'beginner', orientation: 'landscape', duration: 30 },
      { filename: '09-bar-cocktail.html', name: 'Bar & Cocktail Menu', description: 'Art deco speakeasy cocktail menu', tags: ['menu', 'cocktail', 'bar', 'speakeasy', 'luxury'], difficulty: 'intermediate', orientation: 'landscape', duration: 45 },
      { filename: '10-combo-deals.html', name: 'Combo Deals', description: 'Promotional combo deals with value badges', tags: ['deals', 'combo', 'promotion', 'restaurant'], difficulty: 'beginner', orientation: 'landscape', duration: 30 },
      { filename: '11-bakery-cafe.html', name: 'Bakery Café', description: 'Artisanal warmth bakery and café menu', tags: ['menu', 'bakery', 'cafe', 'artisanal'], difficulty: 'beginner', orientation: 'landscape', duration: 30 },
      { filename: '12-order-status.html', name: 'Order Status Board', description: 'Kitchen order status display with color-coded sections', tags: ['status', 'orders', 'kitchen', 'restaurant'], difficulty: 'intermediate', orientation: 'landscape', duration: 15 },
    ],
  },
  {
    category: 'retail',
    templates: [
      { filename: '01-big-sale.html', name: 'Big Sale', description: 'Maximum impact sale promotion display', tags: ['sale', 'promotion', 'discount', 'retail'], difficulty: 'beginner', orientation: 'landscape', duration: 20, isFeatured: true },
      { filename: '02-new-arrivals.html', name: 'New Arrivals', description: 'Modern aspirational new product showcase', tags: ['new-arrivals', 'fashion', 'products', 'retail'], difficulty: 'intermediate', orientation: 'landscape', duration: 30 },
      { filename: '03-summer-promo.html', name: 'Summer Promotion', description: 'Vibrant summer savings promotion', tags: ['summer', 'promotion', 'seasonal', 'retail'], difficulty: 'beginner', orientation: 'landscape', duration: 25 },
      { filename: '04-winter-holiday.html', name: 'Winter Holiday Sale', description: 'Festive winter holiday promotion', tags: ['winter', 'holiday', 'christmas', 'seasonal', 'retail'], difficulty: 'beginner', orientation: 'landscape', duration: 25 },
      { filename: '05-product-spotlight.html', name: 'Product Spotlight', description: 'Premium single product showcase', tags: ['product', 'spotlight', 'feature', 'retail'], difficulty: 'intermediate', orientation: 'landscape', duration: 30, isFeatured: true },
      { filename: '06-store-directory.html', name: 'Store Directory', description: 'Color-coded department wayfinding', tags: ['directory', 'wayfinding', 'departments', 'store'], difficulty: 'beginner', orientation: 'landscape', duration: 60 },
      { filename: '07-store-hours.html', name: 'Store Hours', description: 'Welcoming store hours and info display', tags: ['hours', 'info', 'store', 'welcome'], difficulty: 'beginner', orientation: 'landscape', duration: 60 },
      { filename: '08-loyalty-program.html', name: 'Loyalty Program', description: 'VIP rewards program promotion', tags: ['loyalty', 'rewards', 'VIP', 'retail'], difficulty: 'beginner', orientation: 'landscape', duration: 30 },
      { filename: '09-flash-sale.html', name: 'Flash Sale', description: 'Urgency countdown flash sale display', tags: ['flash-sale', 'countdown', 'urgency', 'retail'], difficulty: 'beginner', orientation: 'landscape', duration: 20, isFeatured: true },
      { filename: '10-bogo.html', name: 'Buy One Get One', description: 'Bold BOGO promotion display', tags: ['bogo', 'promotion', 'deal', 'retail'], difficulty: 'beginner', orientation: 'landscape', duration: 25 },
      { filename: '11-clearance.html', name: 'Clearance Sale', description: 'End-of-season tiered clearance', tags: ['clearance', 'sale', 'discount', 'retail'], difficulty: 'beginner', orientation: 'landscape', duration: 25 },
      { filename: '12-testimonial.html', name: 'Customer Testimonial', description: 'Trust-building customer review display', tags: ['testimonial', 'review', 'trust', 'retail'], difficulty: 'beginner', orientation: 'landscape', duration: 30 },
      { filename: '13-gift-card.html', name: 'Gift Card Display', description: 'Gift card showcase with amounts', tags: ['gift-card', 'gift', 'retail'], difficulty: 'beginner', orientation: 'landscape', duration: 30 },
      { filename: '14-store-map.html', name: 'Store Map', description: 'Wayfinding floor plan display', tags: ['map', 'wayfinding', 'floor-plan', 'store'], difficulty: 'intermediate', orientation: 'landscape', duration: 60 },
      { filename: '15-weekly-deals.html', name: 'Weekly Deals', description: 'Retail circular weekly deals', tags: ['deals', 'weekly', 'circular', 'retail'], difficulty: 'beginner', orientation: 'portrait', duration: 30 },
    ],
  },
  {
    category: 'general',
    templates: [
      { filename: '01-building-directory.html', name: 'Building Directory', description: 'Premium lobby building directory', tags: ['directory', 'building', 'lobby', 'wayfinding'], difficulty: 'beginner', orientation: 'landscape', duration: 60, isFeatured: true },
      { filename: '02-weather-display.html', name: 'Weather Display', description: 'Modern weather-app style display', tags: ['weather', 'forecast', 'information'], difficulty: 'intermediate', orientation: 'landscape', duration: 30 },
      { filename: '03-digital-clock.html', name: 'Digital Clock', description: 'Dramatic ambient digital clock', tags: ['clock', 'time', 'ambient', 'minimal'], difficulty: 'beginner', orientation: 'landscape', duration: 60 },
      { filename: '04-wifi-info.html', name: 'WiFi Info', description: 'Friendly WiFi connection info display', tags: ['wifi', 'internet', 'info', 'connection'], difficulty: 'beginner', orientation: 'landscape', duration: 60 },
      { filename: '05-qr-code.html', name: 'QR Code Display', description: 'Tech-forward QR code scan display', tags: ['qr-code', 'scan', 'tech', 'action'], difficulty: 'beginner', orientation: 'landscape', duration: 60 },
      { filename: '06-new-year.html', name: 'New Year Celebration', description: 'Festive new year celebration display', tags: ['new-year', 'celebration', 'holiday', 'festive'], difficulty: 'beginner', orientation: 'landscape', duration: 30 },
      { filename: '07-diwali.html', name: 'Diwali Celebration', description: 'Rich cultural Diwali celebration', tags: ['diwali', 'celebration', 'cultural', 'festive'], difficulty: 'beginner', orientation: 'landscape', duration: 30 },
      { filename: '08-now-showing.html', name: 'Now Showing', description: 'Cinema marquee now showing display', tags: ['cinema', 'movies', 'entertainment', 'showtimes'], difficulty: 'intermediate', orientation: 'landscape', duration: 30, isFeatured: true },
      { filename: '09-announcement.html', name: 'Announcement', description: 'Attention-grabbing announcement display', tags: ['announcement', 'notice', 'information', 'alert'], difficulty: 'beginner', orientation: 'landscape', duration: 30 },
      { filename: '10-social-media-wall.html', name: 'Social Media Wall', description: 'Modern social media post grid', tags: ['social-media', 'social', 'engagement', 'modern'], difficulty: 'intermediate', orientation: 'landscape', duration: 30 },
      { filename: '11-visitor-welcome.html', name: 'Visitor Welcome', description: 'Elegant lobby entrance welcome', tags: ['welcome', 'lobby', 'visitor', 'entrance'], difficulty: 'beginner', orientation: 'portrait', duration: 60 },
      { filename: '12-custom-message.html', name: 'Custom Message', description: 'Versatile elegant custom message display', tags: ['custom', 'message', 'versatile', 'general'], difficulty: 'beginner', orientation: 'landscape', duration: 30 },
    ],
  },
  {
    category: 'corporate',
    templates: [
      { filename: '01-welcome-screen.html', name: 'Corporate Welcome', description: 'Professional corporate lobby welcome', tags: ['welcome', 'corporate', 'lobby', 'professional'], difficulty: 'beginner', orientation: 'landscape', duration: 60, isFeatured: true },
      { filename: '02-meeting-room.html', name: 'Meeting Room Status', description: 'Clean meeting room availability display', tags: ['meeting', 'room', 'status', 'schedule'], difficulty: 'intermediate', orientation: 'landscape', duration: 15 },
      { filename: '03-kpi-dashboard.html', name: 'KPI Dashboard', description: 'Data-beautiful KPI metrics dashboard', tags: ['kpi', 'dashboard', 'metrics', 'data'], difficulty: 'advanced', orientation: 'landscape', duration: 30, isFeatured: true },
      { filename: '04-employee-recognition.html', name: 'Employee Recognition', description: 'Employee spotlight and recognition', tags: ['employee', 'recognition', 'spotlight', 'celebration'], difficulty: 'beginner', orientation: 'landscape', duration: 30 },
      { filename: '05-announcement.html', name: 'Corporate Announcement', description: 'Internal communications announcement', tags: ['announcement', 'internal', 'corporate', 'news'], difficulty: 'beginner', orientation: 'landscape', duration: 30 },
      { filename: '06-event-board.html', name: 'Corporate Event Board', description: 'Calendar-inspired event listing', tags: ['events', 'calendar', 'corporate', 'schedule'], difficulty: 'intermediate', orientation: 'landscape', duration: 30 },
      { filename: '07-office-directory.html', name: 'Office Directory', description: 'Professional office wayfinding', tags: ['directory', 'office', 'wayfinding', 'departments'], difficulty: 'beginner', orientation: 'landscape', duration: 60 },
      { filename: '08-safety-dashboard.html', name: 'Safety Dashboard', description: 'Workplace safety compliance dashboard', tags: ['safety', 'compliance', 'dashboard', 'corporate'], difficulty: 'intermediate', orientation: 'landscape', duration: 30 },
      { filename: '09-social-wall.html', name: 'Employee Social Wall', description: 'Employee engagement social feed', tags: ['social', 'engagement', 'employee', 'culture'], difficulty: 'intermediate', orientation: 'landscape', duration: 30 },
      { filename: '10-values-mission.html', name: 'Values & Mission', description: 'Aspirational company values display', tags: ['values', 'mission', 'brand', 'culture'], difficulty: 'beginner', orientation: 'landscape', duration: 45 },
      { filename: '11-training-schedule.html', name: 'Training Schedule', description: 'Weekly training session schedule', tags: ['training', 'schedule', 'learning', 'corporate'], difficulty: 'intermediate', orientation: 'landscape', duration: 30 },
      { filename: '12-company-metrics.html', name: 'Company Metrics', description: 'Executive metrics and performance dashboard', tags: ['metrics', 'executive', 'performance', 'data'], difficulty: 'advanced', orientation: 'landscape', duration: 30 },
    ],
  },
  {
    category: 'education',
    templates: [
      { filename: '01-campus-announcement.html', name: 'Campus Announcement', description: 'School news bulletin board', tags: ['announcement', 'campus', 'school', 'news'], difficulty: 'beginner', orientation: 'landscape', duration: 30, isFeatured: true },
      { filename: '02-cafeteria-menu.html', name: 'Cafeteria Menu', description: 'Weekly school lunch menu', tags: ['menu', 'cafeteria', 'lunch', 'school'], difficulty: 'beginner', orientation: 'landscape', duration: 30 },
      { filename: '03-event-calendar.html', name: 'Campus Events', description: 'Upcoming campus events calendar', tags: ['events', 'calendar', 'campus', 'school'], difficulty: 'beginner', orientation: 'landscape', duration: 30 },
      { filename: '04-class-schedule.html', name: 'Class Schedule', description: 'Daily class timetable display', tags: ['schedule', 'class', 'timetable', 'school'], difficulty: 'intermediate', orientation: 'landscape', duration: 30 },
      { filename: '05-library-info.html', name: 'Library Info', description: 'Library hours and resources', tags: ['library', 'books', 'resources', 'school'], difficulty: 'beginner', orientation: 'landscape', duration: 60 },
      { filename: '06-sports-scoreboard.html', name: 'Sports Scoreboard', description: 'Team sports scoreboard display', tags: ['sports', 'scoreboard', 'teams', 'school'], difficulty: 'intermediate', orientation: 'landscape', duration: 15 },
      { filename: '07-emergency-alert.html', name: 'Emergency Alert', description: 'Urgent safety alert display', tags: ['emergency', 'alert', 'safety', 'urgent'], difficulty: 'beginner', orientation: 'landscape', duration: 10 },
      { filename: '08-welcome-back.html', name: 'Welcome Back', description: 'Seasonal welcome back greeting', tags: ['welcome', 'semester', 'school', 'greeting'], difficulty: 'beginner', orientation: 'landscape', duration: 30 },
    ],
  },
  {
    category: 'healthcare',
    templates: [
      { filename: '01-wayfinding-directory.html', name: 'Healthcare Directory', description: 'Hospital department wayfinding', tags: ['directory', 'wayfinding', 'hospital', 'departments'], difficulty: 'beginner', orientation: 'landscape', duration: 60, isFeatured: true },
      { filename: '02-wait-time-display.html', name: 'Wait Time Display', description: 'Department wait time estimates', tags: ['wait-time', 'queue', 'hospital', 'information'], difficulty: 'intermediate', orientation: 'landscape', duration: 15 },
      { filename: '03-health-tips.html', name: 'Health Tips', description: 'Wellness tips and healthy living', tags: ['health', 'tips', 'wellness', 'information'], difficulty: 'beginner', orientation: 'landscape', duration: 30 },
      { filename: '04-doctor-on-call.html', name: 'Doctor On-Call', description: 'On-call physician directory', tags: ['doctor', 'on-call', 'staff', 'directory'], difficulty: 'intermediate', orientation: 'landscape', duration: 30 },
      { filename: '05-visitor-info.html', name: 'Visitor Information', description: 'Hospital visitor guide and rules', tags: ['visitor', 'info', 'rules', 'hospital'], difficulty: 'beginner', orientation: 'landscape', duration: 60 },
      { filename: '06-emergency-contacts.html', name: 'Emergency Contacts', description: 'Critical emergency contact numbers', tags: ['emergency', 'contacts', 'phone', 'critical'], difficulty: 'beginner', orientation: 'landscape', duration: 60 },
      { filename: '07-pharmacy-status.html', name: 'Pharmacy Status', description: 'Prescription ready/processing status', tags: ['pharmacy', 'prescription', 'status', 'health'], difficulty: 'intermediate', orientation: 'landscape', duration: 15 },
      { filename: '08-hand-hygiene.html', name: 'Hand Hygiene Guide', description: 'Hand washing compliance steps', tags: ['hygiene', 'hand-washing', 'compliance', 'safety'], difficulty: 'beginner', orientation: 'landscape', duration: 30 },
    ],
  },
  {
    category: 'events',
    templates: [
      { filename: '01-event-announcement.html', name: 'Event Announcement', description: 'Exciting event poster display', tags: ['event', 'announcement', 'poster', 'promotion'], difficulty: 'beginner', orientation: 'landscape', duration: 30, isFeatured: true },
      { filename: '02-conference-agenda.html', name: 'Conference Agenda', description: 'Multi-session conference schedule', tags: ['conference', 'agenda', 'schedule', 'sessions'], difficulty: 'intermediate', orientation: 'landscape', duration: 45 },
      { filename: '03-speaker-profile.html', name: 'Speaker Profile', description: 'Speaker spotlight and bio display', tags: ['speaker', 'profile', 'bio', 'conference'], difficulty: 'beginner', orientation: 'landscape', duration: 30 },
      { filename: '04-registration-qr.html', name: 'Registration QR', description: 'Event registration with QR code', tags: ['registration', 'qr-code', 'event', 'sign-up'], difficulty: 'beginner', orientation: 'landscape', duration: 60 },
      { filename: '05-event-countdown.html', name: 'Event Countdown', description: 'Dramatic event countdown display', tags: ['countdown', 'timer', 'event', 'anticipation'], difficulty: 'beginner', orientation: 'landscape', duration: 15 },
      { filename: '06-sponsor-wall.html', name: 'Sponsor Wall', description: 'Tiered sponsor recognition display', tags: ['sponsors', 'recognition', 'event', 'partners'], difficulty: 'intermediate', orientation: 'landscape', duration: 45 },
      { filename: '07-networking-mixer.html', name: 'Networking Mixer', description: 'Social networking event display', tags: ['networking', 'mixer', 'social', 'event'], difficulty: 'beginner', orientation: 'landscape', duration: 30 },
      { filename: '08-thank-you.html', name: 'Thank You / Wrap-Up', description: 'Event closing and appreciation', tags: ['thank-you', 'closing', 'appreciation', 'event'], difficulty: 'beginner', orientation: 'landscape', duration: 30 },
    ],
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const prisma = new PrismaClient();
  const clearFirst = process.argv.includes('--clear');
  const categoryFilter = process.argv.find((a) => a.startsWith('--category='))?.split('=')[1];

  const seedDir = path.resolve(__dirname);

  try {
    console.log('Template Library Seeder v2');
    console.log('='.repeat(50));

    const categoriesToSeed = categoryFilter
      ? CATEGORIES.filter((c) => c.category === categoryFilter)
      : CATEGORIES;

    if (categoriesToSeed.length === 0) {
      console.error(`Unknown category: ${categoryFilter}`);
      console.log(`Available: ${CATEGORIES.map((c) => c.category).join(', ')}`);
      process.exit(1);
    }

    const totalTemplates = categoriesToSeed.reduce((sum, c) => sum + c.templates.length, 0);
    console.log(`Templates to seed: ${totalTemplates}`);
    console.log(`Categories: ${categoriesToSeed.map((c) => `${c.category}(${c.templates.length})`).join(', ')}`);

    // Find or create system organization
    let systemOrg = await prisma.organization.findFirst({
      where: { name: 'Vizora System' },
    });
    if (!systemOrg) {
      systemOrg = await prisma.organization.create({
        data: { name: 'Vizora System', slug: 'vizora-system' },
      });
      console.log(`Created system organization: ${systemOrg.id}`);
    } else {
      console.log(`Using system organization: ${systemOrg.id}`);
    }

    // Clear existing templates
    if (clearFirst) {
      const whereClause = categoryFilter
        ? { isGlobal: true, type: 'template', metadata: { path: ['category'], equals: categoryFilter } }
        : { isGlobal: true, type: 'template' };

      console.log(`\nClearing existing ${categoryFilter || 'all'} library templates...`);
      const deleted = await prisma.content.deleteMany({ where: whereClause });
      console.log(`Deleted ${deleted.count} templates.`);
    }

    // Get existing names to skip duplicates
    const existingNames = new Set(
      (await prisma.content.findMany({
        where: { isGlobal: true, type: 'template' },
        select: { name: true },
      })).map((t) => t.name),
    );

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const cat of categoriesToSeed) {
      console.log(`\n[${cat.category}] Seeding ${cat.templates.length} templates...`);

      for (const tmpl of cat.templates) {
        if (existingNames.has(tmpl.name)) {
          console.log(`  SKIP: "${tmpl.name}" (already exists)`);
          skipped++;
          continue;
        }

        // Read HTML file from disk
        const htmlPath = path.join(seedDir, cat.category, tmpl.filename);
        if (!fs.existsSync(htmlPath)) {
          console.error(`  ERROR: File not found: ${htmlPath}`);
          errors++;
          continue;
        }

        const templateHtml = fs.readFileSync(htmlPath, 'utf-8');

        // Check for thumbnail
        const thumbPath = path.join(seedDir, cat.category, 'thumbnails', tmpl.filename.replace('.html', '.png'));
        const previewImageUrl = fs.existsSync(thumbPath)
          ? `/templates/seed/${cat.category}/thumbnails/${tmpl.filename.replace('.html', '.png')}`
          : undefined;

        await prisma.content.create({
          data: {
            name: tmpl.name,
            description: tmpl.description,
            type: 'template',
            url: '',
            duration: tmpl.duration,
            templateOrientation: tmpl.orientation,
            isGlobal: true,
            status: 'active',
            organizationId: systemOrg.id,
            metadata: {
              templateHtml,
              renderedHtml: templateHtml, // No Handlebars — HTML is ready as-is
              renderedAt: new Date().toISOString(),
              isLibraryTemplate: true,
              category: cat.category,
              libraryTags: tmpl.tags,
              difficulty: tmpl.difficulty,
              isFeatured: tmpl.isFeatured || false,
              ...(previewImageUrl && { previewImageUrl }),
              dataSource: { type: 'manual' },
              refreshConfig: { enabled: false, intervalMinutes: 0 },
              sampleData: {},
            },
          },
        });

        console.log(`  OK: "${tmpl.name}"${tmpl.isFeatured ? ' ★' : ''}`);
        created++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`Done! Created: ${created}, Skipped: ${skipped}, Errors: ${errors}`);
    console.log('Template library is ready.');
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
