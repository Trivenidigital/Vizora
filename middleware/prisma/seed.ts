/**
 * Database Seeding Script for E2E Testing
 * Creates test data: users, organizations, content, playlists, displays
 */

import { PrismaClient } from '@vizora/database';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data (be careful in production!)
  if (process.env.NODE_ENV === 'test') {
    console.log('Cleaning test database...');
    await prisma.auditLog.deleteMany();
    await prisma.playlistItem.deleteMany();
    await prisma.schedule.deleteMany();
    await prisma.playlist.deleteMany();
    await prisma.content.deleteMany();
    await prisma.display.deleteMany();
    await prisma.user.deleteMany();
    await prisma.organization.deleteMany();
    console.log('✅ Database cleaned');
  }

  // 1. Create Test Organization
  console.log('Creating test organization...');
  const organization = await prisma.organization.create({
    data: {
      name: 'Test Organization',
      slug: 'test-org',
      subscriptionTier: 'pro',
      screenQuota: 50,
      subscriptionStatus: 'active',
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    },
  });
  console.log(`✅ Organization created: ${organization.id}`);

  // 2. Create Test Users
  console.log('Creating test users...');
  const passwordHash = await bcrypt.hash('Test123!@#', 14);

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@vizora.test',
      passwordHash,
      firstName: 'Test',
      lastName: 'Admin',
      role: 'admin',
      organizationId: organization.id,
      isActive: true,
    },
  });
  console.log(`✅ Admin user created: ${adminUser.email}`);

  const managerUser = await prisma.user.create({
    data: {
      email: 'manager@vizora.test',
      passwordHash,
      firstName: 'Test',
      lastName: 'Manager',
      role: 'manager',
      organizationId: organization.id,
      isActive: true,
    },
  });
  console.log(`✅ Manager user created: ${managerUser.email}`);

  // 3. Create Test Content
  console.log('Creating test content...');
  const content1 = await prisma.content.create({
    data: {
      organizationId: organization.id,
      name: 'Test Image 1',
      type: 'image',
      url: 'https://via.placeholder.com/1920x1080/0066cc/ffffff?text=Test+Image+1',
      status: 'ready',
      duration: 10,
      thumbnail: 'https://via.placeholder.com/300x200/0066cc/ffffff?text=Thumb+1',
    },
  });

  const content2 = await prisma.content.create({
    data: {
      organizationId: organization.id,
      name: 'Test Video 1',
      type: 'video',
      url: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4',
      status: 'ready',
      duration: 30,
    },
  });

  const content3 = await prisma.content.create({
    data: {
      organizationId: organization.id,
      name: 'Test URL Content',
      type: 'url',
      url: 'https://example.com',
      status: 'ready',
    },
  });
  console.log(`✅ Content created: ${content1.id}, ${content2.id}, ${content3.id}`);

  // 4. Create Test Displays
  console.log('Creating test displays...');
  const display1 = await prisma.display.create({
    data: {
      organizationId: organization.id,
      deviceIdentifier: 'TEST-DEVICE-001',
      nickname: 'Test Display 1',
      location: 'Test Location 1',
      status: 'online',
      resolution: '1920x1080',
      orientation: 'landscape',
      lastHeartbeat: new Date(),
      pairedAt: new Date(),
    },
  });

  const display2 = await prisma.display.create({
    data: {
      organizationId: organization.id,
      deviceIdentifier: 'TEST-DEVICE-002',
      nickname: 'Test Display 2',
      location: 'Test Location 2',
      status: 'offline',
      resolution: '1920x1080',
      orientation: 'landscape',
    },
  });
  console.log(`✅ Displays created: ${display1.id}, ${display2.id}`);

  // 5. Create Test Playlists
  console.log('Creating test playlists...');
  const playlist1 = await prisma.playlist.create({
    data: {
      organizationId: organization.id,
      name: 'Test Playlist 1',
      description: 'A test playlist with multiple items',
      isDefault: false,
      items: {
        create: [
          {
            contentId: content1.id,
            order: 0,
            duration: 10,
          },
          {
            contentId: content2.id,
            order: 1,
            duration: 30,
          },
          {
            contentId: content3.id,
            order: 2,
            duration: 15,
          },
        ],
      },
    },
    include: {
      items: true,
    },
  });

  const playlist2 = await prisma.playlist.create({
    data: {
      organizationId: organization.id,
      name: 'Test Playlist 2',
      description: 'Another test playlist',
      isDefault: false,
      items: {
        create: [
          {
            contentId: content1.id,
            order: 0,
            duration: 15,
          },
        ],
      },
    },
  });
  console.log(`✅ Playlists created: ${playlist1.id}, ${playlist2.id}`);

  // 6. Assign Playlist to Display
  await prisma.display.update({
    where: { id: display1.id },
    data: { currentPlaylistId: playlist1.id },
  });
  console.log(`✅ Playlist assigned to display`);

  // 7. Create Test Schedule
  console.log('Creating test schedule...');
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30); // 30 days from now

  const schedule = await prisma.schedule.create({
    data: {
      organizationId: organization.id,
      name: 'Test Schedule',
      description: 'Daily 9-5 schedule',
      playlistId: playlist1.id,
      displayId: display1.id,
      startDate,
      endDate,
      startTime: '09:00',
      endTime: '17:00',
      daysOfWeek: [1, 2, 3, 4, 5], // Monday-Friday (0=Sunday, 1=Monday, etc.)
      isActive: true,
      priority: 1,
    },
  });
  console.log(`✅ Schedule created: ${schedule.id}`);

  // 8. Create Tags
  console.log('Creating test tags...');
  const tag1 = await prisma.tag.create({
    data: {
      organizationId: organization.id,
      name: 'Marketing',
      color: '#0066cc',
    },
  });

  const tag2 = await prisma.tag.create({
    data: {
      organizationId: organization.id,
      name: 'Seasonal',
      color: '#00cc66',
    },
  });
  console.log(`✅ Tags created: ${tag1.id}, ${tag2.id}`);

  // 9. Create Display Groups
  console.log('Creating test display groups...');
  const group = await prisma.displayGroup.create({
    data: {
      organizationId: organization.id,
      name: 'Test Group',
      description: 'Group for testing',
      displays: {
        create: [
          { displayId: display1.id },
          { displayId: display2.id },
        ],
      },
    },
  });
  console.log(`✅ Display group created: ${group.id}`);

  // 10. Create Audit Logs (for activity tracking)
  await prisma.auditLog.create({
    data: {
      organizationId: organization.id,
      userId: adminUser.id,
      action: 'user_login',
      entityType: 'user',
      entityId: adminUser.id,
      changes: { email: adminUser.email },
    },
  });

  console.log('\n🎉 Database seeding completed successfully!');
  console.log('\n📋 Summary:');
  console.log(`  - Organization: ${organization.name} (${organization.slug})`);
  console.log(`  - Users: 2 (admin@vizora.test, manager@vizora.test)`);
  console.log(`  - Password for all users: Test123!@#`);
  console.log(`  - Content: 3 items`);
  console.log(`  - Displays: 2 devices`);
  console.log(`  - Playlists: 2 playlists with items`);
  console.log(`  - Schedules: 1 schedule`);
  console.log(`  - Tags: 2 tags`);
  console.log(`  - Display Groups: 1 group`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
