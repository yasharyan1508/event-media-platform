import { GoogleGenAI, Type, Schema } from "@google/genai";
import sharp from "sharp";

// Initialize Gemini client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export type AiAnalysisResult = {
  caption: string;
  qualityScore: number;
  tags: { label: string; confidence: number }[];
};

/**
 * Optimizes an image for Gemini Vision analysis.
 * Resizes the image to a maximum of 1080px on the longest side and converts to WebP.
 */
async function optimizeImageForAi(buffer: Buffer): Promise<{ data: Buffer; mimeType: string }> {
  console.log(`[TS: ${new Date().toISOString()}] 4. Starting Sharp resize`);
  const optimized = await sharp(buffer)
    .resize(1080, 1080, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  console.log(`[TS: ${new Date().toISOString()}] 5. Sharp resize completed`);

  return { data: optimized, mimeType: "image/webp" };
}

/**
 * Calls Gemini 2.5 Flash to analyze an event photo.
 * Includes exponential backoff for 429 and 503 API limits.
 */
export async function analyzeEventMedia(buffer: Buffer, originalMimeType: string): Promise<AiAnalysisResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  // Only optimize if it's an image, and safely skip GIFs
  let imagePayload = { data: buffer, mimeType: originalMimeType };
  if (originalMimeType.startsWith("image/") && originalMimeType !== "image/gif") {
    imagePayload = await optimizeImageForAi(buffer);
  }

  const prompt = `Analyze this event media carefully. Focus on people, setting, actions, and overall composition.\nReturn a valid JSON object matching the requested schema.`;

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

  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 2000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          prompt,
          {
            inlineData: {
              data: imagePayload.data.toString("base64"),
              mimeType: imagePayload.mimeType,
            },
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.2,
        },
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Gemini returned an empty response.");
      }

      try {
        const result = JSON.parse(responseText) as AiAnalysisResult;
        return result;
      } catch (err) {
        console.error("Failed to parse Gemini JSON:", responseText);
        throw new Error("Invalid JSON returned by Gemini.");
      }

    } catch (err: any) {
      // Detect rate limits or temporary server unavailability
      const isRateLimit = err?.status === 429 || err?.status === 503 || err?.message?.includes("503") || err?.message?.includes("429");

      if (isRateLimit && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1); // 2000ms, 4000ms, 8000ms
        console.warn(`[Gemini] API Busy (${err.status || '503/429'}). Retrying in ${delay}ms... (Attempt ${attempt}/${MAX_RETRIES})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // If it is NOT a rate limit, or we have hit our maximum retries, throw the error to the worker
      throw err;
    }
  }

  // Fallback catch (should technically be unreachable due to the throw in the loop above)
  throw new Error("Gemini request failed after max retries.");
}