import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

async function main() {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  
  const failedJobs = await prisma.aiProcessingJob.findMany({
    where: { status: "FAILED" },
    select: { errorLog: true },
    take: 5,
    orderBy: { createdAt: "desc" }
  });

  for (const job of failedJobs) {
    console.log(job.errorLog);
  }

  await prisma.$disconnect();
}
main().catch(console.error);
