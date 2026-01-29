const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testDb() {
  try {
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    const userCount = await prisma.user.count();
    console.log('User count:', userCount);
    
    const users = await prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' }
    });
    console.log('Recent users:', users.map(u => u.email).join(', '));
    
    await prisma.$disconnect();
    console.log('✅ Database test complete');
  } catch (error) {
    console.error('❌ Database error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testDb();
