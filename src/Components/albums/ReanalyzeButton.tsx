"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { requestAiReanalyze } from "@/src/Action/album/request-ai-reanalyze";

interface ReanalyzeButtonProps {
  mediaId: string;
}

export function ReanalyzeButton({ mediaId }: ReanalyzeButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleReanalyze = async () => {
    setLoading(true);
    try {
      const result = await requestAiReanalyze(mediaId);
      if (result.error) {
        alert(result.error);
      } else {
        alert("Reanalysis queued successfully. It may take a minute to update.");
      }
    } catch (err) {
      alert("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleReanalyze}
      disabled={loading}
      className="text-white/80 hover:text-white transition-colors p-2 bg-white/10 rounded-full hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
      title="Reanalyze Image AI"
    >
      <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
    </button>
  );
}
