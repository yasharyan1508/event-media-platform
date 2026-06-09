"use client";

import { useState, useRef } from "react";
import { uploadMedia } from "@/src/Action/album/upload-media";
import { UploadCloud, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface MediaUploaderProps {
  albumId: string;
}

export function MediaUploader({ albumId }: MediaUploaderProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [errors, setErrors] = useState<string[]>([]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
      setErrors([]);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    
    setIsUploading(true);
    setProgress({ completed: 0, total: files.length });
    setErrors([]);

    let successCount = 0;
    const newErrors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        // 1. Get Presigned URL
        const res = await fetch("/api/upload/presigned", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            fileSize: file.size,
          }),
        });

        if (!res.ok) {
          throw new Error(`Failed to get presigned URL for ${file.name}`);
        }

        const { presignedUrl, s3Key } = await res.json();

        // 2. Upload to S3
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", presignedUrl, true);
          xhr.setRequestHeader("Content-Type", file.type);
          
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`S3 upload failed for ${file.name}`));
            }
          };
          xhr.onerror = () => reject(new Error(`Network error during S3 upload for ${file.name}`));
          xhr.send(file);
        });

        // 3. Call server action
        const actionRes = await uploadMedia({
          albumId,
          s3Key,
          filename: file.name,
          mimeType: file.type,
          size: file.size,
        });

        if (actionRes.error) {
          throw new Error(`${file.name}: ${actionRes.error}`);
        }

        successCount++;
        setProgress((prev) => ({ ...prev, completed: prev.completed + 1 }));

      } catch (err: any) {
        console.error(err);
        newErrors.push(err.message || `Failed to upload ${file.name}`);
      }
    }

    setIsUploading(false);
    
    if (newErrors.length > 0) {
      setErrors(newErrors);
    }

    if (successCount > 0) {
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-surface-sunken p-6 rounded-2xl ring-1 ring-white/5 space-y-6">
      <div 
        className="border-2 border-dashed border-primary/30 rounded-xl p-10 text-center cursor-pointer hover:bg-surface-elevated transition-colors"
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          multiple 
          accept="image/*,video/mp4" 
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />
        <UploadCloud className="w-12 h-12 text-primary mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-on-surface">Select Media to Upload</h3>
        <p className="text-on-surface-muted mt-2">Images or MP4 Videos</p>
      </div>

      {files.length > 0 && (
        <div className="space-y-4">
          <h4 className="font-medium text-on-surface">{files.length} files selected</h4>
          
          <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`} className="flex items-center justify-between bg-surface p-3 rounded-lg ring-1 ring-white/5">
                <div className="truncate pr-4 text-sm text-on-surface">{file.name}</div>
                {!isUploading && (
                  <button onClick={() => removeFile(index)} className="text-red-500 hover:text-red-400 p-1">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {errors.length > 0 && (
            <div className="bg-red-500/10 text-red-500 p-3 rounded-lg text-sm space-y-1">
              {errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}

          {isUploading ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-medium text-on-surface">
                <span>Uploading...</span>
                <span>{progress.completed} / {progress.total} completed</span>
              </div>
              <div className="w-full bg-surface-elevated rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all duration-300"
                  style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <button
              onClick={handleUpload}
              className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors"
            >
              Upload All Files
            </button>
          )}
        </div>
      )}
    </div>
  );
}
