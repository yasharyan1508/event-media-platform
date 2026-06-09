"use client";

import { X, CheckCircle, AlertCircle, FileImage, FileVideo } from "lucide-react";

export type BulkFileItem = {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  errorMessage?: string;
  s3Key?: string;
};

export function BulkFileList({
  files,
  onRemoveFile,
  isUploading,
}: {
  files: BulkFileItem[];
  onRemoveFile: (index: number) => void;
  isUploading: boolean;
}) {
  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const uploadedCount = files.filter(f => f.status === "done").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="max-h-[400px] overflow-y-auto pr-2 space-y-2 border border-surface-container rounded-xl p-4 bg-surface">
        {files.map((item, index) => (
          <div key={`${item.file.name}-${index}`} className="flex items-center gap-3 p-3 bg-surface-container-lowest rounded-lg border border-surface-container">
            <div className="flex-shrink-0 text-primary">
              {item.file.type.startsWith("video/") ? (
                <FileVideo className="w-8 h-8" />
              ) : (
                <FileImage className="w-8 h-8" />
              )}
            </div>

            <div className="flex-grow min-w-0 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="truncate text-sm font-medium text-on-surface">
                  {item.file.name}
                </span>
                <span className="text-xs text-on-surface-variant flex-shrink-0 ml-2">
                  {formatSize(item.file.size)}
                </span>
              </div>

              {item.status === "uploading" && (
                <div className="w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-300"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}

              {item.status === "error" && (
                <div className="text-xs text-error font-medium flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {item.errorMessage || "Upload failed"}
                </div>
              )}
            </div>

            <div className="flex-shrink-0 w-8 flex justify-center items-center">
              {item.status === "done" && (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
              {item.status === "pending" && !isUploading && (
                <button
                  type="button"
                  onClick={() => onRemoveFile(index)}
                  className="text-on-surface-variant hover:text-error transition-colors p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
              {item.status === "uploading" && (
                <span className="text-xs font-medium text-primary">{item.progress}%</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {isUploading && (
        <div className="text-sm font-medium text-on-surface-variant text-center">
          {uploadedCount} of {files.length} files uploaded
        </div>
      )}
    </div>
  );
}
