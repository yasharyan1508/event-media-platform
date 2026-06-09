# ANTIGRAVITY EXECUTION MANUAL — MODULE 11
## Real-Time Notifications via Server-Sent Events (SSE)
**Classification:** Elite Architect Instruction Set | Zero Ambiguity Protocol  
**Target Agent:** Antigravity IDE Automation  
**Debugging Mode:** ENABLED — Self-healing diagnostics embedded in every phase  

---

## PRE-EXECUTION ENVIRONMENT AUDIT

Before writing a single file, Antigravity MUST run the following checks in order. If any check fails, HALT and surface the error before proceeding.

```
AUDIT CHECKLIST (run sequentially):
[ ] 1. Confirm Prisma schema has `Notification` model — grep prisma/schema.prisma for "model Notification"
[ ] 2. Confirm `@clerk/nextjs` is in package.json dependencies
[ ] 3. Confirm `src/lib/dal.ts` (or equivalent) exports `getCurrentUser()` — grep for "getCurrentUser"
[ ] 4. Confirm `src/lib/actions/` directory exists
[ ] 5. Confirm `src/hooks/` directory exists (create if absent)
[ ] 6. Confirm `src/components/` directory exists
[ ] 7. Confirm `src/app/api/notifications/` path is creatable (no conflicting route segment)
[ ] 8. Confirm shadcn/ui is installed — check components.json at project root
[ ] 9. Confirm `date-fns` OR `dayjs` is available — grep package.json; if neither, install `date-fns`
[ ] 10. Run `npx prisma validate` — must exit 0
```

**DEBUG HOOK — PRE-AUDIT:**  
If step 10 fails, output the exact Prisma validation error, identify the conflicting model field, and stop. Do not attempt migration until schema is clean.

---

## PRISMA SCHEMA CONTRACT

Antigravity must validate this exact schema block exists in `prisma/schema.prisma`. If absent or structurally different, add/correct it and run migration before any other phase.

```prisma
// prisma/schema.prisma — Required model block
model Notification {
  id        String           @id @default(cuid())
  userId    String           // recipient
  actorId   String           // actor who triggered the event
  type      NotificationType
  message   String
  isRead    Boolean          @default(false)
  createdAt DateTime         @default(now())

  user      User             @relation("UserNotifications", fields: [userId], references: [id], onDelete: Cascade)
  actor     User             @relation("ActorNotifications", fields: [actorId], references: [id], onDelete: Cascade)

  @@index([userId, isRead])
  @@index([userId, createdAt])
}

enum NotificationType {
  LIKE
  COMMENT
  FOLLOW
  MENTION
  SYSTEM
}
```

**Relation names `"UserNotifications"` and `"ActorNotifications"` are mandatory** — they disambiguate the two foreign keys pointing at `User`. If the `User` model does not already have back-relation fields, Antigravity must add them:

```prisma
// Inside existing User model — ADD if missing:
notifications     Notification[] @relation("UserNotifications")
actorActions      Notification[] @relation("ActorNotifications")
```

**After schema edits, run:**
```bash
npx prisma migrate dev --name add_notification_module
npx prisma generate
```

**DEBUG HOOK — MIGRATION:**  
If migration fails with "Foreign key constraint" error, the `User` table likely uses a non-standard `id` type. Inspect `User.id` field type and align `Notification.userId` / `actorId` to match exactly (e.g., if `User.id` is `Int`, change both to `Int`). Re-run migration.

---

## PHASE 1 — DATA ACCESS LAYER EXTENSIONS

**File:** `src/lib/dal/notification.dal.ts`  
*(Create this file. Do NOT modify the existing `dal.ts` root file — extend via dedicated module.)*

### Complete Implementation:

