"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { isAllowedOwnerEmail } from "@/lib/auth/admin-allowlist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Lock, ArrowRight, Loader2, ShieldAlert } from "lucide-react";
import { authFetch } from "@/lib/api-client";

export function OwnerGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, isOwner, memberships, loading, signInWithGoogle, signOut, refreshSession } = useAuth();
  const [orgName, setOrgName] = useState("");
  const [billingDay, setBillingDay] = useState(10);
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-text-muted font-mono">Authenticating with RentPilot...</p>
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
            <CardTitle className="text-xl">Owner Authentication Required</CardTitle>
            <CardDescription className="text-xs">
              Access to the Property Owner Command Center requires an authorized administrator Google account.
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

  // 2. Hard-Locked Allowlist Check (skandachandrashekar335@gmail.com & chandraskekar335@gmail.com ONLY)
  const isAllowlisted = isAllowedOwnerEmail(user.email);
  if (!isAllowlisted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full border-border shadow-xl">
          <CardHeader className="text-center space-y-2 pb-4">
            <div className="h-12 w-12 rounded-full bg-status-overdue-bg mx-auto flex items-center justify-center text-status-overdue-fg border border-status-overdue-border">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl">Unauthorized Admin Account</CardTitle>
            <CardDescription className="text-xs">
              Access to the Property Owner Command Center is strictly restricted to designated administrator accounts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 rounded-lg bg-surface-muted border border-border/60 text-center space-y-1">
              <p className="text-[11px] text-text-muted">Signed in as:</p>
              <p className="text-xs font-mono font-bold text-text-primary select-all">{user.email}</p>
            </div>

            <div className="space-y-2 pt-1">
              <Button
                variant="outline"
                onClick={async () => {
                  await signOut();
                  await signInWithGoogle();
                }}
                className="w-full h-10 text-xs font-medium border-border"
              >
                Logout / Switch Google Account
              </Button>

              <Link href="/portal" className="block w-full">
                <Button className="w-full h-10 text-xs font-semibold">
                  Go to Tenant Portal
                </Button>
              </Link>
            </div>

            <div className="text-center pt-2">
              <Link href="/" className="text-xs text-text-muted hover:text-text-primary">
                ← Return to RentPilot Home
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 3. Authenticated Admin but Organization Not Yet Linked (Fallback Onboarding)
  if (memberships.length === 0 && !isOwner) {
    const handleCreateOrg = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsCreatingOrg(true);
      setOrgError(null);

      try {
        let freshToken: string | undefined;
        if (user && typeof user.getIdToken === "function") {
          try {
            freshToken = await user.getIdToken(true);
          } catch (tokErr) {
            console.warn("[owner-guard] Failed to force-refresh token:", tokErr);
          }
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (freshToken) {
          headers["Authorization"] = `Bearer ${freshToken}`;
        }

        const res = await authFetch("/api/organizations", {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: orgName.trim(),
            billingDayOfMonth: Number(billingDay),
            currency: "INR",
            timezone: "Asia/Kolkata",
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const errDetail = data.code ? ` [Code: ${data.code}]` : "";
          throw new Error((data.error || "Failed to initialize organization") + errDetail);
        }

        await refreshSession();
      } catch (err: unknown) {
        setOrgError(err instanceof Error ? err.message : "Failed to create organization");
      } finally {
        setIsCreatingOrg(false);
      }
    };

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full border-border shadow-lg">
          <CardHeader className="space-y-2 pb-4">
            <div className="h-10 w-10 rounded-md bg-surface-muted flex items-center justify-center text-primary border border-border">
              <Building2 className="h-5 w-5" />
            </div>
            <CardTitle className="text-xl">Setup Your Rental Business</CardTitle>
            <CardDescription className="text-xs">
              Welcome, {profile?.full_name || user.email}! Set up your primary rental organization to manage properties and issue monthly bills.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {orgError && (
              <div className="p-3 mb-4 rounded-md bg-status-overdue-bg text-status-overdue-fg text-xs font-medium">
                {orgError}
              </div>
            )}
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-text-primary">
                  Rental Business / Family Portfolio Name
                </label>
                <Input
                  placeholder="e.g. Shekar Homes"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-text-primary">
                  Monthly Billing Preparation Day
                </label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={billingDay}
                  onChange={(e) => setBillingDay(Number(e.target.value))}
                  required
                  className="mt-1 font-mono"
                />
                <p className="text-[11px] text-text-muted mt-1">
                  Default is the 10th of every month. You will receive an email reminder to enter variable utility charges.
                </p>
              </div>

              <Button type="submit" disabled={isCreatingOrg || !orgName.trim()} className="w-full h-11">
                {isCreatingOrg ? "Initializing Organization..." : "Create Organization & Continue"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 4. Authorized Owner
  return <>{children}</>;
}
