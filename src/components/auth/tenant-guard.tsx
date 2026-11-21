"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldAlert, Lock, ArrowRight, Loader2, Mail, AlertTriangle, CheckCircle2 } from "lucide-react";
import { authFetch } from "@/lib/api-client";

export function extractCleanInviteToken(input: string): string {
  if (!input) return "";
  return input
    .trim()
    .replace(/^.*\/invite\//i, "")
    .split(/[?#]/)[0]
    .trim();
}

export function TenantGuard({ children }: { children: React.ReactNode }) {
  const { user, isTenant, loading, signInWithGoogle, refreshSession } = useAuth();
  const [inviteCode, setInviteCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null);
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
              <Link href="/login" className="text-xs text-text-muted hover:text-text-primary">
                ← Go to RentPilot Sign In
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 2. Authenticated but No Active Tenancy Link
  if (!isTenant) {
    const handleRedeemCode = async (e: React.FormEvent) => {
      e.preventDefault();
      setRedeemError(null);
      setRedeemSuccess(null);

      const cleanToken = extractCleanInviteToken(inviteCode);

      if (!cleanToken) {
        setRedeemError("Please paste a valid invitation code or link");
        return;
      }

      setRedeeming(true);
      try {
        // Direct redemption via POST /api/invitations/redeem
        const res = await authFetch("/api/invitations/redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: cleanToken }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setRedeemSuccess("Tenancy activated! Loading your portal...");
          await refreshSession();
          setTimeout(() => {
            router.push("/portal");
          }, 1000);
          return;
        }

        if (res.status === 403 || res.status === 404) {
          // If specific error, show it; otherwise route to /invite/${cleanToken}
          if (data.error && data.error.includes("issued to")) {
            setRedeemError(data.error);
            return;
          }
        }

        // Fallback navigation directly to clean invite token
        router.push(`/invite/${cleanToken}`);
      } catch {
        router.push(`/invite/${cleanToken}`);
      } finally {
        setRedeeming(false);
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
            {redeemError && (
              <div className="p-3 rounded-md bg-status-overdue-bg text-status-overdue-fg text-xs font-medium flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{redeemError}</span>
              </div>
            )}

            {redeemSuccess && (
              <div className="p-3 rounded-md bg-status-paid-bg text-status-paid-fg text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{redeemSuccess}</span>
              </div>
            )}

            <div className="p-3 rounded-md bg-surface-muted border border-border/40 text-xs text-text-muted space-y-1.5">
              <p className="flex items-start gap-2">
                <Mail className="h-4 w-4 text-text-primary shrink-0 mt-0.5" />
                <span>
                  Ask your property owner to issue an invitation to <strong>{user.email}</strong>.
                </span>
              </p>
            </div>

            <form onSubmit={handleRedeemCode} className="space-y-3 pt-2">
              <label className="text-xs font-medium text-text-primary">
                Have an invitation link or token?
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="Paste invite link or code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button type="submit" disabled={!inviteCode.trim() || redeeming} size="default">
                  {redeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : "Redeem"}
                </Button>
              </div>
              <p className="text-[11px] text-text-muted">
                Accepts full URLs (e.g. <code>https://.../invite/abc123</code>) or raw codes.
              </p>
            </form>

            <div className="pt-2 border-t border-border/40 flex justify-between text-xs text-text-muted">
              <Link href="/login" className="hover:text-text-primary">
                ← Sign In / Switch User
              </Link>
              <button
                type="button"
                onClick={async () => {
                  await refreshSession();
                }}
                className="text-primary hover:underline font-medium"
              >
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
