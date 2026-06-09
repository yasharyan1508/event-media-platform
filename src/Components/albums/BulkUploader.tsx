"use client";

import { useState, useRef } from "react";
import { UploadCloud } from "lucide-react";
import { BulkFileList, BulkFileItem } from "./BulkFileList";
import { BulkJobProgress } from "./BulkJobProgress";
import { createBulkJob } from "@/src/Action/bulk-upload/create-bulk-job";
import { reportFileUploaded } from "@/src/Action/bulk-upload/report-file-uploaded";
import { reportFileFailed } from "@/src/Action/bulk-upload/report-file-failed";

export function BulkUploader({
  albumId,
  eventId,
  onUploadComplete,
}: {
  albumId: string;
  eventId: string;
  onUploadComplete: () => void;
}) {
  const [selectedFiles, setSelectedFiles] = useState<BulkFileItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<{
    processedFiles: number;
    failedFiles: number;
    totalFiles: number;
    status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 209715200; // 200MB
  const MAX_FILES = 100;
  const CONCURRENCY_LIMIT = 5;

  const handleFiles = (files: File[]) => {
    setErrorMessage(null);
    let validFiles = [...files];

    if (selectedFiles.length + validFiles.length > MAX_FILES) {
      setErrorMessage(`You can only upload up to ${MAX_FILES} files at once.`);
      validFiles = validFiles.slice(0, MAX_FILES - selectedFiles.length);
    }

    const newItems: BulkFileItem[] = [];
    for (const file of validFiles) {
      if (file.size > MAX_FILE_SIZE) {
        setErrorMessage(`File ${file.name} exceeds the 200MB limit and was skipped.`);
        continue;
      }
      if (!file.type.startsWith("image/") && file.type !== "video/mp4") {
        setErrorMessage(`File ${file.name} is not a supported format.`);
        continue;
      }
      newItems.push({ file, status: "pending", progress: 0 });
    }

    setSelectedFiles((prev) => [...prev, ...newItems]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const updateFileState = (index: number, updates: Partial<BulkFileItem>) => {
    setSelectedFiles((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  };

  const startUpload = async () => {
    if (selectedFiles.length === 0) return;
    setErrorMessage(null);
    setIsUploading(true);

    const filesPayload = selectedFiles.map((f) => ({
      filename: f.file.name,
      contentType: f.file.type,
      fileSize: f.file.size,
    }));

    const result = await createBulkJob({ albumId, files: filesPayload });

    if ("error" in result) {
      setErrorMessage(result.error);
      setIsUploading(false);
      return;
    }

    const { jobId, presignedFiles } = result;
    setCurrentJobId(jobId);
    setJobProgress({
      processedFiles: 0,
      failedFiles: 0,
      totalFiles: selectedFiles.length,
      status: "PROCESSING",
    });

    let currentIndex = 0;
    let activeUploads = 0;

    return new Promise<void>((resolve) => {
      const processNext = async () => {
        if (currentIndex >= selectedFiles.length && activeUploads === 0) {
          resolve();
          return;
        }

        while (activeUploads < CONCURRENCY_LIMIT && currentIndex < selectedFiles.length) {
          const index = currentIndex;
          currentIndex++;
          activeUploads++;

          const fileItem = selectedFiles[index];
          const presignedFile = presignedFiles[index];

          if (!presignedFile) {
             updateFileState(index, { status: "error", errorMessage: "Missing presigned URL" });
             await reportFileFailed({ jobId, filename: fileItem.file.name, errorMessage: "Missing presigned URL" }).then(res => {
               if ('success' in res && res.success) {
                 const pFiles = res.processedFiles ?? 0;
                 const fFiles = res.failedFiles ?? 0;
                 setJobProgress(prev => prev ? { ...prev, processedFiles: pFiles, failedFiles: fFiles, status: res.isComplete ? (fFiles > 0 && pFiles === 0 ? "FAILED" : "COMPLETED") : "PROCESSING" } : null);
               }
             });
             activeUploads--;
             processNext();
             continue;
          }

          updateFileState(index, { status: "uploading", progress: 0, s3Key: presignedFile.s3Key });

          uploadFileXHR(
            fileItem.file,
            presignedFile.presignedUrl,
            (progress) => updateFileState(index, { progress }),
          )
            .then(async () => {
              updateFileState(index, { status: "done", progress: 100 });
              const res = await reportFileUploaded({
                jobId,
                s3Key: presignedFile.s3Key,
                filename: fileItem.file.name,
                contentType: fileItem.file.type,
                fileSize: fileItem.file.size,
              });
              if ('success' in res && res.success) {
                const pFiles = res.processedFiles ?? 0;
                setJobProgress(prev => prev ? { ...prev, processedFiles: pFiles, status: res.isComplete ? "COMPLETED" : "PROCESSING" } : null);
                if (res.isComplete) onUploadComplete();
              }
            })
            .catch(async (err) => {
              const errorMsg = err instanceof Error ? err.message : "Upload failed";
              updateFileState(index, { status: "error", errorMessage: errorMsg });
              const res = await reportFileFailed({
                jobId,
                filename: fileItem.file.name,
                errorMessage: errorMsg,
              });
              if ('success' in res && res.success) {
                const pFiles = res.processedFiles ?? 0;
                const fFiles = res.failedFiles ?? 0;
                setJobProgress(prev => prev ? { ...prev, processedFiles: pFiles, failedFiles: fFiles, status: res.isComplete ? (pFiles > 0 ? "COMPLETED" : "FAILED") : "PROCESSING" } : null);
                if (res.isComplete) onUploadComplete();
              }
            })
            .finally(() => {
              activeUploads--;
              processNext();
            });
        }
      };

      processNext();
    });
  };

  const uploadFileXHR = (file: File, url: string, onProgress: (p: number) => void) => {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.open("PUT", url, true);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`S3 upload failed with status ${xhr.status}`));
        }
      };
      xhr.onerror = () => {
        reject(new Error("Network error during upload"));
      };
      xhr.send(file);
    });
  };

  const reset = () => {
    setSelectedFiles([]);
    setIsUploading(false);
    setCurrentJobId(null);
    setJobProgress(null);
    setErrorMessage(null);
  };

  const totalSize = selectedFiles.reduce((acc, f) => acc + f.file.size, 0);
  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {errorMessage && (
        <div className="p-4 bg-error/10 text-error rounded-xl border border-error/20 font-medium">
          {errorMessage}
        </div>
      )}

      {jobProgress && currentJobId && (
        <BulkJobProgress
          jobId={currentJobId}
          totalFiles={jobProgress.totalFiles}
          processedFiles={jobProgress.processedFiles}
          failedFiles={jobProgress.failedFiles}
          status={jobProgress.status}
        />
      )}

      {!isUploading && !jobProgress && (
        <div
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-surface-container hover:bg-surface-elevated"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            multiple
            accept="image/*,video/mp4"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
          />
          <UploadCloud className="w-12 h-12 text-primary mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-on-surface">Click or drag files here</h3>
          <p className="text-on-surface-variant mt-2">Up to 100 files, max 200MB each (Images & MP4)</p>
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-on-surface">
              {selectedFiles.length} file{selectedFiles.length !== 1 && "s"} selected
            </h4>
            <span className="text-sm font-medium text-on-surface-variant">
              Total size: {formatSize(totalSize)}
            </span>
          </div>

          <BulkFileList files={selectedFiles} onRemoveFile={removeFile} isUploading={isUploading} />

          {!isUploading && !jobProgress && (
            <button
              onClick={startUpload}
              className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-sm"
            >
              Start Upload
            </button>
          )}

          {jobProgress && (jobProgress.status === "COMPLETED" || jobProgress.status === "FAILED") && (
            <button
              onClick={reset}
              className="w-full py-3 bg-surface-container text-on-surface rounded-xl font-bold hover:bg-surface-container-highest transition-colors shadow-sm"
            >
              Upload More Files
            </button>
          )}
        </div>
      )}
    </div>
  );
}
