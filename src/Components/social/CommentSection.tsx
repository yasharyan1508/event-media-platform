"use client";

import { useState, useTransition } from "react";
import { addComment } from "../../Action/social/comment.actions";

export interface CommentItem {
  id: string;
  content: string;
  createdAt: Date;
  parentId?: string;
  user: {
    name: string | null;
    avatarUrl: string | null;
  };
}

interface CommentSectionProps {
  mediaId: string;
  initialComments: CommentItem[];
}

export function CommentSection({ mediaId, initialComments }: CommentSectionProps) {
  const [comments, setComments] = useState<CommentItem[]>(initialComments);
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;

    const content = body.trim();
    setBody("");

    startTransition(async () => {
      const res = await addComment(mediaId, content);
      if ("success" in res && res.success) {
        setComments((prev) => [...prev, res.comment]);
      } else {
        console.error("Failed to add comment");
      }
    });
  };

  return (
    <div className="flex flex-col h-full w-full max-w-sm bg-black/80 backdrop-blur-md border-l border-white/10 text-white">
      <div className="p-4 border-b border-white/10 font-medium">Comments</div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {comments.map((comment) => (
          <div key={comment.id} className={`flex gap-3 ${comment.parentId ? "ml-4" : ""}`}>
            <div className="w-8 h-8 rounded-full bg-white/20 overflow-hidden flex-shrink-0">
              {comment.user.avatarUrl ? (
                <img src={comment.user.avatarUrl} alt={comment.user.name || "User"} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-white/50">U</div>
              )}
            </div>
            <div>
              <div className="text-sm font-semibold">{comment.user.name || "Anonymous"}</div>
              <div className="text-sm text-white/80 mt-1 break-words">{comment.content}</div>
              <div className="text-xs text-white/40 mt-1">{new Date(comment.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
        ))}
        {comments.length === 0 && (
          <div className="text-sm text-white/40 text-center py-8">No comments yet.</div>
        )}
      </div>
      <div className="p-4 border-t border-white/10">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/50"
            disabled={isPending}
          />
          <button 
            type="submit"
            disabled={isPending || !body.trim()}
            className="text-blue-400 font-medium text-sm px-2 disabled:opacity-50 transition-opacity"
          >
            Post
          </button>
        </form>
      </div>
    </div>
  );
}
