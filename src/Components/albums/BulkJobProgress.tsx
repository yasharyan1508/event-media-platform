"use client";

import { useState, useEffect } from "react";
import { cancelBulkJob } from "@/src/Action/bulk-upload/cancel-bulk-job";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export function BulkJobProgress({
  jobId,
  totalFiles,
  processedFiles,
  failedFiles,
  status,
  onComplete,
}: {
  jobId: string;
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  onComplete?: () => void;
}) {
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (status === "COMPLETED" && onComplete) {
      onComplete();
    }
  }, [status, onComplete]);

  const percentage = Math.round(((processedFiles + failedFiles) / totalFiles) * 100) || 0;

  const handleCancel = async () => {
    setIsCancelling(true);
    await cancelBulkJob(jobId);
    setIsCancelling(false);
  };

  const isFinished = status === "COMPLETED" || status === "FAILED";
  const canCancel = !isFinished && status !== "PENDING" && status !== "PROCESSING" ? false : !isFinished;

  return (
    <div className="p-4 bg-surface rounded-xl border border-surface-container space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {status === "PENDING" && <span className="px-2 py-1 bg-surface-container-highest text-on-surface text-xs font-bold rounded">Waiting...</span>}
          {status === "PROCESSING" && <span className="px-2 py-1 bg-primary/20 text-primary text-xs font-bold rounded flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Uploading...</span>}
          {status === "COMPLETED" && <span className="px-2 py-1 bg-green-500/20 text-green-700 text-xs font-bold rounded">Complete</span>}
          {status === "FAILED" && <span className="px-2 py-1 bg-error/20 text-error text-xs font-bold rounded">Failed</span>}
          
          <span className="text-sm font-medium text-on-surface ml-2">
            {processedFiles} succeeded, {failedFiles} failed of {totalFiles} total
          </span>
        </div>
        
        {canCancel && (
          <button
            onClick={handleCancel}
            disabled={isCancelling}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-error/10 text-error hover:bg-error/20 transition-colors disabled:opacity-50"
          >
            {isCancelling ? "Cancelling..." : "Cancel"}
          </button>
        )}
      </div>

      <div className="w-full bg-surface-container-highest rounded-full h-2 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${status === "FAILED" ? "bg-error" : "bg-primary"}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {isFinished && (
        <div className={`text-sm font-medium flex items-center gap-2 ${status === "COMPLETED" ? "text-green-600" : "text-error"}`}>
          {status === "COMPLETED" ? <CheckCircle className="w-4 h-4"/> : <AlertCircle className="w-4 h-4"/>}
          {status === "COMPLETED" 
            ? "All files have been processed successfully." 
            : "Job finished with errors or was cancelled."}
        </div>
      )}
    </div>
  );
}
