import { prisma } from "./Library/prisma";
import { getNextPendingAiJob, updateAiJobStatus, saveAiMetadata, saveMediaFaces } from "./Library/dal";
import { downloadMediaBuffer } from "./Library/s3";
import { analyzeEventMedia } from "./Library/AI/gemini";
import { searchFacesByImage } from "./Library/rekognition";
import { JobStatus, MediaStatus, Prisma } from "@prisma/client";

// Polling interval in milliseconds
const POLL_INTERVAL = 5000;

async function processNextJob() {
  const job = await getNextPendingAiJob();

  if (!job) {
    return false; // No jobs to process
  }

  const t = (msg: string) => console.log(`[TS: ${new Date().toISOString()}] ${msg}`);
  t(`1. Job claimed: ${job.id}`);

  // 1. Mark as processing
  await updateAiJobStatus(job.id, JobStatus.PROCESSING, {
    startedAt: new Date(),
    attempts: job.attempts + 1,
  });

  try {
    // 2. Fetch Media details
    const media = await prisma.media.findUnique({
      where: { id: job.mediaId },
    });

    if (!media) {
      throw new Error(`Media record ${job.mediaId} not found.`);
    }

    t(`2. Starting S3 download: ${media.s3Key}`);
    const buffer = await downloadMediaBuffer(media.s3Key);
    t(`3. S3 download completed: ${buffer.length} bytes`);

    // Stage A: Gemini Analysis (Skip if already processed)
    if (!media.aiProcessedAt) {
      t(`6. Starting Gemini request`);
      const result = await analyzeEventMedia(buffer, media.mimeType);
      t(`7. Gemini request completed`);

      t(`10. Saving metadata (Gemini)`);
      await saveAiMetadata(job.mediaId, {
        status: MediaStatus.PROCESSING, // Wait for full pipeline completion
        aiCaption: result.caption,
        aiQualityScore: result.qualityScore,
        tags: result.tags,
      });
    } else {
      console.log(`[AI Worker] Skipping Gemini: Media already has AI metadata.`);
    }

    // Stage B: Rekognition Face Search
    if (media.mimeType.startsWith("image/")) {
      t(`8. Starting Rekognition`);
      const matches = await searchFacesByImage(buffer);
      t(`9. Rekognition completed. Matches: ${matches.length}`);

      if (matches.length > 0) {
        t(`10. Saving metadata (Faces)`);
        await saveMediaFaces(job.mediaId, matches);
      }
    } else {
      console.log(`[AI Worker] Skipping Rekognition: Media is not an image.`);
    }

    // 4. Mark job as COMPLETED
    t(`11. Job completed`);
    await prisma.media.update({
      where: { id: job.mediaId },
      data: { status: MediaStatus.READY },
    });

    await updateAiJobStatus(job.id, JobStatus.COMPLETED, {
      completedAt: new Date(),
    });

    console.log(`[AI Worker] Job ${job.id} COMPLETED. Media marked as READY.`);
    return true;

  } catch (error: unknown) {
    console.error(`[AI Worker] Job ${job.id} ERRORED on attempt ${job.attempts + 1}:`, error);

    let errorMsg = "Unknown error";
    if (error instanceof Error) {
      errorMsg = error.message;
    }

    const currentErrorLog = Array.isArray(job.errorLog) ? job.errorLog : [];
    const newLogEntry = { timestamp: new Date().toISOString(), error: errorMsg };

    // Check if this was our final allowed attempt (assuming max 3 attempts)
    const isMaxAttempts = (job.attempts + 1) >= 3;

    if (isMaxAttempts) {
      // PERMANENT FAILURE: Mark BOTH as FAILED
      await updateAiJobStatus(job.id, JobStatus.FAILED, {
        errorLog: [...currentErrorLog, newLogEntry] as Prisma.InputJsonArray,
      });

      await prisma.media.update({
        where: { id: job.mediaId },
        data: { status: MediaStatus.FAILED },
      });
      console.log(`[AI Worker] Job ${job.id} reached max retries. Media permanently FAILED.`);
    } else {
      // RETRY SCENARIO: Put the job back in PENDING so the worker grabs it again later
      await updateAiJobStatus(job.id, JobStatus.PENDING, {
        errorLog: [...currentErrorLog, newLogEntry] as Prisma.InputJsonArray,
      });
      console.log(`[AI Worker] Job ${job.id} returned to PENDING queue for retry.`);
    }

    return true; // We processed a job, even if it threw an exception
  }
}

async function startWorker() {
  console.log("[AI Worker] Started scanning for AI processing jobs...");

  while (true) {
    try {
      const processedSomething = await processNextJob();

      // If we didn't process anything, wait for the poll interval
      if (!processedSomething) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
      } else {
        // If we processed a job, back off slightly before fetching the next to prevent rate limits
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (err) {
      console.error("[AI Worker] Critical error in worker loop:", err);
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
    }
  }
}

// Start the worker immediately since this file is only executed as a standalone script
startWorker().catch(console.error);

export { processNextJob, startWorker };