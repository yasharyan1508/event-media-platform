import { downloadMediaBuffer } from "../src/Library/s3.ts";

async function runTest() {
  const s3Key = "uploads/cmq2p8dnv0000io9pz0g9x3ng/1780978052997-Picsart_26-06-08_08-42-51-015.jpg.jpeg";
  
  console.log("--- S3 Download Test ---");
  for (let i = 1; i <= 3; i++) {
    const start = Date.now();
    try {
      const buffer = await downloadMediaBuffer(s3Key);
      const duration = Date.now() - start;
      console.log(`Attempt ${i}: SUCCESS | Duration: ${duration}ms | Size: ${buffer.length} bytes`);
    } catch (err: any) {
      const duration = Date.now() - start;
      console.log(`Attempt ${i}: FAILURE | Duration: ${duration}ms | Error: ${err.message}`);
    }
  }
}

runTest().catch(console.error);
