import prismaPackage from '@prisma/client';

const { PrismaClient } = prismaPackage;
const prisma = new PrismaClient();

async function main() {
  await prisma.role.upsert({
    where: { code: 'LEARNER' },
    update: { name: 'Learner', isActive: true },
    create: { code: 'LEARNER', name: 'Learner', isActive: true },
  });
}

main()
  .catch((error) => {
    console.error(error?.message || 'Seed failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
