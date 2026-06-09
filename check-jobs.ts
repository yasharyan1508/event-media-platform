import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

async function main() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  
  const jobs = await prisma.aiProcessingJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 10
  });

  for (const job of jobs) {
    const media = await prisma.media.findUnique({ where: { id: job.mediaId }, select: { id: true, status: true, aiProcessedAt: true } });
    (job as any).media = media;
  }

  console.log(JSON.stringify(jobs, null, 2));
  await prisma.$disconnect();
}
main().catch(console.error);
