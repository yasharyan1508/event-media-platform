"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Sparkles, UserSearch } from "lucide-react";

export function EventFaceGallery({ eventId, faceIndexes }: { eventId: string; faceIndexes: any[] }) {
  const [selectedFace, setSelectedFace] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedFace) {
      setResults([]);
      return;
    }

    setLoading(true);
    fetch(`/api/search?type=faces&eventId=${eventId}&faceIndexId=${selectedFace}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setResults(data.data.media || []);
        }
      })
      .finally(() => setLoading(false));
  }, [selectedFace, eventId]);

  if (!faceIndexes || faceIndexes.length === 0) return null;

  return (
    <div className="mt-16 border-t border-gray-200 pt-12">
      <div className="flex items-center gap-3 mb-6">
        <UserSearch className="h-6 w-6 text-purple-500" />
        <h2 className="text-2xl font-bold text-gray-900">Find by Face</h2>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
        {faceIndexes.map((face) => (
          <button
            key={face.id}
            onClick={() => setSelectedFace(selectedFace === face.id ? null : face.id)}
            className={`relative flex-shrink-0 w-16 h-16 rounded-full overflow-hidden border-2 transition-all duration-300 ${
              selectedFace === face.id ? "border-purple-600 scale-110 shadow-lg shadow-purple-200" : "border-transparent hover:scale-105"
            }`}
          >
            {face.user?.avatarUrl ? (
              <img src={face.user.avatarUrl} alt="Face" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-xl">{face.user?.name?.charAt(0) || "U"}</span>
              </div>
            )}
            {selectedFace === face.id && (
              <div className="absolute inset-0 bg-purple-600/20 mix-blend-overlay" />
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div className="py-12 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
        </div>
      )}

      {selectedFace && !loading && results.length > 0 && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {results.map((m) => (
            <div key={m.id} className="relative aspect-square rounded-xl overflow-hidden shadow-sm group ring-1 ring-black/5 hover:ring-purple-500/50 transition">
              <Image unoptimized={true} src={m.url} alt="Match" fill className="object-cover transition-transform duration-700 group-hover:scale-110" />
            </div>
          ))}
        </div>
      )}

      {selectedFace && !loading && results.length === 0 && (
        <div className="py-12 text-center bg-gray-50 rounded-2xl border border-gray-100 mt-6">
          <p className="text-gray-500">No photos found for this person in this event.</p>
        </div>
      )}
    </div>
  );
}
