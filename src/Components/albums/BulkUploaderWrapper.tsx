"use client";

import { useRouter } from "next/navigation";
import { BulkUploader } from "./BulkUploader";

export function BulkUploaderWrapper({ albumId, eventId }: { albumId: string, eventId: string }) {
  const router = useRouter();
  
  return (
    <BulkUploader 
      albumId={albumId} 
      eventId={eventId} 
      onUploadComplete={() => {
        router.push(`/events/${eventId}/albums/${albumId}`);
        router.refresh();
      }} 
    />
  );
}
