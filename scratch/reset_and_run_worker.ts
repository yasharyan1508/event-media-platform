import { prisma } from "../src/Library/prisma";
import { processNextJob } from "../src/ai-worker";

async function resetAndRun() {
  const mediaId = "cmq64d7bu0009ok9pb30fbdrt";

  // Find the job
  const job = await prisma.aiProcessingJob.findFirst({
    where: { mediaId: mediaId },
  });

  if (!job) {
    console.error("Job not found for media:", mediaId);
    return;
  }

  // Reset to PENDING
  await prisma.aiProcessingJob.update({
    where: { id: job.id },
    data: {
      status: "PENDING",
      attempts: 0,
      startedAt: null,
      errorLog: [],
    },
  });

  // Make sure the media aiProcessedAt is null, otherwise it skips Gemini!
  await prisma.media.update({
    where: { id: mediaId },
    data: { aiProcessedAt: null, aiCaption: null, aiQualityScore: null },
  });

  console.log(`Reset job ${job.id} for media ${mediaId} to PENDING.`);
  
  // Now run the worker's processNextJob once
  console.log("Running processNextJob()...");
  const result = await processNextJob();
  console.log("processNextJob() returned:", result);
}

resetAndRun()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
