"use client";

import React, { useState } from "react";
import { indexFace } from "@/src/Action/media/index-face";
import { removeFaceIndex } from "@/src/Action/media/delete-face-index";
import { Camera, Trash2, CheckCircle2, AlertCircle } from "lucide-react";

export function FaceIndexManager({ faceIndexes, onUploadToS3 }: { faceIndexes: any[], onUploadToS3: (file: File) => Promise<string> }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);

  const handleEnroll = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!consentGiven) {
      setError("You must provide consent before enrolling a face.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Step 1: Upload to S3 (handled by parent prop)
      const s3Key = await onUploadToS3(file);

      // Step 2: Index Face via Server Action
      const formData = new FormData();
      formData.append("s3Key", s3Key);
      formData.append("consentGiven", "true");

      const res = await indexFace(formData);
      
      if (res.error) {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err.message || "Enrollment failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this face data? All historical matches will be permanently lost.")) return;
    
    setLoading(true);
    const res = await removeFaceIndex(id);
    if (res.error) {
      setError(res.error);
    }
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Camera className="h-6 w-6 text-purple-600" />
        <h2 className="text-xl font-bold text-gray-900">Face Recognition Enrollment</h2>
      </div>

      <p className="text-gray-600 mb-6 text-sm">
        Enroll your face to automatically find all your photos across events. We prioritize your privacy—your biometric data is stored securely and you can permanently delete it at any time.
      </p>

      {error && (
        <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-3 text-sm">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {faceIndexes.length > 0 ? (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">Enrolled Faces</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {faceIndexes.map(index => (
              <div key={index.id} className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 font-bold">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 capitalize">{index.status.toLowerCase()}</p>
                    <p className="text-xs text-gray-500">{(index.confidence * 100).toFixed(1)}% Quality</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(index.id)}
                  disabled={loading}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                  title="Delete face data"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-purple-50 rounded-xl p-6 border border-purple-100">
          <div className="flex items-start gap-3 mb-4">
            <input
              type="checkbox"
              id="consent"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              className="mt-1 w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
            />
            <label htmlFor="consent" className="text-sm text-purple-900 font-medium leading-relaxed">
              I explicitly consent to the collection, processing, and secure storage of my facial biometric data for the sole purpose of finding me in event photos.
            </label>
          </div>

          <label className={`flex justify-center w-full px-4 py-3 border-2 border-dashed rounded-xl cursor-pointer transition ${
            consentGiven ? "border-purple-300 hover:bg-purple-100 hover:border-purple-400" : "border-gray-300 bg-gray-50 cursor-not-allowed opacity-50"
          }`}>
            <span className={`text-sm font-semibold ${consentGiven ? "text-purple-700" : "text-gray-500"}`}>
              {loading ? "Processing..." : "Select Reference Photo"}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleEnroll}
              disabled={!consentGiven || loading}
            />
          </label>
        </div>
      )}
    </div>
  );
}
