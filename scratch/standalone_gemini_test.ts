import { prisma } from "../src/Library/prisma";
import { downloadMediaBuffer } from "../src/Library/s3";
import sharp from "sharp";
import { GoogleGenAI, Schema, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function runStandalone(mediaId: string) {
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) {
    console.error("Media not found:", mediaId);
    return;
  }

  console.log("Media found. S3 Key:", media.s3Key);

  // S3
  const s3Start = Date.now();
  const buffer = await downloadMediaBuffer(media.s3Key);
  const s3End = Date.now();
  console.log(`S3 ms: ${s3End - s3Start}`);

  // Sharp
  const sharpStart = Date.now();
  const optimized = await sharp(buffer)
    .resize(1080, 1080, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  const sharpEnd = Date.now();
  console.log(`Sharp ms: ${sharpEnd - sharpStart}`);

  // Gemini
  const prompt = `Analyze this event media carefully. Focus on people, setting, actions, and overall composition.
Return a valid JSON object matching the requested schema.`;

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      caption: {
        type: Type.STRING,
        description: "A concise, engaging description of what is happening in the photo. 1-2 sentences.",
      },
      qualityScore: {
        type: Type.INTEGER,
        description: "An integer from 1 to 100 representing the photographic quality (focus, lighting, composition).",
      },
      tags: {
        type: Type.ARRAY,
        description: "A list of relevant tags extracted from the image. Max 10 tags.",
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            confidence: { type: Type.NUMBER, description: "Float between 0.0 and 1.0" },
          },
          required: ["label", "confidence"],
        },
      },
    },
    required: ["caption", "qualityScore", "tags"],
  };

  const geminiStart = Date.now();
  
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
    
    const geminiEnd = Date.now();
    console.log(`Gemini ms: ${geminiEnd - geminiStart}`);
    
    console.log("=== RAW GEMINI RESPONSE ===");
    console.log(response.text);
    console.log("===========================");
    
  } catch (err) {
    const geminiEnd = Date.now();
    console.log(`Gemini ms: ${geminiEnd - geminiStart}`);
    console.error("Gemini Error:", err);
  }
}

runStandalone("cmq64d7bu0009ok9pb30fbdrt")
  .catch(console.error)
  .finally(() => prisma.$disconnect());