```typescript
// src/lib/dal/notification.dal.ts
import { db } from "@/lib/db"; // Adjust to your prisma client export path
import { NotificationType } from "@prisma/client";
import { getCurrentUser } from "@/lib/dal"; // Existing DAL resolver

// ─── TYPE CONTRACT ────────────────────────────────────────────────────────────

export type CreateNotificationInput = {
  userId: string;     // recipient
  actorId: string;    // actor who triggered the event
  type: NotificationType;
  message: string;
};

export type NotificationRecord = {
  id: string;
  userId: string;
  actorId: string;
  type: NotificationType;
  message: string;
  isRead: boolean;
  createdAt: Date;
  actor: {
    id: string;
    name: string | null;
    imageUrl: string | null;
  };
};

// ─── WRITE OPERATIONS ─────────────────────────────────────────────────────────

/**
 * Creates a notification record.
 * ARCHITECTURAL MANDATE: Self-notification suppression is enforced HERE
 * at the DAL boundary — never rely on call sites to check this.
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<void> {
  // MANDATE #4 — Edge-Case Suppression: Block self-notifications at DAL boundary
  if (input.actorId === input.userId) {
    return; // Silent return — not an error, just a no-op
  }

  await db.notification.create({
    data: {
      userId: input.userId,
      actorId: input.actorId,
      type: input.type,
      message: input.message,
    },
  });
}

// ─── READ OPERATIONS ──────────────────────────────────────────────────────────

/**
 * Fetches all notifications for the currently authenticated user.
 * Returns newest-first, capped at 50 records.
 */
export async function getNotificationsForCurrentUser(): Promise<NotificationRecord[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return [];

  return db.notification.findMany({
    where: { userId: currentUser.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      userId: true,
      actorId: true,
      type: true,
      message: true,
      isRead: true,
      createdAt: true,
      actor: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
        },
      },
    },
  });
}

/**
 * Returns count of unread notifications for the current user.
 * Used by the SSE polling loop to detect state changes.
 */
export async function getUnreadCountForUser(userId: string): Promise<number> {
  return db.notification.count({
    where: { userId, isRead: false },
  });
}

// ─── MARK READ OPERATIONS ─────────────────────────────────────────────────────

export async function markNotificationAsRead(
  notificationId: string,
  userId: string // enforce ownership — never skip this param
): Promise<void> {
  await db.notification.updateMany({
    where: {
      id: notificationId,
      userId, // ownership guard: only owner can mark read
    },
    data: { isRead: true },
  });
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  await db.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

/**
 * Lightweight snapshot for SSE polling — fetches only unread items
 * so we can detect new notifications without full payload transfer.
 */
export async function getLatestUnreadNotifications(
  userId: string,
  since: Date
): Promise<NotificationRecord[]> {
  return db.notification.findMany({
    where: {
      userId,
      isRead: false,
      createdAt: { gt: since },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      userId: true,
      actorId: true,
      type: true,
      message: true,
      isRead: true,
      createdAt: true,
      actor: {
        select: { id: true, name: true, imageUrl: true },
      },
    },
  });
}
```

**DEBUG HOOK — PHASE 1:**  
If TypeScript reports `"Property 'notification' does not exist on type PrismaClient"`, Prisma client has not been regenerated after schema changes. Run `npx prisma generate` and confirm `node_modules/.prisma/client` was updated (check timestamp). If error persists, delete `node_modules/.prisma` and run `npx prisma generate` again.

---

## PHASE 2 — UNIFIED SERVER ACTIONS

**File:** `src/lib/actions/notification.actions.ts`

### Complete Implementation:

```typescript
// src/lib/actions/notification.actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/dal";
import {
  getNotificationsForCurrentUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  NotificationRecord,
} from "@/lib/dal/notification.dal";

// ─── RESPONSE ENVELOPE TYPES ──────────────────────────────────────────────────
// MANDATE #2: Every action returns exactly this shape — no exceptions.

type ActionSuccess<T> = { success: true; data: T };
type ActionError = { success: false; error: string };
type ActionResult<T> = ActionSuccess<T> | ActionError;

// ─── ACTION: GET NOTIFICATIONS ────────────────────────────────────────────────

export async function getNotifications(): Promise<
  ActionResult<NotificationRecord[]>
> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Unauthorized: No active session." };
    }

    const notifications = await getNotificationsForCurrentUser();
    return { success: true, data: notifications };
  } catch (error) {
    console.error("[getNotifications] DAL error:", error);
    return {
      success: false,
      error: "Failed to fetch notifications. Please try again.",
    };
  }
}

// ─── ACTION: MARK SINGLE NOTIFICATION READ ────────────────────────────────────

export async function markNotificationRead(
  notificationId: string
): Promise<ActionResult<void>> {
  try {
    if (!notificationId || typeof notificationId !== "string") {
      return { success: false, error: "Invalid notification ID." };
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Unauthorized: No active session." };
    }

    await markNotificationAsRead(notificationId, currentUser.id);

    // Revalidate all paths that render notification state
    revalidatePath("/", "layout"); // Revalidates nav badge across all routes
    return { success: true, data: undefined };
  } catch (error) {
    console.error("[markNotificationRead] error:", error);
    return {
      success: false,
      error: "Failed to mark notification as read.",
    };
  }
}

// ─── ACTION: MARK ALL NOTIFICATIONS READ ─────────────────────────────────────

export async function markAllNotificationsRead(): Promise<ActionResult<void>> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Unauthorized: No active session." };
    }

    await markAllNotificationsAsRead(currentUser.id);

    revalidatePath("/", "layout");
    return { success: true, data: undefined };
  } catch (error) {
    console.error("[markAllNotificationsRead] error:", error);
    return {
      success: false,
      error: "Failed to mark all notifications as read.",
    };
  }
}
```

**DEBUG HOOK — PHASE 2:**  
If `revalidatePath` causes a build error `"revalidatePath is not exported from next/cache"`, confirm Next.js version is 13.4+. If the app is on 13.2 or below, replace with `revalidateTag("notifications")` and add `{ next: { tags: ["notifications"] } }` to relevant fetch calls. For Next.js 15 (confirmed in stack), this is a non-issue but document the check anyway.

