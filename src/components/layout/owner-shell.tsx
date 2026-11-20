"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Zap,
  Building2,
  FileSpreadsheet,
  Wrench,
  Menu,
  X,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme-toggle";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { UserAccountMenu } from "@/components/auth/user-account-menu";
import { useAuth } from "@/lib/auth/auth-context";
import { useTranslation } from "./locale-context";

interface NavItem {
  nameKey: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
}

const navItems: NavItem[] = [
  { nameKey: "owner.actionCenter", href: "/dashboard/owner", icon: Zap },
  { nameKey: "common.properties", href: "/dashboard/owner/properties", icon: Building2 },
  { nameKey: "common.billing", href: "/dashboard/owner/billing", icon: FileSpreadsheet },
  { nameKey: "common.maintenance", href: "/dashboard/owner/maintenance", icon: Wrench },
];

export function OwnerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { activeOrganization } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      {/* Top Application Bar */}
      <header className="sticky top-0 z-40 h-14 border-b border-border bg-surface/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden"
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          <Link href="/dashboard/owner" className="flex items-center gap-2">
            <span className="flex items-center justify-center h-7 w-7 rounded bg-primary text-primary-foreground font-semibold text-sm">
              ◈
            </span>
            <span className="font-semibold text-base tracking-tight text-text-primary">
              RentPilot
            </span>
          </Link>

          <div className="hidden sm:flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded text-xs font-medium bg-surface-muted text-text-muted border border-border/40">
            <span>{activeOrganization?.name || "Shekar Homes"}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/portal"
            className="hidden lg:flex items-center gap-1 text-xs text-text-muted hover:text-text-primary px-2 py-1 rounded hover:bg-surface-hover"
          >
            <span>{t("common.tenant")} Portal</span>
            <ArrowUpRight className="h-3 w-3" />
          </Link>

          <NotificationBell />

          <LocaleSwitcher />
          <ThemeToggle />

          <div className="pl-1 border-l border-border/60">
            <UserAccountMenu />
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Desktop Sidebar (240px) */}
        <aside className="hidden md:flex flex-col w-60 border-r border-border bg-surface shrink-0 p-3">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/dashboard/owner"
                  ? pathname === "/dashboard/owner"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-text-muted hover:bg-surface-hover hover:text-text-primary"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{t(item.nameKey)}</span>
                  </div>
                  {item.badge ? (
                    <span
                      className={cn(
                        "text-xs px-1.5 py-0.2 rounded-full font-semibold",
                        isActive
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-status-pending-bg text-status-pending-fg"
                      )}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-4 border-t border-border/50 text-xs text-text-muted px-2">
            <p className="font-mono text-[11px]">RentPilot v1.0</p>
            <p className="text-[10px] text-text-muted/60 mt-0.5">₹0 Cloud Architecture</p>
          </div>
        </aside>

        {/* Mobile Slide Drawer */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/40 md:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <div
              className="w-64 h-full bg-surface p-4 flex flex-col border-r border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <span className="font-semibold text-text-primary">RentPilot Navigation</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <nav className="space-y-1.5 mt-4">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === "/dashboard/owner"
                      ? pathname === "/dashboard/owner"
                      : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-text-muted hover:bg-surface-hover"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="h-5 w-5" />
                        <span>{t(item.nameKey)}</span>
                      </div>
                      {item.badge ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-status-pending-bg text-status-pending-fg">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-auto pt-4 border-t border-border">
                <Link
                  href="/portal"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-md bg-surface-muted text-text-primary text-xs font-medium"
                >
                  <span>Switch to Tenant Portal</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Primary Page Canvas */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
