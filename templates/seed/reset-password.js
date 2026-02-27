const { PrismaClient } = require('../../packages/database/src/generated/prisma');
const bcrypt = require('../../middleware/node_modules/bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('TestPass123!', 12);

  const user = await prisma.user.findFirst({ where: { email: 'e2etest@vizora.cloud' } });
  if (user) {
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: password } });
    console.log('Updated password for', user.email);
  } else {
    console.log('User not found, creating demo@vizora.cloud');
    const org = await prisma.organization.findFirst({ where: { name: { not: 'Vizora System' } } });
    await prisma.user.create({
      data: {
        email: 'demo@vizora.cloud',
        password,
        name: 'Demo User',
        role: 'admin',
        organizationId: org.id,
      },
    });
    console.log('Created demo@vizora.cloud');
  }
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
