"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, History, Wrench, User, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useTranslation } from "./locale-context";

interface TabItem {
  nameKey: string;
  href: string;
  icon: React.ElementType;
}

const tabItems: TabItem[] = [
  { nameKey: "common.home", href: "/portal", icon: Home },
  { nameKey: "common.history", href: "/portal/history", icon: History },
  { nameKey: "common.support", href: "/portal/support", icon: Wrench },
  { nameKey: "common.profile", href: "/portal/profile", icon: User },
];

export function TenantShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground pb-[calc(4rem+env(safe-area-inset-bottom))]">
      {/* Top Header */}
      <header className="sticky top-0 z-40 h-14 border-b border-border bg-surface/90 backdrop-blur-md px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/portal" className="flex items-center gap-2">
            <span className="flex items-center justify-center h-7 w-7 rounded bg-primary text-primary-foreground font-semibold text-sm">
              ◈
            </span>
            <span className="font-semibold text-sm tracking-tight text-text-primary">
              RentPilot
            </span>
          </Link>
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-surface-muted text-text-muted border border-border/40">
            Unit 201
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/owner"
            className="hidden sm:flex items-center gap-1 text-xs text-text-muted hover:text-text-primary mr-1"
          >
            <span>{t("common.owner")} View</span>
            <ArrowUpRight className="h-3 w-3" />
          </Link>
          <NotificationBell />
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </header>

      {/* Main Tenant Content */}
      <main className="flex-1 max-w-lg mx-auto w-full p-4 sm:p-6">
        {children}
      </main>

      {/* Fixed Bottom Navigation (Mobile Touch-Optimized) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md border-t border-border flex items-center justify-around h-16 pb-[env(safe-area-inset-bottom)] max-w-lg mx-auto">
        {tabItems.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full min-h-[44px] transition-colors",
                isActive
                  ? "text-primary font-semibold"
                  : "text-text-muted hover:text-text-primary"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[11px] mt-0.5">{t(tab.nameKey)}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
