"use client";

import { useOptimistic, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleLike } from "../../Action/social/toggle-like";

interface LikeButtonProps {
  mediaId: string;
  initialIsLiked: boolean;
  initialCount: number;
}

export function LikeButton({ mediaId, initialIsLiked, initialCount }: LikeButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [optimisticState, addOptimisticState] = useOptimistic(
    { isLiked: initialIsLiked, count: initialCount },
    (state, newIsLiked: boolean) => ({
      isLiked: newIsLiked,
      count: newIsLiked ? state.count + 1 : state.count - 1,
    })
  );

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newIsLiked = !optimisticState.isLiked;
    startTransition(async () => {
      addOptimisticState(newIsLiked);
      await toggleLike(mediaId);
    });
  };

  return (
    <button 
      id={`like-btn-${mediaId}`}
      onClick={handleLike} 
      disabled={isPending}
      className="flex items-center gap-2 transition-colors disabled:opacity-70"
      title={optimisticState.isLiked ? "Unlike" : "Like"}
    >
      <Heart 
        className={`w-5 h-5 transition-transform ${optimisticState.isLiked ? "text-red-500 fill-red-500 scale-110" : "text-white/90 hover:scale-110"}`} 
      />
      <span className="font-medium text-white/90">{optimisticState.count}</span>
    </button>
  );
}
