"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldAlert, Lock, ArrowRight, Loader2, Mail } from "lucide-react";

export function TenantGuard({ children }: { children: React.ReactNode }) {
  const { user, isTenant, loading, signInWithGoogle, refreshSession } = useAuth();
  const [inviteCode, setInviteCode] = useState("");
  const router = useRouter();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-text-muted font-mono">Checking tenancy status...</p>
        </div>
      </div>
    );
  }

  // 1. Not Authenticated State
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full border-border shadow-lg">
          <CardHeader className="text-center space-y-2 pb-4">
            <div className="h-12 w-12 rounded-full bg-surface-muted mx-auto flex items-center justify-center text-primary border border-border">
              <Lock className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl">Tenant Portal Login</CardTitle>
            <CardDescription className="text-xs">
              Sign in with your Google account to view your monthly bills, pay via UPI, and submit maintenance requests.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={signInWithGoogle} className="w-full h-11 text-sm font-semibold">
              <span className="mr-2">Sign in with Google</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <Link href="/" className="text-xs text-text-muted hover:text-text-primary">
                ← Return to RentPilot Gateway
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 2. Authenticated but No Active Tenancy Link
  if (!isTenant) {
    const handleRedeemCode = (e: React.FormEvent) => {
      e.preventDefault();
      const code = inviteCode.trim();
      if (code) {
        router.push(`/invite/${code}`);
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full border-border shadow-lg">
          <CardHeader className="text-center space-y-2 pb-4">
            <div className="h-12 w-12 rounded-full bg-status-pending-bg/50 mx-auto flex items-center justify-center text-status-pending-fg border border-status-pending-fg/20">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <CardTitle className="text-lg">No Active Tenancy Found</CardTitle>
            <CardDescription className="text-xs">
              You are signed in as <strong>{user.email}</strong>. Google sign-in alone does not grant access to rental records.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-md bg-surface-muted border border-border/40 text-xs text-text-muted space-y-1.5">
              <p className="flex items-start gap-2">
                <Mail className="h-4 w-4 text-text-primary shrink-0 mt-0.5" />
                <span>
                  Ask your property owner or landlord to issue an invitation to <strong>{user.email}</strong>.
                </span>
              </p>
            </div>

            <form onSubmit={handleRedeemCode} className="space-y-3 pt-2">
              <label className="text-xs font-medium text-text-primary">
                Have an invitation code or token?
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="Paste invite token here"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button type="submit" disabled={!inviteCode.trim()} size="default">
                  Redeem
                </Button>
              </div>
            </form>

            <div className="pt-2 border-t border-border/40 flex justify-between text-xs text-text-muted">
              <Link href="/" className="hover:text-text-primary">
                ← Gateway
              </Link>
              <button onClick={() => refreshSession()} className="text-primary hover:underline font-medium">
                Check Again ↻
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 3. Authorized Tenant
  return <>{children}</>;
}
