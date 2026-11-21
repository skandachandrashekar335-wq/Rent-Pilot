"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { isAllowedOwnerEmail } from "@/lib/auth/admin-allowlist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, signInWithGoogle, signOut, error: authError } = useAuth();
  const [loggingIn, setLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState("");

  const handleGoogleSignIn = async () => {
    setLoggingIn(true);
    setError(null);
    try {
      await signInWithGoogle();
      // On successful login, the auth state listener syncs profile and redirects
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sign in with Google");
      setLoggingIn(false);
    }
  };

  // If already logged in, show quick routing buttons
  if (user) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="h-14 border-b border-border bg-surface px-4 sm:px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex items-center justify-center h-7 w-7 rounded bg-primary text-primary-foreground font-semibold text-sm">
              ◈
            </span>
            <span className="font-semibold text-base text-text-primary">RentPilot</span>
          </Link>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full border-border shadow-xl">
            <CardHeader className="text-center pb-3">
              <Badge variant="paid" className="mx-auto mb-2">Signed In</Badge>
              <CardTitle className="text-xl">Welcome, {user.displayName || user.email}</CardTitle>
              <CardDescription className="text-xs">
                {user.email}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isAllowedOwnerEmail(user.email) ? (
                <>
                  <Link href="/dashboard/owner" className="block w-full">
                    <Button className="w-full justify-between h-11">
                      <span>Enter Owner Command Center</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/portal" className="block w-full">
                    <Button variant="outline" className="w-full justify-between h-11">
                      <span>Enter Tenant Portal</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/portal" className="block w-full">
                    <Button className="w-full justify-between h-11">
                      <span>Enter Tenant Portal</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <div className="p-2.5 rounded-lg bg-surface-muted border border-border/40 text-[11px] text-text-muted text-center">
                    Signed in as tenant account. Owner Command Center access is restricted to authorized administrator accounts.
                  </div>
                </>
              )}

              <Button
                variant="ghost"
                onClick={() => signOut()}
                className="w-full h-9 text-xs text-text-muted hover:text-text-primary"
              >
                Sign Out / Switch Account
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="h-14 border-b border-border bg-surface px-4 sm:px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex items-center justify-center h-7 w-7 rounded bg-primary text-primary-foreground font-semibold text-sm">
            ◈
          </span>
          <span className="font-semibold text-base text-text-primary">RentPilot</span>
        </Link>
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-border shadow-xl">
          <CardHeader className="text-center space-y-2 pb-4">
            <div className="h-12 w-12 rounded-full bg-surface-muted mx-auto flex items-center justify-center text-primary border border-border">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Sign In to RentPilot</CardTitle>
            <CardDescription className="text-xs max-w-xs mx-auto">
              Secure authentication for property owners, property managers, and authorized tenants.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {(error || authError) && (
              <div className="p-3 rounded-md bg-status-overdue-bg text-status-overdue-fg text-xs font-medium flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error || authError}</span>
              </div>
            )}

            <Button
              onClick={handleGoogleSignIn}
              disabled={loggingIn || loading}
              className="w-full h-11 text-sm font-semibold flex items-center justify-center gap-2 shadow-sm"
            >
              {loggingIn ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Connecting with Google...</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </Button>

            <div className="p-3 rounded bg-surface-muted border border-border/40 text-[11px] text-text-muted space-y-1">
              <p>• <strong>Landlords:</strong> Sign in with your owner Google account to manage houses and billing.</p>
              <p>• <strong>Tenants:</strong> Sign in using the exact email address where you received your landlord invitation.</p>
            </div>

            <div className="pt-2 border-t border-border/40 space-y-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const clean = inviteCode.trim().replace(/^.*\/invite\//i, "").split(/[?#]/)[0].trim();
                  if (clean) router.push(`/invite/${clean}`);
                }}
                className="space-y-2"
              >
                <label className="text-xs font-medium text-text-primary block">
                  Have an invitation link or token?
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Paste invite link or code"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <Button type="submit" disabled={!inviteCode.trim()} size="sm" variant="outline">
                    Redeem
                  </Button>
                </div>
              </form>
            </div>

            <div className="text-center pt-2">
              <Link href="/" className="text-xs text-text-muted hover:text-text-primary">
                ← Back to Home
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
