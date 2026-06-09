"use client";

import { useNotifications } from "@/src/Hooks/useNotifications";
import { Popover, PopoverContent, PopoverTrigger } from "@/src/Components/UI/popover";
import { Badge } from "@/src/Components/UI/badge";
import { Button } from "@/src/Components/UI/button";
import { ScrollArea } from "@/src/Components/UI/scroll-area";
import { Separator } from "@/src/Components/UI/separator";
import { Bell, Loader2 } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useState } from "react";

export function NotificationFeed() {
  const { notifications, unreadCount, nextCursor, isLoading, fetchNextPage, markAsRead } = useNotifications();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="relative">
        <Bell className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center px-1 text-[10px] pointer-events-none"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0 shadow-xl" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <span className="text-xs text-muted-foreground">{unreadCount} unread</span>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {notifications.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center h-full py-12 px-6 text-center text-muted-foreground">
              <Bell className="h-10 w-10 opacity-20 mb-2" />
              <p className="text-sm font-medium">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => {
                    if (!notification.isRead) markAsRead(notification.id);
                  }}
                  className={cn(
                    "relative flex items-start gap-3 p-4 transition-colors cursor-pointer hover:bg-muted/50",
                    !notification.isRead ? "bg-primary/5 font-medium" : "text-muted-foreground"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug line-clamp-2">{notification.message}</p>
                    <p className="text-xs mt-1 text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  {!notification.isRead && (
                    <span className="flex-shrink-0 mt-1.5 w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
              ))}
            </div>
          )}

          {isLoading && (
            <div className="p-4 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {nextCursor && !isLoading && (
            <div className="p-2">
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={fetchNextPage}>
                Load More
              </Button>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
