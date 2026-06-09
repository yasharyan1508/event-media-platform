import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL } as any);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("--- 3. PROCESSING JOBS ---");
  const processingJobs = await prisma.aiProcessingJob.findMany({
    where: { status: 'PROCESSING' }
  });
  console.log(JSON.stringify(processingJobs, null, 2));

  console.log("\n--- 4. FAILED JOBS ---");
  const failedJobs = await prisma.aiProcessingJob.findMany({
    where: { status: 'FAILED' },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log(JSON.stringify(failedJobs, null, 2));

  console.log("\n--- 2. STUCK MEDIA DETAILS ---");
  const stuckMediaIds = processingJobs.map(j => j.mediaId);
  if (stuckMediaIds.length > 0) {
    const stuckMedia = await prisma.media.findMany({
      where: { id: { in: stuckMediaIds } }
    });
    for (const media of stuckMedia) {
      const job = processingJobs.find(j => j.mediaId === media.id);
      console.log({
        mediaId: media.id,
        filename: media.filename,
        s3Key: media.s3Key,
        jobId: job?.id,
        attempts: job?.attempts,
        errorLog: job?.errorLog
      });
    }
  } else {
    console.log("No stuck media found.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
