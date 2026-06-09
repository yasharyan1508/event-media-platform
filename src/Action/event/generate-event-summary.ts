"use server";

import { getCurrentUser } from "@/src/Library/dal";
import { prisma } from "@/src/Library/prisma";
import { revalidatePath } from "next/cache";
import { GoogleGenAI } from "@google/genai";
import { Role } from "@prisma/client";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateEventSummary(eventId: string) {
  try {
    const currentUser = await getCurrentUser();

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        albums: {
          include: {
            media: {
              where: {
                aiCaption: { not: null },
              },
              select: {
                aiCaption: true,
                aiQualityScore: true,
                aiTags: { select: { label: true } }
              }
            }
          }
        }
      }
    });

    if (!event) {
      return { error: "Event not found" };
    }

    if (currentUser.role !== Role.ADMIN && currentUser.id !== event.ownerId) {
      return { error: "Forbidden: You do not have permission to generate a summary for this event" };
    }

    // Collect all data
    const allMedia = event.albums.flatMap(a => a.media);

    if (allMedia.length === 0) {
      return { error: "Not enough AI-processed media to generate a summary." };
    }

    // Sort by quality score descending so we give Gemini the best context first
    allMedia.sort((a, b) => (b.aiQualityScore || 0) - (a.aiQualityScore || 0));

    // Take top 50 media items to avoid token limits
    const topMedia = allMedia.slice(0, 50);

    const mediaContext = topMedia.map((m, index) => {
      const tags = m.aiTags.map(t => t.label).join(", ");
      return `Photo ${index + 1} (Quality Score: ${m.aiQualityScore}): ${m.aiCaption}. Tags: ${tags}`;
    }).join("\n");

    const prompt = `You are an AI assistant summarizing an event. The event is titled "${event.title}".
Below is a list of descriptions and tags for the best photos taken at this event.

${mediaContext}

Based on these photos, write a lively, cohesive, and engaging summary of the event (1-2 paragraphs). 
Describe the vibe, the key activities, and what made the event special. Do NOT mention "Photo 1" or quality scores. Write it as a narrative summary.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    });

    const summaryText = response.text;
    if (!summaryText) {
      return { error: "Failed to generate summary from Gemini." };
    }

    await prisma.event.update({
      where: { id: eventId },
      data: {
        aiSummary: summaryText,
        aiSummaryGeneratedAt: new Date(),
        aiSummaryModel: "gemini-2.5-flash",
      }
    });

    revalidatePath(`/events/${eventId}`);
    return { success: true as const, summary: summaryText };
  } catch (error) {
    console.error("Failed to generate event summary:", error);
    return { error: "Internal Server Error" };
  }
}
