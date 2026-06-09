"use client";

import { useOptimistic, useTransition } from "react";
import { Star } from "lucide-react";
import { toggleFavorite } from "../../Action/social/toggle-favorite";

interface FavoriteButtonProps {
  mediaId: string;
  initialIsFavorited: boolean;
}

export function FavoriteButton({ mediaId, initialIsFavorited }: FavoriteButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [optimisticState, addOptimisticState] = useOptimistic(
    { isFavorited: initialIsFavorited },
    (state, newIsFavorited: boolean) => ({
      isFavorited: newIsFavorited,
    })
  );

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newIsFavorited = !optimisticState.isFavorited;
    startTransition(async () => {
      addOptimisticState(newIsFavorited);
      await toggleFavorite(mediaId);
    });
  };

  return (
    <button 
      onClick={handleFavorite} 
      disabled={isPending}
      className="flex items-center gap-2 transition-colors disabled:opacity-70"
      title={optimisticState.isFavorited ? "Unfavorite" : "Favorite"}
    >
      <Star 
        className={`w-5 h-5 transition-transform ${optimisticState.isFavorited ? "text-yellow-400 fill-yellow-400 scale-110" : "text-white/90 hover:scale-110"}`} 
      />
    </button>
  );
}
