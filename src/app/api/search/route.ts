import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/src/Library/dal";
import { prisma } from "@/src/Library/prisma";

const SearchQuerySchema = z.object({
  q: z.string().min(1).optional(),
  type: z.enum(["tags", "faces", "all"]).default("all"),
  eventId: z.string().optional(),
  faceIndexId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const parsed = SearchQuerySchema.safeParse({
      q: searchParams.get("q") || undefined,
      type: searchParams.get("type") || "all",
      eventId: searchParams.get("eventId") || undefined,
      faceIndexId: searchParams.get("faceIndexId") || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid search parameters" }, { status: 400 });
    }

    const { q, type, eventId, faceIndexId } = parsed.data;

    const baseWhere: any = {};
    if (eventId) {
      baseWhere.album = { eventId };
    }

    let results: any = { media: [] };

    // 1. Tag Search
    if ((type === "tags" || type === "all") && q) {
      const tagResults = await prisma.media.findMany({
        where: {
          ...baseWhere,
          aiTags: {
            some: {
              label: { contains: q, mode: "insensitive" }
            }
          }
        },
        include: { aiTags: true, album: { select: { eventId: true } } },
        take: 50,
      });
      results.media = [...results.media, ...tagResults];
    }

    // 2. Face Search
    if ((type === "faces" || type === "all") && faceIndexId) {
      const faceResults = await prisma.media.findMany({
        where: {
          ...baseWhere,
          detectedFaces: {
            some: {
              faceIndexId: faceIndexId
            }
          }
        },
        include: { 
          detectedFaces: { where: { faceIndexId } },
          album: { select: { eventId: true } } 
        },
        take: 50,
      });
      
      // Merge results avoiding duplicates
      const existingIds = new Set(results.media.map((m: any) => m.id));
      for (const f of faceResults) {
        if (!existingIds.has(f.id)) {
          results.media.push(f);
        }
      }
    }

    return NextResponse.json({ success: true, data: results });
  } catch (error: any) {
    console.error("[Search API]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
