"use client";

import { Dispatch, SetStateAction, useState, useRef } from "react";

type FileUploaderProps = {
  imageUrl: string;
  onFieldChange: (url: string) => void;
  setFiles: Dispatch<SetStateAction<File[]>>;
};

export function FileUploader({ imageUrl, onFieldChange, setFiles }: FileUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    
    if (file.size > 209715200) {
      setError("File too large. Maximum size is 200MB.");
      return;
    }

    if (!file.type.startsWith("image/") && file.type !== "video/mp4") {
      setError("Wrong type. Only images and video/mp4 are allowed.");
      return;
    }

    setIsUploading(true);
    setProgress(0);

    try {
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
        if (res.status === 401 || res.status === 403 || res.status === 307) {
            throw new Error("Auth error. Please sign in.");
        }
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Upload failed to get signature");
      }

      const { presignedUrl, publicUrl } = await res.json();

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", presignedUrl, true);
        xhr.setRequestHeader("Content-Type", file.type);
        
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            setProgress(percentComplete);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error("Upload failed to S3"));
          }
        };

        xhr.onerror = () => reject(new Error("Upload failed due to network error"));

        xhr.send(file);
      });

      onFieldChange(publicUrl);
      setFiles([file]);
      setIsUploading(false);
      setProgress(100);

    } catch (err: unknown) {
      console.error(err);
      if (err instanceof Error) {
        setError(err.message || "Upload failed");
      } else {
        setError("Upload failed");
      }
      setIsUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center relative z-10 bg-white/70 rounded-xl p-8 border-2 border-dashed border-primary/20 hover:bg-surface-container/50 transition-colors">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*,video/mp4"
      />
      
      {!imageUrl && !isUploading && (
        <div 
          className="text-center cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="material-symbols-outlined text-4xl text-primary/50 mb-2">cloud_upload</span>
          <h3 className="text-lg font-semibold text-on-surface">Click to Upload</h3>
          <p className="text-sm text-secondary">Images or MP4 (Max 200MB)</p>
        </div>
      )}

      {isUploading && (
        <div className="w-full flex flex-col items-center">
          <div className="w-full bg-surface-container-highest rounded-full h-2.5 mb-2 overflow-hidden">
            <div className="bg-primary h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
          </div>
          <p className="text-sm text-secondary font-medium">Uploading: {progress}%</p>
        </div>
      )}

      {imageUrl && !isUploading && (
        <div className="w-full flex flex-col items-center relative group">
          {imageUrl.endsWith(".mp4") ? (
            <video src={imageUrl} controls className="max-h-48 rounded-lg" />
          ) : (
            <img src={imageUrl} alt="Uploaded file preview" className="max-h-48 object-cover rounded-lg" />
          )}
          <button 
            type="button"
            className="mt-4 px-4 py-2 bg-primary/10 text-primary font-bold rounded-lg hover:bg-primary/20 transition-colors font-label"
            onClick={() => fileInputRef.current?.click()}
          >
            Change File
          </button>
        </div>
      )}

      {error && (
        <p className="text-error text-sm mt-3 font-bold text-center">{error}</p>
      )}
    </div>
  );
}
