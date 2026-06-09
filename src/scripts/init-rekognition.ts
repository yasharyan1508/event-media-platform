import { initializeCollection } from "../Library/rekognition";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("Starting AWS Rekognition Initialization...");
  
  if (!process.env.REKOGNITION_COLLECTION_ID) {
    console.error("ERROR: REKOGNITION_COLLECTION_ID is missing from .env");
    process.exit(1);
  }

  try {
    await initializeCollection();
    console.log("✅ AWS Rekognition Initialization Complete.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to initialize Rekognition collection:");
    console.error(error);
    process.exit(1);
  }
}

main();
