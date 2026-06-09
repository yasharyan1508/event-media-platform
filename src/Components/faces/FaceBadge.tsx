import React from "react";
import Image from "next/image";

export function FaceBadge({ similarity, name, avatarUrl }: { similarity: number; name?: string | null; avatarUrl?: string | null }) {
  return (
    <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-black/10 shadow-sm rounded-full px-3 py-1.5 w-fit">
      {avatarUrl ? (
        <img src={avatarUrl} alt={name || "Face"} className="w-5 h-5 rounded-full object-cover" />
      ) : (
        <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center">
          <span className="text-[10px] text-white font-bold">{name?.charAt(0) || "U"}</span>
        </div>
      )}
      <span className="text-xs font-semibold text-gray-800">{name || "Unknown"}</span>
      <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">
        {similarity.toFixed(1)}%
      </span>
    </div>
  );
}
