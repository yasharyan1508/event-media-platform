"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, Heart, MessageCircle } from "lucide-react";
import { MediaItem, resolveMediaUrl } from "./MediaCard";
import { DownloadShareMenu } from "../media/DownloadShareMenu";
import { LikeButton } from "../social/LikeButton";
import { FavoriteButton } from "../social/FavoriteButton";
import { CommentSection, CommentItem } from "../social/CommentSection";
import { getCommentsByMedia } from "../../Action/social/comment.actions";
import { RelatedPhotos } from "../media/RelatedPhotos";

interface MediaLightboxProps {
  mediaItems: MediaItem[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
  currentUserRole?: string;
}

import { ReanalyzeButton } from "./ReanalyzeButton";

export function MediaLightbox({ mediaItems, initialIndex, isOpen, onClose, currentUserRole }: MediaLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [showHeartPing, setShowHeartPing] = useState(false);

  useEffect(() => {
    setCurrentIndex(initialIndex);
    setIsCommentsOpen(false);
  }, [initialIndex, isOpen]);

  const currentMedia = mediaItems[currentIndex];

  useEffect(() => {
    if (isOpen && isCommentsOpen && currentMedia) {
      getCommentsByMedia(currentMedia.id).then((res) => {
        if ("success" in res && res.success) {
          setComments(res.comments as any);
        }
      });
    }
  }, [isOpen, isCommentsOpen, currentMedia?.id]);

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : mediaItems.length - 1));
  }, [mediaItems.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < mediaItems.length - 1 ? prev + 1 : 0));
  }, [mediaItems.length]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") handlePrevious();
      if (e.key === "ArrowRight") handleNext();
    };

    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "auto";
    };
  }, [isOpen, onClose, handleNext, handlePrevious]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowHeartPing(true);
    setTimeout(() => setShowHeartPing(false), 800);
    if (currentMedia) {
      const btn = document.getElementById(`like-btn-${currentMedia.id}`);
      if (btn) btn.click();
    }
  }, [currentMedia?.id]);

  if (!isOpen || mediaItems.length === 0 || !currentMedia) return null;

  const isVideo = currentMedia.mimeType.startsWith("video/");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-10">
        <div className="text-white">
          <p className="font-medium text-sm sm:text-base line-clamp-1">{currentMedia.filename}</p>
          <p className="text-xs text-white/60">
            {currentIndex + 1} of {mediaItems.length}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {(currentUserRole === "ADMIN" || currentUserRole === "PHOTOGRAPHER") && (
            <ReanalyzeButton mediaId={currentMedia.id} />
          )}
          <DownloadShareMenu mediaId={currentMedia.id} />
          <button 
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors p-2 bg-white/10 rounded-full hover:bg-white/20"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Navigation Buttons */}
      {mediaItems.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); handlePrevious(); }}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-2 sm:p-3 bg-black/20 hover:bg-black/50 rounded-full transition-all z-10"
          >
            <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className={`absolute top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-2 sm:p-3 bg-black/20 hover:bg-black/50 rounded-full transition-all z-10 ${isCommentsOpen ? "right-[400px]" : "right-2 sm:right-4"}`}
          >
            <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>
        </>
      )}

      {/* Main Content Area */}
      <div 
        className="relative w-full h-full flex items-center justify-center p-4 sm:p-16 transition-all duration-300"
        style={{ marginRight: isCommentsOpen ? "384px" : "0" }}
        onClick={onClose}
      >
        <div 
          className="relative w-full h-full max-w-6xl flex items-center justify-center cursor-pointer"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={handleDoubleClick}
        >
          {isVideo ? (
            <video
              src={resolveMediaUrl(currentMedia)}
              controls
              autoPlay
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl ring-1 ring-white/10"
              onDoubleClick={(e) => { e.preventDefault(); handleDoubleClick(e); }}
            />
          ) : (
            <div className="relative w-full h-full flex items-center justify-center select-none">
              <Image
                unoptimized={true}
                src={resolveMediaUrl(currentMedia)}
                alt={currentMedia.filename}
                fill
                className="object-contain drop-shadow-2xl"
                sizes="100vw"
                priority
              />
            </div>
          )}

          {/* Double Tap Heart Ping */}
          {showHeartPing && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
              <Heart className="w-32 h-32 text-white fill-white animate-ping drop-shadow-2xl" />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Bar */}
      <div 
        className="absolute bottom-0 left-0 p-6 flex justify-center bg-gradient-to-t from-black/80 to-transparent z-10 transition-all duration-300" 
        style={{ right: isCommentsOpen ? "384px" : "0" }}
      >
        <div className="flex gap-6 bg-black/50 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 shadow-xl">
          <LikeButton mediaId={currentMedia.id} initialIsLiked={false} initialCount={currentMedia._count.likes} />
          <div className="w-px bg-white/20 h-6 mx-2" />
          <FavoriteButton mediaId={currentMedia.id} initialIsFavorited={false} />
          <div className="w-px bg-white/20 h-6 mx-2" />
          <button 
            onClick={() => setIsCommentsOpen(!isCommentsOpen)} 
            className="flex items-center gap-2 text-white/90 hover:text-white transition-colors"
          >
            <MessageCircle className="w-5 h-5 text-blue-400 fill-blue-400/20" />
            <span className="font-medium">{currentMedia._count.comments}</span>
          </button>
        </div>
      </div>

      {/* Comments Sidebar */}
      <div 
        className={`absolute top-0 right-0 h-full w-96 bg-black/90 transform transition-transform duration-300 z-40 flex flex-col overflow-y-auto ${isCommentsOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex-1 min-h-0 shrink-0">
          <CommentSection mediaId={currentMedia.id} initialComments={comments} />
        </div>
        <div className="shrink-0 pb-20">
          <RelatedPhotos mediaId={currentMedia.id} />
        </div>
      </div>
    </div>
  );
}
