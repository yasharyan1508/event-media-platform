import React from "react";
import { prisma } from "@/src/Library/prisma";
import { getCurrentUser, requireRole } from "@/src/Library/dal";
import { Role } from "@prisma/client";
import { ShieldAlert, Server, Activity, Users } from "lucide-react";

export default async function AdminAiPage() {
  await requireRole(Role.ADMIN);

  // Stats
  const totalJobs = await prisma.aiProcessingJob.count();
  const pendingJobs = await prisma.aiProcessingJob.count({ where: { status: "PENDING" } });
  const failedJobs = await prisma.aiProcessingJob.count({ where: { status: "FAILED" } });
  
  const totalFaces = await prisma.faceIndex.count();
  const collectionId = process.env.REKOGNITION_COLLECTION_ID || "Not Configured";

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">AI & Rekognition Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-2">
          <div className="flex items-center text-gray-500 gap-2 mb-2">
            <Activity className="h-5 w-5" />
            <h3 className="font-medium text-sm">Total AI Jobs</h3>
          </div>
          <span className="text-3xl font-bold text-gray-900">{totalJobs}</span>
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-2">
          <div className="flex items-center text-amber-500 gap-2 mb-2">
            <Activity className="h-5 w-5" />
            <h3 className="font-medium text-sm">Pending Jobs</h3>
          </div>
          <span className="text-3xl font-bold text-amber-600">{pendingJobs}</span>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-red-200 shadow-sm flex flex-col gap-2 bg-red-50/50">
          <div className="flex items-center text-red-500 gap-2 mb-2">
            <ShieldAlert className="h-5 w-5" />
            <h3 className="font-medium text-sm">Failed Jobs</h3>
          </div>
          <span className="text-3xl font-bold text-red-600">{failedJobs}</span>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-purple-200 shadow-sm flex flex-col gap-2 bg-purple-50/50">
          <div className="flex items-center text-purple-600 gap-2 mb-2">
            <Users className="h-5 w-5" />
            <h3 className="font-medium text-sm">Enrolled Faces</h3>
          </div>
          <span className="text-3xl font-bold text-purple-700">{totalFaces}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex justify-between items-center">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <Server className="h-5 w-5 text-gray-500" />
              AWS Configuration
            </h2>
          </div>
          <div className="p-6">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Rekognition Collection</p>
                <p className="text-gray-900 font-mono bg-gray-100 px-3 py-2 rounded-lg text-sm">{collectionId}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Region</p>
                <p className="text-gray-900 font-mono bg-gray-100 px-3 py-2 rounded-lg text-sm">{process.env.REKOGNITION_REGION || "Not Configured"}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
            <h2 className="font-bold text-gray-900">Job Recovery</h2>
          </div>
          <div className="p-6 flex flex-col items-center justify-center text-center h-48">
            <ShieldAlert className="h-10 w-10 text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm max-w-sm mb-6">
              If jobs fail due to AWS rate limits or Gemini timeouts, you can reset all FAILED jobs back to PENDING.
            </p>
            {/* Future action: retry-failed-jobs.ts */}
            <button disabled className="px-5 py-2.5 bg-gray-900 text-white font-medium rounded-lg opacity-50 cursor-not-allowed">
              Retry Failed Jobs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
