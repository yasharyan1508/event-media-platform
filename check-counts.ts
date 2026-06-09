import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

async function main() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  
  const pending = await prisma.aiProcessingJob.count({ where: { status: "PENDING" } });
  const processing = await prisma.aiProcessingJob.count({ where: { status: "PROCESSING" } });
  const completed = await prisma.aiProcessingJob.count({ where: { status: "COMPLETED" } });
  const failed = await prisma.aiProcessingJob.count({ where: { status: "FAILED" } });

  const mediaReady = await prisma.media.count({ where: { status: "READY" } });
  const mediaProcessing = await prisma.media.count({ where: { status: "PROCESSING" } });

  console.log("=== BEFORE WORKER ===");
  console.log(`PENDING: ${pending}`);
  console.log(`PROCESSING: ${processing}`);
  console.log(`COMPLETED: ${completed}`);
  console.log(`FAILED: ${failed}`);
  console.log(`MEDIA READY: ${mediaReady}`);
  console.log(`MEDIA PROCESSING: ${mediaProcessing}`);

  await prisma.$disconnect();
}
main().catch(console.error);
