"use client";

import { useState, useEffect } from "react";
import { MediaCard, MediaItem } from "./MediaCard";
import { Input } from "@/src/Components/UI/input";
import { Button } from "@/src/Components/UI/button";
import { Search, Image as ImageIcon, Film, LayoutGrid } from "lucide-react";
import { deleteMedia } from "@/src/Action/album/delete-media";

import { MediaLightbox } from "./MediaLightbox";

interface MediaGridProps {
  media: MediaItem[];
  currentUserId: string;
  currentUserRole?: string;
  isOwner: boolean;
}

type FilterType = "all" | "images" | "videos";

export function MediaGrid({ media: initialMedia, currentUserId, currentUserRole, isOwner }: MediaGridProps) {
  const [mediaList, setMediaList] = useState<MediaItem[]>(initialMedia);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Sync with external updates
  useEffect(() => {
    setMediaList(initialMedia);
  }, [initialMedia]);

  const handleDelete = async (mediaId: string) => {
    const previousMediaList = [...mediaList];
    
    // Optimistic delete
    setMediaList((prev) => prev.filter((m) => m.id !== mediaId));

    try {
      const result = await deleteMedia(mediaId);
      if (result.error) {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error(error);
      // Revert on failure
      setMediaList(previousMediaList);
      alert("Failed to delete media.");
    }
  };

  const filteredMedia = mediaList.filter((m) => {
    // Apply search filter (filename, caption, tags)
    if (search) {
      const q = search.toLowerCase();
      const matchFilename = m.filename.toLowerCase().includes(q);
      const matchCaption = m.aiCaption?.toLowerCase().includes(q) ?? false;
      const matchTags = m.aiTags?.some(t => t.label.toLowerCase().includes(q)) ?? false;
      
      if (!matchFilename && !matchCaption && !matchTags) {
        return false;
      }
    }
    
    // Apply type filter
    if (filter === "images" && !m.mimeType.startsWith("image/")) {
      return false;
    }
    if (filter === "videos" && !m.mimeType.startsWith("video/")) {
      return false;
    }
    
    return true;
  });

  const hasAnyMedia = mediaList.length > 0;

  const handleMediaClick = (media: MediaItem) => {
    const index = filteredMedia.findIndex((m) => m.id === media.id);
    if (index !== -1) {
      setLightboxIndex(index);
      setLightboxOpen(true);
    }
  };

  return (
    <div className="space-y-6 mt-6">
      {hasAnyMedia && (
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-surface-sunken p-3 rounded-xl ring-1 ring-white/5">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-subtle" />
            <Input 
              placeholder="Search files..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-surface border-none focus-visible:ring-1 focus-visible:ring-primary/50"
            />
          </div>
          
          <div className="flex bg-surface rounded-lg p-1 w-full sm:w-auto overflow-x-auto">
            <Button 
              variant={filter === "all" ? "default" : "ghost"} 
              size="sm"
              onClick={() => setFilter("all")}
              className="flex-1 sm:flex-none rounded-md"
            >
              <LayoutGrid className="w-4 h-4 mr-2" /> All
            </Button>
            <Button 
              variant={filter === "images" ? "default" : "ghost"} 
              size="sm"
              onClick={() => setFilter("images")}
              className="flex-1 sm:flex-none rounded-md"
            >
              <ImageIcon className="w-4 h-4 mr-2" /> Images
            </Button>
            <Button 
              variant={filter === "videos" ? "default" : "ghost"} 
              size="sm"
              onClick={() => setFilter("videos")}
              className="flex-1 sm:flex-none rounded-md"
            >
              <Film className="w-4 h-4 mr-2" /> Videos
            </Button>
          </div>
        </div>
      )}

      {/* Grid */}
      {filteredMedia.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredMedia.map((m) => (
            <MediaCard 
              key={m.id} 
              media={m} 
              isOwner={isOwner || m.uploaderId === currentUserId} 
              onDelete={handleDelete}
              onClick={handleMediaClick}
            />
          ))}
        </div>
      ) : (
        /* Empty States */
        <div className="py-20 text-center flex flex-col items-center justify-center bg-surface-sunken rounded-2xl ring-1 ring-white/5 border-dashed border border-white/10">
          {!hasAnyMedia ? (
            <>
              <div className="w-16 h-16 bg-surface-elevated rounded-full flex items-center justify-center mb-4">
                <ImageIcon className="h-8 w-8 text-on-surface-subtle opacity-50" />
              </div>
              <h3 className="text-xl font-heading font-semibold text-on-surface">No media yet</h3>
              <p className="text-on-surface-muted mt-2 max-w-sm">
                This album is empty. Be the first to upload photos or videos!
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-surface-elevated rounded-full flex items-center justify-center mb-4">
                <Search className="h-8 w-8 text-on-surface-subtle opacity-50" />
              </div>
              <h3 className="text-xl font-heading font-semibold text-on-surface">No matches found</h3>
              <p className="text-on-surface-muted mt-2 max-w-sm">
                No media matches your search "{search}" and current filter.
              </p>
              <Button 
                variant="outline" 
                className="mt-6"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
              >
                Clear Filters
              </Button>
            </>
          )}
        </div>
      )}

      <MediaLightbox 
        mediaItems={filteredMedia}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        currentUserRole={currentUserRole}
      />
    </div>
  );
}