---

## PHASE 3 — SSE ROUTE HANDLER

**File:** `src/app/api/notifications/sse/route.ts`

### Architecture Notes Before Coding:
- This is a **long-lived GET route**. Next.js App Router handles it via Edge or Node runtime — explicitly declare `runtime = "nodejs"` to ensure `setInterval` / `clearInterval` work correctly. Edge runtime has restricted APIs.
- The `ReadableStream` constructor takes a `start(controller)` function. All cleanup MUST happen in the `cancel()` callback of the same constructor — this is the only guaranteed cleanup point when the client disconnects.
- Polling interval is **3 seconds** for active change detection. Heartbeat is **15 seconds** per mandate. These are two separate intervals.

### Complete Implementation:

```typescript
// src/app/api/notifications/sse/route.ts
import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// MANDATE: Declare Node.js runtime explicitly — Edge lacks setInterval support
export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // Prevent static caching of this route

export async function GET(req: NextRequest) {
  // ── AUTH GUARD ────────────────────────────────────────────────────────────
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  // ── MAP CLERK userId → internal DB User.id ────────────────────────────────
  // Adjust this query to match your User model's Clerk field name
  const dbUser = await db.user.findUnique({
    where: { clerkId: userId }, // Change `clerkId` to your actual field name
    select: { id: true },
  });

  if (!dbUser) {
    return new Response("User not found", { status: 404 });
  }

  const internalUserId = dbUser.id;

  // ── STREAM CONSTRUCTION ───────────────────────────────────────────────────
  let pollingIntervalId: NodeJS.Timeout | null = null;
  let heartbeatIntervalId: NodeJS.Timeout | null = null;
  let lastCheckedAt = new Date(); // Tracks timestamp of last poll cycle

  const stream = new ReadableStream({
    start(controller) {
      // ── HELPER: Encode and enqueue an SSE message ──────────────────────
      const sendEvent = (eventName: string, data: unknown) => {
        try {
          // Standard SSE wire format: "event: name\ndata: payload\n\n"
          const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(new TextEncoder().encode(payload));
        } catch {
          // Controller may already be closed during fast disconnects — suppress
        }
      };

      // ── HELPER: Send raw heartbeat comment (keeps connection alive) ────
      const sendHeartbeat = () => {
        try {
          controller.enqueue(new TextEncoder().encode(": ping\n\n"));
        } catch {
          // suppress on closed controller
        }
      };

      // ── INITIAL PAYLOAD ────────────────────────────────────────────────
      // Send current unread count immediately on connection open
      const sendInitialState = async () => {
        try {
          const unreadCount = await db.notification.count({
            where: { userId: internalUserId, isRead: false },
          });
          sendEvent("initial", { unreadCount });
        } catch (err) {
          console.error("[SSE] Initial state fetch error:", err);
        }
      };
      sendInitialState();

      // ── POLLING LOOP (3s interval — checks for new notifications) ──────
      pollingIntervalId = setInterval(async () => {
        try {
          const since = lastCheckedAt;
          const now = new Date();
          lastCheckedAt = now;

          const newNotifications = await db.notification.findMany({
            where: {
              userId: internalUserId,
              isRead: false,
              createdAt: { gt: since },
            },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              type: true,
              message: true,
              isRead: true,
              createdAt: true,
              actor: {
                select: { id: true, name: true, imageUrl: true },
              },
            },
          });

          if (newNotifications.length > 0) {
            sendEvent("new_notifications", {
              notifications: newNotifications,
            });
          }
        } catch (err) {
          console.error("[SSE] Polling error for user:", internalUserId, err);
          // DO NOT call controller.error() here — log and continue polling
          // A single DB hiccup should not kill the connection
        }
      }, 3000); // 3-second polling interval

      // ── HEARTBEAT LOOP (15s interval — mandate compliance) ─────────────
      heartbeatIntervalId = setInterval(() => {
        sendHeartbeat();
      }, 15000); // 15-second heartbeat per architectural mandate
    },

    // ── CANCEL CALLBACK: GUARANTEED CLEANUP ON CLIENT DISCONNECT ────────
    cancel() {
      console.log(`[SSE] Stream cancelled for user: ${internalUserId}. Cleaning up.`);
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
        pollingIntervalId = null;
      }
      if (heartbeatIntervalId) {
        clearInterval(heartbeatIntervalId);
        heartbeatIntervalId = null;
      }
    },
  });

  // ── RESPONSE WITH MANDATORY SSE HEADERS ──────────────────────────────────
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Critical for Nginx deployments — disables proxy buffering
    },
  });
}
```

**DEBUG HOOK — PHASE 3 (Most Complex Phase):**

