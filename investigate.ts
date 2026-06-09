import { prisma } from "./src/Library/prisma";

async function main() {
  console.log('--- 1. Current counts ---');
  const jobStatusCounts = await prisma.aiProcessingJob.groupBy({
    by: ['status'],
    _count: { status: true }
  });
  console.log('AiProcessingJob counts:', jobStatusCounts);

  const mediaStatusCounts = await prisma.media.groupBy({
    by: ['status'],
    _count: { status: true }
  });
  console.log('Media counts:', mediaStatusCounts);

  console.log('\n--- 2 & 3. Stuck Media Details ---');
  const stuckMedia = await prisma.media.findMany({
    where: { status: 'PROCESSING' },
    select: {
      id: true,
      s3Key: true,
      createdAt: true,
    }
  });

  for (const media of stuckMedia) {
    const job = await prisma.aiProcessingJob.findUnique({
      where: { mediaId: media.id }
    });
    console.log({
      mediaId: media.id,
      s3Key: media.s3Key,
      uploadTime: media.createdAt,
      jobStatus: job?.status,
      attempts: job?.attempts,
      errorLog: JSON.stringify(job?.errorLog)
    });
  }
}

main().catch(console.error);
