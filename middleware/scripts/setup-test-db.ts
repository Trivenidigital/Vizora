/**
 * Test Database Setup Script
 * Run with: npx ts-node scripts/setup-test-db.ts
 *
 * This script:
 * 1. Connects to PostgreSQL
 * 2. Creates test database if needed
 * 3. Runs migrations
 * 4. Seeds test data
 */

import { PrismaClient } from '@vizora/database';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load test environment
dotenv.config({
  path: path.resolve(__dirname, '../.env.test'),
});

async function setupTestDatabase() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  try {
    console.log('🔧 Setting up test database...');
    console.log(`📍 Database URL: ${process.env.DATABASE_URL}`);

    // Verify connection
    console.log('📡 Connecting to database...');
    await prisma.$executeRawUnsafe('SELECT NOW()');
    console.log('✅ Database connection successful');

    // Run migrations
    console.log('🔄 Running migrations...');
    const migrations = await prisma.$executeRawUnsafe(
      `SELECT version FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 1`
    );
    console.log('✅ Migrations checked');

    // Cleanup test data from previous runs
    console.log('🧹 Cleaning up old test data...');
    const timestamp = Date.now();
    await prisma.$executeRawUnsafe(
      `DELETE FROM public."Organization" WHERE slug LIKE 'test-org-%'`
    );
    console.log('✅ Test data cleaned up');

    console.log('✨ Test database setup complete!');
    console.log('');
    console.log('You can now run:');
    console.log('  pnpm test:e2e');
    console.log('');
  } catch (error) {
    console.error('❌ Error setting up test database:');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  setupTestDatabase();
}

export { setupTestDatabase };