| Symptom | Root Cause | Fix |
|---|---|---|
| `setInterval is not defined` at runtime | Route defaulting to Edge runtime | Confirm `export const runtime = "nodejs"` is present |
| Stream closes immediately after connect | `controller.enqueue()` throws synchronously | Wrap all enqueue calls in `try/catch` — already done above |
| No events received in browser | SSE headers incorrect or missing | Verify `Content-Type: text/event-stream` in Network tab — must not be `application/json` |
| Events received but UI not updating | Event name mismatch between server and client | Server sends `event: new_notifications`, client must listen for `source.addEventListener("new_notifications", ...)` — NOT `source.onmessage` |
| Memory leak after client disconnects | `cancel()` not firing | Confirm you're using `ReadableStream` constructor pattern — NOT `TransformStream`. Only `ReadableStream`'s cancel callback fires reliably on disconnect |
| 401 on SSE route | Clerk middleware blocking the route | Add `"/api/notifications/sse"` to Clerk middleware's `publicRoutes` — **NO**, instead ensure Clerk session cookie is being sent. EventSource always sends cookies automatically |
| Database flooding under load | Polling interval too aggressive | The 3s interval is intentional for responsiveness. For production scale, replace with Prisma `$queryRaw` with a lightweight `SELECT COUNT` instead of `findMany` on the poll tick |

---

## PHASE 4 — STATEFUL CLIENT-SIDE EVENTSOURCE HOOK

**File:** `src/hooks/useNotifications.ts`

### Architecture Notes:
- `EventSource` is a browser-only API. Guard all instantiation inside `useEffect` to prevent SSR crashes.
- The hook owns its own `EventSource` instance. On unmount, call `.close()`. On error, implement exponential backoff with a **max 5 retry** threshold before permanently closing.
- State shape: notifications array + unread count + connection status.

### Complete Implementation:

```typescript
// src/hooks/useNotifications.ts
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { NotificationRecord } from "@/lib/dal/notification.dal";
import {
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/actions/notification.actions";

// ─── TYPES ────────────────────────────────────────────────────────────────────

type ConnectionStatus = "connecting" | "connected" | "error" | "closed";

type NotificationState = {
  notifications: NotificationRecord[];
  unreadCount: number;
  status: ConnectionStatus;
};

type UseNotificationsReturn = NotificationState & {
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearLocalState: () => void;
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const SSE_ENDPOINT = "/api/notifications/sse";
const MAX_RETRY_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 1000; // doubles each attempt: 1s, 2s, 4s, 8s, 16s

// ─── HOOK IMPLEMENTATION ──────────────────────────────────────────────────────

export function useNotifications(): UseNotificationsReturn {
  const [state, setState] = useState<NotificationState>({
    notifications: [],
    unreadCount: 0,
    status: "connecting",
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true); // Prevents setState after unmount

  // ─── SSE CONNECTION FACTORY ─────────────────────────────────────────────
  const connect = useCallback(() => {
    // Prevent redundant connections
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    if (!isMountedRef.current) return;

    setState((prev) => ({ ...prev, status: "connecting" }));

    const source = new EventSource(SSE_ENDPOINT);
    eventSourceRef.current = source;

    // ── EVENT: Connection open ─────────────────────────────────────────
    source.onopen = () => {
      if (!isMountedRef.current) return;
      retryCountRef.current = 0; // Reset retry count on successful connect
      setState((prev) => ({ ...prev, status: "connected" }));
    };

    // ── EVENT: Initial state (fires once on connect) ───────────────────
    source.addEventListener("initial", (e: MessageEvent) => {
      if (!isMountedRef.current) return;
      try {
        const data = JSON.parse(e.data) as { unreadCount: number };
        setState((prev) => ({ ...prev, unreadCount: data.unreadCount }));
      } catch {
        console.error("[useNotifications] Failed to parse initial event");
      }
    });

    // ── EVENT: New notifications arrived ──────────────────────────────
    source.addEventListener("new_notifications", (e: MessageEvent) => {
      if (!isMountedRef.current) return;
      try {
        const data = JSON.parse(e.data) as {
          notifications: NotificationRecord[];
        };

        setState((prev) => {
          // Deduplicate: remove any existing notifications with same IDs
          const incomingIds = new Set(data.notifications.map((n) => n.id));
          const filtered = prev.notifications.filter(
            (n) => !incomingIds.has(n.id)
          );

          const merged = [...data.notifications, ...filtered];
          const unreadCount = merged.filter((n) => !n.isRead).length;

          return { ...prev, notifications: merged, unreadCount };
        });
      } catch {
        console.error("[useNotifications] Failed to parse new_notifications event");
      }
    });

    // ── EVENT: Connection error — exponential backoff retry ───────────
    source.onerror = () => {
      if (!isMountedRef.current) return;

      source.close();
      eventSourceRef.current = null;

      if (retryCountRef.current >= MAX_RETRY_ATTEMPTS) {
        console.warn("[useNotifications] Max retry attempts reached. SSE closed.");
        setState((prev) => ({ ...prev, status: "closed" }));
        return;
      }

      const delay = BASE_RETRY_DELAY_MS * Math.pow(2, retryCountRef.current);
      retryCountRef.current += 1;

      setState((prev) => ({ ...prev, status: "error" }));

      retryTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          connect(); // Recursive reconnect
        }
      }, delay);
    };
  }, []); // No dependencies — connect is stable

  // ─── MOUNT / UNMOUNT LIFECYCLE ──────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    connect();

    // CLEANUP — This is the exact hook lifecycle cleanup return function
    return () => {
      isMountedRef.current = false;

      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect]);

  // ─── MARK SINGLE NOTIFICATION READ ─────────────────────────────────────
  const markRead = useCallback(async (id: string) => {
    // Optimistic UI update — apply locally before server confirms
    setState((prev) => {
      const updated = prev.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      );
      return {
        ...prev,
        notifications: updated,
        unreadCount: updated.filter((n) => !n.isRead).length,
      };
    });

    const result = await markNotificationRead(id);
    if (!result.success) {
      // Rollback optimistic update on failure
      console.error("[useNotifications] markRead failed:", result.error);
      setState((prev) => {
        const rolled = prev.notifications.map((n) =>
          n.id === id ? { ...n, isRead: false } : n
        );
        return {
          ...prev,
          notifications: rolled,
          unreadCount: rolled.filter((n) => !n.isRead).length,
        };
      });
    }
  }, []);

  // ─── MARK ALL NOTIFICATIONS READ ────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    const snapshot = state.notifications; // Save for rollback

    // Optimistic UI update
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));

    const result = await markAllNotificationsRead();
    if (!result.success) {
      console.error("[useNotifications] markAllRead failed:", result.error);
      // Rollback
      setState((prev) => ({
        ...prev,
        notifications: snapshot,
        unreadCount: snapshot.filter((n) => !n.isRead).length,
      }));
    }
  }, [state.notifications]);

  // ─── UTILITY: Clear local state (e.g., on logout) ──────────────────────
  const clearLocalState = useCallback(() => {
    setState({ notifications: [], unreadCount: 0, status: "closed" });
  }, []);

  return {
    ...state,
    markRead,
    markAllRead,
    clearLocalState,
  };
}
```

