/**
 * LOCAL-ONLY synthetic seed for the marketing product screenshot.
 *
 * Everything here is invented. No real customer, org, or person is represented.
 * Runs against the local docker Postgres only — never point this at prod.
 */
import { PrismaClient } from '../../packages/database/src/generated/prisma/index.js';
import bcrypt from '../../middleware/node_modules/bcryptjs/index.js';

/**
 * Fail closed BEFORE touching Prisma.
 *
 * This script creates a loginable `role: 'admin'` user and calls
 * `organization.delete`, which cascades across every org relation. Both are
 * catastrophic against a real database, and the script resolves DATABASE_URL
 * from the ambient environment — so on a box where prod credentials are
 * already exported (the VPS at /opt/vizora/app, for instance) an innocent
 * copy-paste of the README would point it straight at production. A comment
 * saying "local only" is not a control; these two checks are.
 */
function assertLocalOnly() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error('DATABASE_URL is not a parseable URL');
  }
  // Normalise before comparing. `postgresql:` is not a WHATWG "special" scheme,
  // so its host is parsed as opaque and is NOT lowercased -- `LOCALHOST` would
  // otherwise be rejected. IPv6 comes back bracketed (`[::1]`), so a bare '::1'
  // entry in the allowlist is unreachable. Both failed CLOSED, but wrongly.
  host = host.toLowerCase().replace(/\.$/, '').replace(/^\[|\]$/g, '');
  const LOCAL = ['localhost', '127.0.0.1', '::1', 'postgres', 'vizora-postgres'];
  if (!LOCAL.includes(host)) {
    throw new Error(
      `Refusing to seed: DATABASE_URL host is "${host}", which is not local. ` +
        `This script creates an admin user and cascade-deletes an organization.`,
    );
  }
  if (!process.env.DEMO_TENANT_PASSWORD || !process.env.DEMO_TENANT_PASSWORD.trim()) {
    throw new Error(
      'Set DEMO_TENANT_PASSWORD. This script will not fall back to a password committed to the repo.',
    );
  }
}

assertLocalOnly();

const prisma = new PrismaClient();

const ORG_SLUG = 'northwind-demo';
const ADMIN_EMAIL = 'demo@vizora.local';
const ADMIN_PASSWORD = process.env.DEMO_TENANT_PASSWORD;

const now = new Date();
const minsAgo = (m) => new Date(now.getTime() - m * 60_000);
const daysAgo = (d) => new Date(now.getTime() - d * 86_400_000);

const DISPLAYS = [
  ['Flagship — Window Wall',      'Seattle · 1st & Pike',      '3840x2160'],
  ['Flagship — Drive-Thru Menu',  'Seattle · 1st & Pike',      '1920x1080'],
  ['Ballard — Counter Board',     'Seattle · Ballard',         '1920x1080'],
  ['Ballard — Pastry Case',       'Seattle · Ballard',         '1080x1920'],
  ['Fremont — Menu Left',         'Seattle · Fremont',         '1920x1080'],
  ['Fremont — Menu Right',        'Seattle · Fremont',         '1920x1080'],
  ['Capitol Hill — Entry',        'Seattle · Capitol Hill',    '1080x1920'],
  ['Bellevue — Order Ahead',      'Bellevue · Main St',        '1920x1080'],
  ['Tacoma — Cold Brew Feature',  'Tacoma · Pacific Ave',      '1920x1080'],
];

const CONTENT = [
  ['Autumn Roast — Hero Loop',        'video', 'mp4',  48_234_112, 12],
  ['Cold Brew Tonic — Feature',       'video', 'mp4',  31_882_240, 10],
  ['Core Menu Board — Morning',       'html',  'html',      12_480, 20],
  ['Core Menu Board — Afternoon',     'html',  'html',      12_910, 20],
  ['Pastry Case — Daily',             'html',  'html',       8_640, 15],
  ['Loyalty — Double Stars',          'image', 'png',   2_106_368, 8],
  ['Order Ahead — How It Works',      'image', 'png',   1_884_160, 8],
  ['Single Origin — Ethiopia',        'image', 'jpeg',  3_215_360, 8],
  ['Single Origin — Colombia',        'image', 'jpeg',  3_098_624, 8],
  ['Seasonal Cups — Reveal',          'video', 'mp4',  22_413_312, 10],
  ['Store Hours — Holiday',           'html',  'html',       6_220, 12],
  ['Wifi & Community Board',          'html',  'html',       7_450, 15],
];

