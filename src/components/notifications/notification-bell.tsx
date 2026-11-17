"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import { useTranslation } from "@/components/layout/locale-context";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  link_href?: string | null;
  is_read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.warn("Notifications fetch warning:", err);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const handleMarkAllRead = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/notifications/read", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ all: true }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.warn("Mark all read warning:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = async (notif: NotificationItem) => {
    if (!notif.is_read && user) {
      try {
        const token = await user.getIdToken();
        await fetch("/api/notifications/read", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ notificationId: notif.id }),
        });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (err) {
        console.warn("Mark read warning:", err);
      }
    }
    setOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          setOpen(!open);
          if (!open) fetchNotifications();
        }}
        aria-label="Notifications"
        className="text-text-muted hover:text-text-primary relative"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-status-overdue-fg animate-pulse" />
        )}
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-lg border border-border bg-surface shadow-xl z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
          <div className="p-3 border-b border-border flex items-center justify-between bg-surface-muted/30">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-text-primary">{t("notifications.title")}</span>
              {unreadCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary font-mono font-bold">
                  {unreadCount}
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={loading}
                className="text-[11px] text-text-muted hover:text-primary flex items-center gap-1 transition-colors"
              >
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
                <span>{t("notifications.markAllRead")}</span>
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-border/40">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-text-muted">
                {t("notifications.empty")}
              </div>
            ) : (
              notifications.map((notif) => {
                const itemContent = (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-xs ${!notif.is_read ? "text-text-primary font-semibold" : "text-text-primary"}`}>
                        {notif.title}
                      </span>
                      {!notif.is_read && (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-[11px] text-text-muted line-clamp-2 mt-0.5">{notif.body}</p>
                    <span className="text-[10px] text-text-muted/70 mt-1 block">
                      {new Date(notif.created_at).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </>
                );

                const itemClass = `block p-3 text-xs hover:bg-surface-hover/60 transition-colors ${
                  !notif.is_read ? "bg-primary/5 font-medium" : "text-text-muted"
                }`;

                return notif.link_href ? (
                  <Link
                    key={notif.id}
                    href={notif.link_href}
                    onClick={() => handleItemClick(notif)}
                    className={itemClass}
                  >
                    {itemContent}
                  </Link>
                ) : (
                  <div
                    key={notif.id}
                    onClick={() => handleItemClick(notif)}
                    className={`${itemClass} cursor-pointer`}
                  >
                    {itemContent}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