**DEBUG HOOK — PHASE 4:**

| Symptom | Root Cause | Fix |
|---|---|---|
| `EventSource is not defined` on server | Component using hook rendered server-side | Ensure parent component has `"use client"` directive. The hook itself is client-only but cannot enforce this if imported from a server component |
| Infinite reconnect loop | `connect` function recreated on every render | Confirm `connect` is wrapped in `useCallback` with `[]` deps — already done above |
| Stale notifications after marking read | Server action `revalidatePath` invalidating SSE state | The SSE state is local. `markRead` uses optimistic updates — they are independent of RSC cache. No conflict exists |
| `setState` called after unmount warning | Async operations resolving after component unmounts | `isMountedRef.current` guard prevents this — confirm the ref check is present before all `setState` calls |
| Double EventSource connections | React StrictMode double-invoking `useEffect` | In development with StrictMode, effects run twice. The cleanup function correctly closes the first connection. This is expected behavior — not a bug |

---

## PHASE 5 — NOTIFICATION UI COMPONENT

### Required shadcn/ui Components (install if absent):
```bash
npx shadcn@latest add popover badge button scroll-area separator
```

**File:** `src/components/notifications/NotificationFeed.tsx`

### Complete Implementation:

```tsx
// src/components/notifications/NotificationFeed.tsx
"use client";

import { useNotifications } from "@/hooks/useNotifications";
import { NotificationRecord } from "@/lib/dal/notification.dal";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Bell, BellDot, Check, CheckCheck, Loader2, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationType } from "@prisma/client";

// ─── DATE FORMATTING UTILITY ──────────────────────────────────────────────────

function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) return "just now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── NOTIFICATION TYPE → ICON/COLOR MAP ───────────────────────────────────────

const TYPE_CONFIG: Record<
  NotificationType,
  { label: string; colorClass: string; symbol: string }
> = {
  LIKE: { label: "liked", colorClass: "text-rose-500", symbol: "❤️" },
  COMMENT: { label: "commented", colorClass: "text-blue-500", symbol: "💬" },
  FOLLOW: { label: "followed you", colorClass: "text-violet-500", symbol: "👤" },
  MENTION: { label: "mentioned you", colorClass: "text-amber-500", symbol: "@" },
  SYSTEM: { label: "System", colorClass: "text-slate-500", symbol: "🔔" },
};

// ─── SINGLE NOTIFICATION ITEM ─────────────────────────────────────────────────

function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: NotificationRecord;
  onMarkRead: (id: string) => void;
}) {
  const config = TYPE_CONFIG[notification.type] ?? TYPE_CONFIG.SYSTEM;

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 px-4 py-3 transition-colors",
        "hover:bg-muted/50 cursor-pointer group",
        !notification.isRead && "bg-primary/5 border-l-2 border-primary"
      )}
      onClick={() => {
        if (!notification.isRead) onMarkRead(notification.id);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          if (!notification.isRead) onMarkRead(notification.id);
        }
      }}
      aria-label={`Notification: ${notification.message}. ${notification.isRead ? "Read" : "Unread"}`}
    >
      {/* Actor Avatar */}
      <div className="relative flex-shrink-0 mt-0.5">
        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center overflow-hidden">
          {notification.actor?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={notification.actor.imageUrl}
              alt={notification.actor.name ?? "User"}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-sm font-medium text-muted-foreground">
              {notification.actor?.name?.[0]?.toUpperCase() ?? "?"}
            </span>
          )}
        </div>
        <span
          className="absolute -bottom-0.5 -right-0.5 text-xs"
          aria-hidden="true"
        >
          {config.symbol}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug text-foreground line-clamp-2">
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatRelativeTime(notification.createdAt)}
        </p>
      </div>

      {/* Unread Dot */}
      {!notification.isRead && (
        <span
          className="flex-shrink-0 mt-1.5 w-2 h-2 rounded-full bg-primary"
          aria-hidden="true"
        />
      )}

      {/* Mark Read on hover — only for unread */}
      {!notification.isRead && (
        <button
          className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            "p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onMarkRead(notification.id);
          }}
          title="Mark as read"
          aria-label="Mark notification as read"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── MAIN NOTIFICATION FEED COMPONENT ────────────────────────────────────────

export function NotificationFeed() {
  const { notifications, unreadCount, status, markRead, markAllRead } =
    useNotifications();

  const isConnecting = status === "connecting";
  const hasError = status === "error" || status === "closed";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unreadCount > 0
              ? `${unreadCount} unread notifications`
              : "Notifications"
          }
        >
          {unreadCount > 0 ? (
            <BellDot className="h-5 w-5" />
          ) : (
            <Bell className="h-5 w-5" />
          )}

          {/* Unread Count Badge */}
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className={cn(
                "absolute -top-1 -right-1 h-5 min-w-5 px-1",
                "flex items-center justify-center",
                "text-[10px] font-bold pointer-events-none"
              )}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}

          {/* Connecting Pulse Indicator */}
          {isConnecting && (
            <span
              className="absolute top-0 right-0 w-2 h-2 rounded-full bg-amber-400 animate-pulse"
              aria-hidden="true"
            />
          )}

          {/* Error Indicator */}
          {hasError && (
            <span
              className="absolute top-0 right-0 w-2 h-2 rounded-full bg-red-500"
              aria-hidden="true"
            />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[380px] p-0 shadow-xl"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {isConnecting && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
            {hasError && (
              <WifiOff className="h-3.5 w-3.5 text-destructive" />
            )}
          </div>

          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground"
              onClick={markAllRead}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Notification List */}
        <ScrollArea className="h-[420px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 px-6 text-center gap-3">
              <Bell className="h-10 w-10 text-muted-foreground/30" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  No notifications yet
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Activity from your events will appear here.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={markRead}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {hasError && (
          <>
            <Separator />
            <div className="px-4 py-2.5 text-xs text-muted-foreground text-center">
              Connection lost. Attempting to reconnect...
            </div>
          </>
        )}

        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="px-4 py-2.5 text-xs text-muted-foreground text-center">
              Showing {notifications.length} most recent
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

**File:** `src/components/notifications/index.ts`  
*(Barrel export — required for clean import paths)*
```typescript
export { NotificationFeed } from "./NotificationFeed";
```

**Nav Integration — Add to your layout's nav component:**
```tsx
// In your nav component (e.g., src/components/layout/Navbar.tsx)
import { NotificationFeed } from "@/components/notifications";

