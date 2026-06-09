"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { NotificationRecord } from "@/src/Library/dal/notification.dal";
import { getNotifications, markNotificationRead } from "@/src/Action/notification.actions";

type NotificationState = {
  notifications: NotificationRecord[];
  unreadCount: number;
  nextCursor: string | null;
  isLoading: boolean;
};

export function useNotifications() {
  const [state, setState] = useState<NotificationState>({
    notifications: [],
    unreadCount: 0,
    nextCursor: null,
    isLoading: true,
  });

  const isMountedRef = useRef(true);

  // Initial Fetch
  useEffect(() => {
    isMountedRef.current = true;
    let isSubscribed = true;

    async function fetchInitial() {
      const result = await getNotifications();
      if (result.success && isSubscribed) {
        setState((prev) => ({
          ...prev,
          notifications: result.data.items,
          nextCursor: result.data.nextCursor,
          isLoading: false,
        }));
      } else if (isSubscribed) {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    }

    fetchInitial();

    return () => {
      isMountedRef.current = false;
      isSubscribed = false;
    };
  }, []);

  // SSE Subscription
  useEffect(() => {
    let eventSource: EventSource | null = null;

    if (typeof window !== "undefined") {
      eventSource = new EventSource("/api/notifications/sse");

      eventSource.addEventListener("initial", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setState((prev) => ({ ...prev, unreadCount: data.unreadCount }));
        } catch (err) {
          console.error("Failed to parse initial SSE event", err);
        }
      });

      eventSource.addEventListener("new_notification", (e: MessageEvent) => {
        try {
          const newNotification = JSON.parse(e.data) as NotificationRecord;
          setState((prev) => {
            // Deduplicate
            if (prev.notifications.some((n) => n.id === newNotification.id)) return prev;
            return {
              ...prev,
              notifications: [newNotification, ...prev.notifications],
              unreadCount: prev.unreadCount + 1,
            };
          });
        } catch (err) {
          console.error("Failed to parse new_notification SSE event", err);
        }
      });

      eventSource.onerror = (e) => {
        console.error("SSE Error:", e);
      };
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  const fetchNextPage = useCallback(async () => {
    if (!state.nextCursor || state.isLoading) return;

    setState((prev) => ({ ...prev, isLoading: true }));
    const result = await getNotifications(state.nextCursor);

    if (result.success) {
      setState((prev) => ({
        ...prev,
        notifications: [...prev.notifications, ...result.data.items],
        nextCursor: result.data.nextCursor,
        isLoading: false,
      }));
    } else {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [state.nextCursor, state.isLoading]);

  const markAsRead = useCallback(async (id: string) => {
    // Optimistic UI update
    setState((prev) => {
      const updated = prev.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n
      );
      return {
        ...prev,
        notifications: updated,
        unreadCount: Math.max(0, prev.unreadCount - 1),
      };
    });

    const result = await markNotificationRead(id);
    if (!result.success) {
      // Rollback on failure
      setState((prev) => {
        const rolledBack = prev.notifications.map((n) =>
          n.id === id ? { ...n, isRead: false } : n
        );
        return {
          ...prev,
          notifications: rolledBack,
          unreadCount: prev.unreadCount + 1,
        };
      });
    }
  }, []);

  return {
    ...state,
    fetchNextPage,
    markAsRead,
  };
}
