"use server";

import { prisma } from "@/src/Library/prisma";

export async function getRelatedMedia(mediaId: string, limit: number = 8) {
  // 1. Fetch the source media to get its context
  const sourceMedia = await prisma.media.findUnique({
    where: { id: mediaId },
    select: {
      id: true,
      albumId: true,
      album: { select: { eventId: true } },
      aiTags: { select: { label: true } },
    }
  });

  if (!sourceMedia) return [];

  const sourceLabels = sourceMedia.aiTags.map(t => t.label);

  // 2. We could do a complex Raw SQL query to score efficiently in DB.
  // Using Prisma raw query:
  
  const relatedMediaRaw = await prisma.$queryRaw`
    SELECT m.id, m.url, m.filename, m."aiCaption",
      (
        -- Shared tags score (+5 per tag)
        (
          SELECT COUNT(*) 
          FROM ai_tags t 
          WHERE t."mediaId" = m.id AND t.label = ANY(${sourceLabels}::text[])
        ) * 5
        
        -- Same album score (+2)
        + CASE WHEN m."albumId" = ${sourceMedia.albumId} THEN 2 ELSE 0 END
        
        -- Same event score (+3)
        + CASE WHEN m."albumId" IN (
            SELECT a.id FROM albums a WHERE a."eventId" = ${sourceMedia.album.eventId}
          ) THEN 3 ELSE 0 END
      ) as score
    FROM media m
    WHERE m.id != ${sourceMedia.id} 
      AND m.status = 'READY'
      AND (
        m."albumId" IN (SELECT a.id FROM albums a WHERE a."eventId" = ${sourceMedia.album.eventId})
        OR EXISTS (SELECT 1 FROM ai_tags t WHERE t."mediaId" = m.id AND t.label = ANY(${sourceLabels}::text[]))
      )
    ORDER BY score DESC
    LIMIT ${limit}
  `;

  // Map the raw results
  return (relatedMediaRaw as any[]).map(row => ({
    id: row.id,
    url: row.url,
    filename: row.filename,
    aiCaption: row.aiCaption,
    score: Number(row.score)
  }));
}
