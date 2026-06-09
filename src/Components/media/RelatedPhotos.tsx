"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getRelatedMedia } from "@/src/Action/media/get-related-media";

interface RelatedPhotosProps {
  mediaId: string;
}

type RelatedMedia = {
  id: string;
  url: string;
  filename: string;
  aiCaption: string | null;
  score: number;
};

export function RelatedPhotos({ mediaId }: RelatedPhotosProps) {
  const [photos, setPhotos] = useState<RelatedMedia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getRelatedMedia(mediaId, 6)
      .then((res) => setPhotos(res as any))
      .catch((err) => console.error("Failed to load related media:", err))
      .finally(() => setLoading(false));
  }, [mediaId]);

  if (loading) {
    return <div className="p-6 text-white/50 text-sm">Loading related photos...</div>;
  }

  if (photos.length === 0) {
    return null;
  }

  return (
    <div className="p-6 border-t border-white/10 mt-6">
      <h3 className="text-white/90 font-semibold mb-4 text-sm uppercase tracking-wider">Related Photos</h3>
      <div className="grid grid-cols-2 gap-3">
        {photos.map((photo) => (
          <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden ring-1 ring-white/10 group cursor-pointer">
            <Image 
              unoptimized={true}
              src={photo.url} 
              alt={photo.filename} 
              fill 
              className="object-cover transition-transform duration-500 group-hover:scale-110" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
              <p className="text-white text-xs truncate">{photo.filename}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
