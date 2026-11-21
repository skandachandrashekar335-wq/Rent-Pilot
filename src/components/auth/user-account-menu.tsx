"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { isAllowedOwnerEmail } from "@/lib/auth/admin-allowlist";
import { Button } from "@/components/ui/button";
import {
  User,
  LogOut,
  Copy,
  Check,
  ShieldCheck,
  ChevronDown,
  Building2,
  ExternalLink,
} from "lucide-react";

export function UserAccountMenu({ className }: { className?: string }) {
  const { user, profile, activeOrganization, signOut, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Handle email copy
  const handleCopyEmail = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.email) return;
    try {
      await navigator.clipboard.writeText(user.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Failed to copy email:", err);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      setIsOpen(false);
      await signOut();
      router.push("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="h-8 w-20 bg-surface-muted/60 animate-pulse rounded-full" />
    );
  }

  // Signed-out State
  if (!user) {
    return (
      <Link href="/login" className={className}>
        <Button
          size="sm"
          variant="outline"
          className="rounded-full text-xs font-medium h-8 px-3 border-border hover:bg-surface-hover"
        >
          Sign In
        </Button>
      </Link>
    );
  }

  // Signed-in State
  const email = user.email || profile?.email || "";
  const displayName = profile?.full_name || user.displayName || email.split("@")[0] || "User";
  const isAllowlisted = isAllowedOwnerEmail(email);
  const roleLabel = isAllowlisted ? "AUTHORIZED ADMIN" : "TENANT";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className={`relative inline-block text-left ${className || ""}`} ref={dropdownRef}>
      {/* Trigger Button: Avatar / Initials + Email Pill */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-surface-muted/80 hover:bg-surface-hover border border-border/60 transition-all text-left focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
        aria-label="User Account Menu"
        aria-expanded={isOpen}
      >
        <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shadow-xs">
          {initials || <User className="h-3.5 w-3.5" />}
        </div>
        <span className="hidden sm:inline-block text-xs font-medium text-text-primary max-w-[130px] truncate">
          {email}
        </span>
        <ChevronDown
          className={`h-3 w-3 text-text-muted transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl bg-surface border border-border shadow-xl z-50 py-2 animate-in fade-in zoom-in-95 duration-150">
          {/* Header Info */}
          <div className="px-4 py-3 border-b border-border/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-text-primary truncate">
                {displayName}
              </span>
              <span
                className={`text-[9px] font-mono font-bold tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  isAllowlisted
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-surface-muted text-text-muted border border-border/40"
                }`}
              >
                {isAllowlisted && <ShieldCheck className="h-3 w-3" />}
                {roleLabel}
              </span>
            </div>

            {/* Email with Copy Pill */}
            <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-surface-muted/60 border border-border/40">
              <span className="text-xs font-mono text-text-muted truncate select-all">
                {email}
              </span>
              <button
                onClick={handleCopyEmail}
                className="p-1 hover:bg-surface rounded text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                title="Copy email"
                aria-label="Copy email"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            {/* Organization indicator */}
            {isAllowlisted && (
              <div className="flex items-center gap-1.5 text-[11px] text-text-muted pt-0.5">
                <Building2 className="h-3 w-3 text-primary" />
                <span>Organization: </span>
                <span className="font-medium text-text-primary">
                  {activeOrganization?.name || "Shekar Homes"}
                </span>
              </div>
            )}
          </div>

          {/* Quick Jump Links */}
          <div className="py-1 px-1 border-b border-border/60">
            {isAllowlisted ? (
              <>
                <Link
                  href="/dashboard/owner"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between px-3 py-2 text-xs font-medium text-text-primary hover:bg-surface-hover rounded-lg transition-colors"
                >
                  <span>Owner Command Center</span>
                  <ExternalLink className="h-3 w-3 text-text-muted" />
                </Link>
                <Link
                  href="/dashboard/owner/settings"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between px-3 py-2 text-xs text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Security & 2FA Settings</span>
                  </span>
                  <ExternalLink className="h-3 w-3 text-text-muted" />
                </Link>
                <Link
                  href="/portal"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between px-3 py-2 text-xs text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors"
                >
                  <span>Tenant View</span>
                  <ExternalLink className="h-3 w-3 text-text-muted" />
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/portal"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between px-3 py-2 text-xs font-medium text-text-primary hover:bg-surface-hover rounded-lg transition-colors"
                >
                  <span>Tenant Portal</span>
                  <ExternalLink className="h-3 w-3 text-text-muted" />
                </Link>
                <Link
                  href="/portal/profile"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between px-3 py-2 text-xs text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Profile & 2FA Security</span>
                  </span>
                  <ExternalLink className="h-3 w-3 text-text-muted" />
                </Link>
              </>
            )}
          </div>

          {/* Logout Action */}
          <div className="pt-1 px-1">
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-status-overdue-fg hover:bg-status-overdue-bg rounded-lg transition-colors cursor-pointer text-left"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{isLoggingOut ? "Signing out..." : "Log Out"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