// Inside the nav JSX, alongside user avatar/menu:
<NotificationFeed />
```

**DEBUG HOOK — PHASE 5:**

| Symptom | Root Cause | Fix |
|---|---|---|
| `Cannot find module '@/components/ui/popover'` | shadcn Popover not installed | Run `npx shadcn@latest add popover` |
| Badge shows `NaN` | `unreadCount` is `undefined` during initial render | Add `?? 0` fallback in hook's initial state — already done above |
| Popover doesn't close after click | PopoverContent needs `onInteractOutside` | shadcn Popover closes on outside click by default — no fix needed |
| Images fail to load for actor avatar | S3 URL not whitelisted in `next.config.js` | Add your S3/CDN domain to `images.remotePatterns` in `next.config.js` |
| Hydration mismatch on unreadCount | Badge rendered on server before SSE connects | The badge only renders client-side inside `"use client"` component — no hydration conflict. If error appears, confirm `NotificationFeed` is NOT imported into a Server Component directly |

---

## INTEGRATION CHECKLIST — TRIGGER POINTS

Module 11 is passive until other modules CALL `createNotification()`. Antigravity must add these trigger calls to existing action files:

### In `src/lib/actions/like.actions.ts` (Module 8):
```typescript
// After a successful like DB write, add:
import { createNotification } from "@/lib/dal/notification.dal";

