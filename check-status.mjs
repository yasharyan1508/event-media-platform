import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  try {
    const result = await prisma.$queryRaw`SELECT DISTINCT status FROM media;`;
    console.log('DISTINCT_STATUS:', JSON.stringify(result));
  } catch (err) {
    console.error(err);
  }
}
main().finally(() => prisma.$disconnect());
