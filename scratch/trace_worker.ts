import { prisma } from "./src/Library/prisma";
import { downloadMediaBuffer } from "./src/Library/s3";
import { analyzeEventMedia } from "./src/Library/AI/gemini";
import { searchFacesByImage } from "./src/Library/rekognition";

async function traceStuckJobs() {
  const processingJobs = await prisma.aiProcessingJob.findMany({
    where: { status: 'PROCESSING' }
  });

  console.log(`Found ${processingJobs.length} stuck jobs.`);
  
  for (const job of processingJobs) {
    console.log(`\n--- Tracing Job ${job.id} for Media ${job.mediaId} ---`);
    
    try {
      const media = await prisma.media.findUnique({ where: { id: job.mediaId } });
      if (!media) {
        console.log("Media not found!");
        continue;
      }

      console.log(`[1] Fetching from S3: ${media.s3Key}`);
      const s3Promise = downloadMediaBuffer(media.s3Key);
      const s3Timeout = new Promise((_, r) => setTimeout(() => r(new Error("S3_TIMEOUT")), 5000));
      const buffer = await Promise.race([s3Promise, s3Timeout]) as Buffer;
      console.log(`[1] S3 success! Buffer size: ${buffer.length}`);

      console.log(`[2] Running Gemini Analysis...`);
      const geminiPromise = analyzeEventMedia(buffer, media.mimeType);
      const geminiTimeout = new Promise((_, r) => setTimeout(() => r(new Error("GEMINI_TIMEOUT")), 5000));
      const geminiResult = await Promise.race([geminiPromise, geminiTimeout]);
      console.log(`[2] Gemini success!`, !!geminiResult);

      console.log(`[3] Running Rekognition...`);
      const rekogPromise = searchFacesByImage(buffer);
      const rekogTimeout = new Promise((_, r) => setTimeout(() => r(new Error("REKOGNITION_TIMEOUT")), 5000));
      const matches = await Promise.race([rekogPromise, rekogTimeout]);
      console.log(`[3] Rekognition success! Matches:`, (matches as any).length);

    } catch (err: any) {
      console.log(`FAILED AT SOME STAGE: ${err.message}`);
    }
  }
}

traceStuckJobs()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
