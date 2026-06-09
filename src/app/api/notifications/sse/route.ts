import { NextRequest } from "next/server";
import { getCurrentUser } from "@/src/Library/dal";
import { notificationEmitter } from "@/src/Library/events/notificationEmitter";
import { getUnreadCountForUser } from "@/src/Library/dal/notification.dal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// In-memory rate limiting map: tracks active connections per userId
const activeConnections = new Map<string, number>();

export async function GET(req: NextRequest) {
  // ── AUTH GUARD ────────────────────────────────────────────────────────────
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = user.id;

  // ── RATE LIMITING ─────────────────────────────────────────────────────────
  const currentConnections = activeConnections.get(userId) || 0;
  if (currentConnections >= 3) {
    return new Response("Too Many Connections", { status: 429 });
  }

  // Increment connection count
  activeConnections.set(userId, currentConnections + 1);

  // ── STREAM CONSTRUCTION ───────────────────────────────────────────────────
  let heartbeatIntervalId: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // ── HELPER: Encode and enqueue an SSE message ──────────────────────
      const sendEvent = (eventName: string, data: unknown) => {
        try {
          const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(new TextEncoder().encode(payload));
        } catch {
          // suppress on closed controller
        }
      };

      // ── HELPER: Send raw heartbeat comment ─────────────────────────────
      const sendHeartbeat = () => {
        try {
          controller.enqueue(new TextEncoder().encode(": ping\n\n"));
        } catch {
          // suppress on closed controller
        }
      };

      // ── INITIAL PAYLOAD ────────────────────────────────────────────────
      const sendInitialState = async () => {
        try {
          const unreadCount = await getUnreadCountForUser(userId);
          sendEvent("initial", { unreadCount });
        } catch (err) {
          console.error("[SSE] Initial state fetch error:", err);
        }
      };
      sendInitialState();

      // ── EVENT EMITTER SUBSCRIPTION ─────────────────────────────────────
      const listener = (notification: unknown) => {
        sendEvent("new_notification", notification);
      };
      
      const eventName = `notification:${userId}`;
      notificationEmitter.on(eventName, listener);

      // ── HEARTBEAT LOOP (8s interval — Vercel safe) ─────────────────────
      heartbeatIntervalId = setInterval(() => {
        sendHeartbeat();
      }, 8000);

      // ── ABRUPT DISCONNECT CLEANUP ──────────────────────────────────────
      req.signal.addEventListener("abort", () => {
        if (heartbeatIntervalId) {
          clearInterval(heartbeatIntervalId);
        }
        
        notificationEmitter.off(eventName, listener);
        
        // Decrement connection count
        const count = activeConnections.get(userId) || 1;
        if (count <= 1) {
          activeConnections.delete(userId);
        } else {
          activeConnections.set(userId, count - 1);
        }

        try {
          controller.close();
        } catch {
          // suppress
        }
      });
    },

    cancel() {
      // Stream cancellation triggered by client disconnect.
      // This is the guaranteed cleanup point for ReadableStream.
      // We already handle it in the abort listener above, but we repeat the cleanup 
      // here to ensure maximum safety.
      if (heartbeatIntervalId) {
        clearInterval(heartbeatIntervalId);
      }
      
      const count = activeConnections.get(userId) || 1;
      if (count <= 1) {
        activeConnections.delete(userId);
      } else {
        activeConnections.set(userId, count - 1);
      }
      
      // We cannot easily remove the specific listener here without a reference,
      // but the `abort` event listener will handle the emitter cleanup accurately.
    },
  });

  // ── RESPONSE WITH MANDATORY SSE HEADERS ──────────────────────────────────
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
