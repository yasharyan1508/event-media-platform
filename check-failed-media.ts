import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

async function main() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  
  const mediaFailed = await prisma.media.count({ where: { status: "FAILED" } });
  console.log(`MEDIA FAILED: ${mediaFailed}`);

  await prisma.$disconnect();
}
main().catch(console.error);
