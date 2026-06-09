import { prisma } from "../src/Library/prisma.ts";
import { processNextJob } from "../src/ai-worker.ts";
import { JobStatus } from "@prisma/client";

async function runStuckJob() {
  const mediaId = "cmq64d7bu0009ok9pb30fbdrt";
  
  const job = await prisma.aiProcessingJob.findFirst({
    where: { mediaId: mediaId }
  });

  if (!job) {
    console.log("No job found for mediaId:", mediaId);
    return;
  }

  console.log(`Resetting job ${job.id} to PENDING...`);
  
  await prisma.aiProcessingJob.update({
    where: { id: job.id },
    data: { status: JobStatus.PENDING, attempts: 0 }
  });

  // Make sure to reset the AI processed at so it actually runs gemini
  await prisma.media.update({
    where: { id: mediaId },
    data: { aiProcessedAt: null }
  });

  console.log(`Running processNextJob()...`);
  
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("MANUAL_TIMEOUT")), 60000));
  
  try {
    await Promise.race([processNextJob(), timeout]);
  } catch (err: any) {
    console.log(`Execution stopped: ${err.message}`);
  }
}

runStuckJob().finally(() => prisma.$disconnect());
