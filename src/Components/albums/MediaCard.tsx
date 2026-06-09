"use client";

import Image from "next/image";
import { Trash2, Download, Copy, Heart, MessageCircle, Play, Loader2 } from "lucide-react";
import { useState } from "react";

export type MediaItem = {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  status: string;
  s3Key: string;
  aiCaption: string | null;
  aiQualityScore: number | null;
  aiTags: { label: string; confidence: number }[];
  createdAt: Date;
  uploaderId: string;
  _count: { likes: number; comments: number; favorites: number };
};

interface MediaCardProps {
  media: MediaItem;
  isOwner: boolean;
  onDelete: (mediaId: string) => void;
  onClick: (media: MediaItem) => void;
}

/**
 * Derives a canonical public S3 URL from the s3Key.
 * Falls back to the stored url field if construction fails.
 * Exported so MediaLightbox and other consumers can use the same logic.
 */
export function resolveMediaUrl(media: MediaItem): string {
  const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME;
  const region = process.env.NEXT_PUBLIC_AWS_REGION;

  if (bucket && region && media.s3Key) {
    return `https://${bucket}.s3.${region}.amazonaws.com/${media.s3Key}`;
  }

  // Fallback: use whatever is stored in the DB
  return media.url;
}

export function MediaCard({ media, isOwner, onDelete, onClick }: MediaCardProps) {
  const [copied, setCopied] = useState(false);
  const isVideo = media.mimeType.startsWith("video/");
  const isProcessing = media.status === "PROCESSING";
  const resolvedUrl = resolveMediaUrl(media);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(resolvedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(resolvedUrl, "_blank");
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(media.id);
  };

  return (
    <div 
      className="group relative aspect-square w-full cursor-pointer overflow-hidden rounded-xl bg-surface-sunken ring-1 ring-white/5"
      onClick={() => !isProcessing && onClick(media)}
    >
      {/* Media Content */}
      {isVideo ? (
        <video 
          src={resolvedUrl} 
          className="h-full w-full object-cover" 
          preload="metadata"
        />
      ) : (
        <Image
          unoptimized={true}
          src={resolvedUrl}
          alt={media.filename}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-110"
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
        />
      )}

      {/* Processing State Overlay */}
      {isProcessing && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm text-white">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
          <span className="text-xs font-medium uppercase tracking-wider">Processing</span>
        </div>
      )}

      {/* Video Indicator */}
      {isVideo && !isProcessing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="rounded-full bg-black/40 p-3 backdrop-blur-md transition-transform group-hover:scale-110">
            <Play className="h-6 w-6 text-white fill-white" />
          </div>
        </div>
      )}

      {/* Hover Overlay */}
      {!isProcessing && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex flex-col justify-between p-3">
          {/* Top action bar */}
          <div className="flex justify-end gap-2 transform -translate-y-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <button 
              onClick={handleCopy}
              className="p-1.5 rounded-full bg-black/50 text-white hover:bg-black/80 hover:text-primary transition-colors backdrop-blur-md"
              title="Copy URL"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button 
              onClick={handleDownload}
              className="p-1.5 rounded-full bg-black/50 text-white hover:bg-black/80 hover:text-primary transition-colors backdrop-blur-md"
              title="Download"
            >
              <Download className="h-4 w-4" />
            </button>
            {isOwner && (
              <button 
                onClick={handleDelete}
                className="p-1.5 rounded-full bg-black/50 text-white hover:bg-red-500 hover:text-white transition-colors backdrop-blur-md"
                title="Delete Media"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Bottom info bar */}
          <div className="transform translate-y-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <p className="text-xs font-medium text-white line-clamp-1 mb-2">
              {media.filename}
            </p>
            <div className="flex items-center gap-3 text-white/90 text-xs">
              <div className="flex items-center gap-1">
                <Heart className="h-3.5 w-3.5" />
                <span>{media._count.likes}</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageCircle className="h-3.5 w-3.5" />
                <span>{media._count.comments}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