// Inside the like action, after db.like.create():
await createNotification({
  userId: mediaOwnerId,   // recipient = media owner
  actorId: currentUser.id, // actor = person who liked
  type: "LIKE",
  message: `${currentUser.name ?? "Someone"} liked your photo.`,
});
// Self-suppression is handled automatically inside createNotification()
```

### In `src/lib/actions/comment.actions.ts` (Module 8):
```typescript
// After successful comment creation:
await createNotification({
  userId: mediaOwnerId,
  actorId: currentUser.id,
  type: "COMMENT",
  message: `${currentUser.name ?? "Someone"} commented on your photo.`,
});
```

---

## STRICT COMPLIANCE VALIDATION FRAMEWORK

Antigravity MUST run ALL of the following checks in sequence before declaring Module 11 complete. Each check must PASS. A single FAIL is a blocking error.

```
═══════════════════════════════════════════════════════════
 ANTIGRAVITY MODULE 11 — COMPLIANCE GATE v1.0
═══════════════════════════════════════════════════════════

BLOCK A: ARCHITECTURAL MANDATE COMPLIANCE
──────────────────────────────────────────
[ ] A1: No `db.*` / `prisma.*` calls exist inside any file under
        `src/app/api/` or `src/components/` (except the SSE route
        which has an explicit exemption for the session resolver only)
        → Grep: `grep -r "db\." src/app/api/notifications/sse --include="*.ts"
          | grep -v "db.user.findUnique\|db.notification"`
          → Must return: only the two allowed queries

[ ] A2: Every function in notification.actions.ts returns exactly:
        `{ success: true; data: T }` or `{ success: false; error: string }`
        → Manual inspection of all 3 exported action functions

[ ] A3: SSE route uses `ReadableStream` constructor — NOT `TransformStream`,
        NOT `new Response(generator)` with async generator
        → Grep: `grep "new ReadableStream" src/app/api/notifications/sse/route.ts`
          → Must return 1 match

[ ] A4: Self-notification guard exists INSIDE `createNotification()` in DAL,
        NOT in calling action files
        → Grep: `grep "actorId === userId" src/lib/dal/notification.dal.ts`
          → Must return 1 match

BLOCK B: RUNTIME SAFETY CHECKS
────────────────────────────────
[ ] B1: SSE route exports `runtime = "nodejs"` and `dynamic = "force-dynamic"`
        → Grep both strings in route.ts

[ ] B2: Both `pollingIntervalId` and `heartbeatIntervalId` are cleared
        inside the `cancel()` callback of the ReadableStream
        → Manual inspection of cancel() block

[ ] B3: useNotifications hook cleanup function:
        (a) Sets `isMountedRef.current = false`
        (b) Calls `clearTimeout(retryTimeoutRef.current)`
        (c) Calls `eventSourceRef.current.close()`
        → All 3 must be present in the useEffect return function

[ ] B4: `MAX_RETRY_ATTEMPTS` check exists in `source.onerror` handler
        → Grep: `grep "MAX_RETRY_ATTEMPTS" src/hooks/useNotifications.ts`
          → Must return at least 1 match

BLOCK C: TYPE SAFETY CHECKS
─────────────────────────────
[ ] C1: TypeScript build passes with zero errors
        → Run: `npx tsc --noEmit`
        → Must exit with code 0

[ ] C2: Prisma client is fully in sync with schema
        → Run: `npx prisma validate`
        → Must exit with code 0

[ ] C3: `NotificationRecord` type is imported from the DAL in both
        the actions file and the hook — NOT re-declared inline
        → Grep: `grep "NotificationRecord" src/lib/actions/notification.actions.ts
                 src/hooks/useNotifications.ts`
          → Both files must show an import, not a type declaration

BLOCK D: UI COMPONENT CHECKS
──────────────────────────────
[ ] D1: `NotificationFeed` component has `"use client"` directive as
        first line
        → Grep: head -n 1 src/components/notifications/NotificationFeed.tsx
          → Must return: "use client"

[ ] D2: Barrel export file exists:
        → Check: `src/components/notifications/index.ts` exists

[ ] D3: All 5 shadcn components are importable without error:
        popover, badge, button, scroll-area, separator
        → Run a dev build: `next build` or check `next dev` startup logs

