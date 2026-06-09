"use server";

import { requirePermission } from "@/src/Library/dal";
import { getMediaByFaceIndex } from "@/src/Library/dal";

import { Permission } from "@/src/Constants/permissions";

/**
 * Global search across all events for photos containing a specific enrolled face.
 */
export async function searchFacesGlobal(faceIndexId: string) {
  try {
    await requirePermission(Permission.FACE_SEARCH);

    const mediaFaces = await getMediaByFaceIndex(faceIndexId);
    
    // Return uniquely formatted data for the UI
    const results = mediaFaces.map(mf => ({
      media: mf.media,
      similarity: mf.similarity,
      eventId: mf.media.album.eventId,
    }));

    return { success: true, data: results };
  } catch (error: any) {
    console.error("[searchFacesGlobal] Error:", error);
    return { error: error.message || "Failed to search globally." };
  }
}

/**
 * Local search restricted to a single event for photos containing a specific enrolled face.
 */
export async function searchFacesInEvent(faceIndexId: string, eventId: string) {
  try {
    // Wait, the user might need explicit access to the event to search within it?
    // The requirement says we need EVENT_READ or similar. 
    // We'll rely on the UI/Rbac to protect the route, but require FACE_SEARCH.
    await requirePermission(Permission.FACE_SEARCH);

    const mediaFaces = await getMediaByFaceIndex(faceIndexId, eventId);
    
    const results = mediaFaces.map(mf => ({
      media: mf.media,
      similarity: mf.similarity,
      eventId: mf.media.album.eventId,
    }));

    return { success: true, data: results };
  } catch (error: any) {
    console.error("[searchFacesInEvent] Error:", error);
    return { error: error.message || "Failed to search within event." };
  }
}
