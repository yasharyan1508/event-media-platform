import { getTrendingTags } from "@/src/Library/dal";
import { Role } from "@prisma/client";
import Link from "next/link";
import { BarChart3, Hash } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TrendingTagsDashboard() {
  const trendingTags = await getTrendingTags();

  // Aggregate stats
  const totalUses = trendingTags.reduce((sum, t) => sum + t.count, 0);

  return (
    <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-heading font-bold text-on-surface">Trending Tags</h1>
          <p className="text-on-surface-muted mt-2">Global distribution and frequency of AI-generated tags.</p>
        </div>
        <Link 
          href="/admin" 
          className="px-4 py-2 bg-surface-elevated text-on-surface rounded-lg hover:bg-surface-sunken transition-colors ring-1 ring-white/10"
        >
          Back to Admin
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-surface p-6 rounded-2xl ring-1 ring-white/5 flex items-center gap-4">
          <div className="p-4 bg-primary/10 rounded-xl">
            <Hash className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h3 className="text-on-surface-muted text-sm font-medium">Unique Tags Generated</h3>
            <p className="text-3xl font-bold text-on-surface mt-1">{trendingTags.length}</p>
          </div>
        </div>
        <div className="bg-surface p-6 rounded-2xl ring-1 ring-white/5 flex items-center gap-4">
          <div className="p-4 bg-blue-500/10 rounded-xl">
            <BarChart3 className="w-8 h-8 text-blue-500" />
          </div>
          <div>
            <h3 className="text-on-surface-muted text-sm font-medium">Total Tag Applications</h3>
            <p className="text-3xl font-bold text-on-surface mt-1">{totalUses}</p>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-2xl ring-1 ring-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/5">
          <h2 className="text-xl font-heading font-semibold text-on-surface">Most Common Tags</h2>
        </div>
        
        {trendingTags.length === 0 ? (
          <div className="p-8 text-center text-on-surface-muted">
            No tags have been generated yet.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {trendingTags.map((tag, index) => (
              <div key={tag.label} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-4">
                  <span className="text-on-surface-subtle font-mono text-sm w-6 text-right">
                    #{index + 1}
                  </span>
                  <span className="px-3 py-1 bg-surface-sunken rounded-full text-sm font-medium text-on-surface border border-white/10">
                    {tag.label}
                  </span>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="w-48 bg-surface-sunken rounded-full h-2 overflow-hidden hidden sm:block">
                    <div 
                      className="bg-primary h-full rounded-full" 
                      style={{ width: `${Math.max(5, (tag.count / trendingTags[0].count) * 100)}%` }}
                    />
                  </div>
                  <span className="text-on-surface-muted font-medium w-16 text-right">
                    {tag.count} <span className="text-xs font-normal">uses</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
