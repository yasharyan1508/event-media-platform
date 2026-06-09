"use client";

import { useState, useTransition } from "react";
import { Download, Copy, Share2 } from "lucide-react";
import { downloadMedia } from "../../Action/media/download-media";

export function DownloadShareMenu({ mediaId, className }: { mediaId: string; className?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const res = await downloadMedia(mediaId);
      if ("success" in res && res.success) {
        const a = document.createElement("a");
        a.href = res.downloadUrl;
        a.target = "_blank";
        a.download = "download";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        console.error("Download failed:", "error" in res ? res.error : "Unknown error");
      }
      setIsOpen(false);
    });
  };

  const handleCopySecureLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const res = await downloadMedia(mediaId);
      if ("success" in res && res.success) {
        navigator.clipboard.writeText(res.downloadUrl);
        alert("Secure link copied!");
      } else {
        console.error("Copy failed:", "error" in res ? res.error : "Unknown error");
      }
      setIsOpen(false);
    });
  };

  return (
    <div className={`relative ${className || ""}`}>
      <button 
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="text-white/80 hover:text-white transition-colors p-2 bg-white/10 rounded-full hover:bg-white/20 disabled:opacity-50"
        disabled={isPending}
        title="Share / Download"
      >
        <Share2 className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-black/90 backdrop-blur-md rounded-lg shadow-xl border border-white/10 overflow-hidden flex flex-col z-50">
          <button 
            onClick={handleDownload}
            className="flex items-center gap-3 px-4 py-3 text-sm text-white/90 hover:bg-white/10 transition-colors text-left"
          >
            <Download className="w-4 h-4" />
            Download High-Res
          </button>
          <button 
            onClick={handleCopySecureLink}
            className="flex items-center gap-3 px-4 py-3 text-sm text-white/90 hover:bg-white/10 transition-colors text-left border-t border-white/10"
          >
            <Copy className="w-4 h-4" />
            Copy Secure Link
          </button>
        </div>
      )}
    </div>
  );
}
