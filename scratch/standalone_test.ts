import { prisma } from "../src/Library/prisma.ts";
import { downloadMediaBuffer } from "../src/Library/s3.ts";
import sharp from "sharp";
import { GoogleGenAI, Type, Schema } from "@google/genai";

async function run() {
  const mediaId = "cmq64d7bu0009ok9pb30fbdrt";
  
  const media = await prisma.media.findUnique({
    where: { id: mediaId }
  });

  if (!media) {
    console.log("Media not found");
    return;
  }

  console.log(`Starting standalone test for media ${media.s3Key}`);
  
  const s3Start = performance.now();
  const buffer = await downloadMediaBuffer(media.s3Key);
  const s3End = performance.now();
  
  const sharpStart = performance.now();
  const optimized = await sharp(buffer)
    .resize(1080, 1080, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  const sharpEnd = performance.now();

  const geminiStart = performance.now();
  
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = `Analyze this event media carefully. Focus on people, setting, actions, and overall composition.
Return a valid JSON object matching the requested schema.`;

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      caption: { type: Type.STRING },
      qualityScore: { type: Type.INTEGER },
      tags: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
          },
          required: ["label", "confidence"],
        },
      },
    },
    required: ["caption", "qualityScore", "tags"],
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        prompt,
        {
          inlineData: {
            data: optimized.toString("base64"),
            mimeType: "image/webp",
          },
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.2,
      },
    });
    
    const geminiEnd = performance.now();

    console.log("\n--- TIMING RESULTS ---");
    console.log(`S3 ms: ${(s3End - s3Start).toFixed(2)}`);
    console.log(`Sharp ms: ${(sharpEnd - sharpStart).toFixed(2)}`);
    console.log(`Gemini ms: ${(geminiEnd - geminiStart).toFixed(2)}`);
    
    console.log("\n--- RAW GEMINI RESPONSE ---");
    console.log(response.text);

  } catch (err: any) {
    const geminiEnd = performance.now();
    console.log("\n--- TIMING RESULTS ---");
    console.log(`S3 ms: ${(s3End - s3Start).toFixed(2)}`);
    console.log(`Sharp ms: ${(sharpEnd - sharpStart).toFixed(2)}`);
    console.log(`Gemini ms (failed): ${(geminiEnd - geminiStart).toFixed(2)}`);
    console.log("\n--- ERROR ---");
    console.error(err);
  }
}

run().finally(() => prisma.$disconnect());
