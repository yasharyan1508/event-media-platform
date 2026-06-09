"use client";

import { useState } from "react";
import { generateEventSummary } from "@/src/Action/event/generate-event-summary";
import { Sparkles, Loader2 } from "lucide-react";

export function GenerateSummaryButton({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const result = await generateEventSummary(eventId);
      if (result.error) {
        alert(result.error);
      }
    } catch (err) {
      alert("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleGenerate}
      disabled={loading}
      className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
      {loading ? "Generating Summary..." : "Generate AI Summary"}
    </button>
  );
}