const PLAYLISTS = [
  ['Morning Rotation',      'Open through 11am — menu, pastry, loyalty.',        [2, 4, 5, 7]],
  ['Afternoon Rotation',    'Cold brew, single origin, seasonal.',               [3, 1, 7, 8, 9]],
  ['Drive-Thru Loop',       'Short-dwell loop tuned for the drive-thru lane.',   [2, 5, 6]],
  ['Community Board',       'Store hours, wifi, neighbourhood notices.',         [10, 11]],
];

async function main() {
  console.log('Seeding synthetic demo tenant (local only)…');

  // Clean any prior run of THIS demo org only.
  const existing = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } });
  if (existing) {
    await prisma.organization.delete({ where: { id: existing.id } });
    console.log('  removed previous demo org');
  }

  const org = await prisma.organization.create({
    data: {
      name: 'Northwind Coffee Roasters',
      slug: ORG_SLUG,
      subscriptionTier: 'pro',
      subscriptionStatus: 'active',
      screenQuota: 25,
      country: 'US',
      storageUsedBytes: BigInt(CONTENT.reduce((a, c) => a + c[3], 0)),
      storageQuotaBytes: BigInt(53_687_091_200), // 50 GB
    },
  });

  await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
      firstName: 'Dana',
      lastName: 'Whitfield',
      role: 'admin',
      isActive: true,
      organizationId: org.id,
      lastLoginAt: minsAgo(3),
    },
  });

  const content = [];
  for (let i = 0; i < CONTENT.length; i++) {
    const [name, type, ext, fileSize, duration] = CONTENT[i];
    content.push(
      await prisma.content.create({
        data: {
          name,
          type,
          url: `https://cdn.vizora.local/demo/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${ext}`,
          mimeType: type === 'html' ? 'text/html' : `${type}/${ext}`,
          fileSize,
          duration,
          status: 'active',
          organizationId: org.id,
          createdAt: daysAgo(CONTENT.length - i),
        },
      }),
    );
  }

  const playlists = [];
  for (const [name, description, idxs] of PLAYLISTS) {
    playlists.push(
      await prisma.playlist.create({
        data: {
          name,
          description,
          loop: true,
          organizationId: org.id,
          items: {
            create: idxs.map((ci, order) => ({ order, contentId: content[ci].id })),
          },
        },
      }),
    );
  }

  for (let i = 0; i < DISPLAYS.length; i++) {
    const [nickname, location, resolution] = DISPLAYS[i];
    await prisma.display.create({
      data: {
        deviceIdentifier: `DEMO-NW-${String(i + 1).padStart(3, '0')}`,
        nickname,
        location,
        resolution,
        orientation: resolution.startsWith('1080x') ? 'portrait' : 'landscape',
        status: 'online',
        timezone: 'America/Los_Angeles',
        lastHeartbeat: minsAgo(Math.floor(Math.random() * 3)),
        pairedAt: daysAgo(40 - i),
        organizationId: org.id,
        currentPlaylistId: playlists[i % playlists.length].id,
        metadata: { os: 'Android TV 14', model: 'Vizora Player', appVersion: '1.8.2' },
      },
    });
  }

  const counts = {
    displays: await prisma.display.count({ where: { organizationId: org.id } }),
    online: await prisma.display.count({ where: { organizationId: org.id, status: 'online' } }),
    content: await prisma.content.count({ where: { organizationId: org.id } }),
    playlists: await prisma.playlist.count({ where: { organizationId: org.id } }),
  };
  console.log('  seeded:', counts);
  console.log('  login:', ADMIN_EMAIL);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