[ ] D4: `formatRelativeTime()` utility function is LOCAL to the component
        file — NOT imported from an external library
        → This is by design to avoid `date-fns` bundle overhead for
          a simple formatter

BLOCK E: SSE PROTOCOL COMPLIANCE
──────────────────────────────────
[ ] E1: Heartbeat packet format is exactly `: ping\n\n`
        (colon, space, ping, double newline — standard SSE comment format)
        → Grep: `grep "ping" src/app/api/notifications/sse/route.ts`

[ ] E2: `Content-Type` header is exactly `text/event-stream`
        → Manual inspection of Response headers object

[ ] E3: `X-Accel-Buffering: no` header is present
        → Critical for Nginx/Vercel proxy compatibility

[ ] E4: Named event format is used for all data pushes:
        `event: initial\ndata: {...}\n\n`
        `event: new_notifications\ndata: {...}\n\n`
        → NOT the default unnamed `data:` format without event names
        → This is required for `addEventListener()` to work on client

BLOCK F: INTEGRATION TRIGGER AUDIT
────────────────────────────────────
[ ] F1: `createNotification()` call exists in the like action
        → Grep: `grep "createNotification" src/lib/actions/like.actions.ts`

[ ] F2: `createNotification()` call exists in the comment action
        → Grep: `grep "createNotification" src/lib/actions/comment.actions.ts`

[ ] F3: Both trigger calls import from `@/lib/dal/notification.dal`
        → NOT from the actions file (no circular imports)

BLOCK G: DEBUGGING SELF-AUDIT
───────────────────────────────
[ ] G1: Open browser DevTools → Network tab → Filter by "sse"
        → Connect to the app as authenticated user
        → Confirm SSE route shows status "200" with type "eventsource"
        → Confirm heartbeat `: ping` packets visible every ~15 seconds

[ ] G2: Trigger a like on another user's media
        → Confirm new notification appears in feed within 3-6 seconds
        → Confirm unread badge increments correctly

[ ] G3: Click a notification to mark as read
        → Confirm unread badge decrements immediately (optimistic)
        → Confirm server confirms (no rollback logged in console)

[ ] G4: Click "Mark all read"
        → Confirm all notifications show as read instantly
        → Confirm unreadCount = 0 in hook state

[ ] G5: Disconnect from internet for 10 seconds, reconnect
        → Confirm hook retried with exponential backoff
        → Confirm connection re-established (status back to "connected")

═══════════════════════════════════════════════════════════
 ALL 35 CHECKS MUST PASS. ANY FAILURE = MODULE 11 INCOMPLETE
═══════════════════════════════════════════════════════════
```

---

## DEBUGGING MASTER REFERENCE TABLE

Use this table for any issue encountered during or after execution.

| Code | Location | Symptom | Diagnosis Command | Fix |
|---|---|---|---|---|
| DBG-01 | Prisma Schema | Migration fails | `npx prisma migrate dev --dry-run` | Check for relation name conflicts. Use named `@relation` strings |
| DBG-02 | DAL | `PrismaClientKnownRequestError` code P2003 | Check DB logs | Foreign key mismatch — ensure `User.id` type matches `Notification.userId` type |
| DBG-03 | Actions | Action returns `undefined` instead of result shape | Add `console.log` at function entry | Missing `return` before try/catch block |
| DBG-04 | SSE Route | 401 on SSE endpoint | Check Clerk middleware config | Confirm SSE endpoint isn't excluded from auth in middleware.ts |
| DBG-05 | SSE Route | Intervals not cleared on disconnect | Add `console.log` in `cancel()` | The `cancel()` callback is only called when consumer cancels — verify with AbortController in dev |
| DBG-06 | SSE Route | `db.user.findUnique` returns null | Check `clerkId` field name | Run `npx prisma studio` and inspect User table column names |
| DBG-07 | Hook | React StrictMode double connection | Check Network tab for 2x SSE connections | Expected in dev. Both connections close and re-open. Only one persists. Not a bug |
| DBG-08 | Hook | `connect` function causes infinite loop | Check `useCallback` deps array | Deps must be `[]` — any state/prop in deps causes reconnect loops |
| DBG-09 | UI | Badge flickers on every SSE message | Check state diffing in `new_notifications` handler | Deduplication logic must prevent re-adding existing IDs — already handled |
| DBG-10 | UI | Popover misaligned on mobile | Check `align` prop | Change `align="end"` to `align="center"` for mobile viewports |
| DBG-11 | Integration | `createNotification` called but no notification appears | Add `console.log` in `createNotification()` | Confirm self-suppression isn't triggering — check if actorId === userId in test scenario |
| DBG-12 | Integration | TypeScript circular import error | Check import graph | `notification.actions.ts` must NOT import from itself. Triggers come from other action files only |

---

*End of Antigravity Instruction Manual — Module 11*  
*Generated by Elite Architect Protocol | Zero Ambiguity Standard*
