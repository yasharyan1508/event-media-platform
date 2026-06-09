import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

async function main() {
  try {
    const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
    const prisma = new PrismaClient({ adapter });
    
    console.log("Checking media_faces count...");
    const count = await prisma.$queryRaw`SELECT COUNT(*) FROM media_faces;`;
    console.log('COUNT_RESULT:', JSON.stringify(count, (key, value) => typeof value === 'bigint' ? value.toString() : value));
    
    await prisma.$disconnect();
  } catch(e) {
    console.error(e);
  }
}
main();
