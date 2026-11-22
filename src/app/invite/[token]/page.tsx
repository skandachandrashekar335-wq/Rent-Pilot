"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, CheckCircle2, AlertTriangle, ArrowRight, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { authFetch } from "@/lib/api-client";

interface InvitationData {
  id: string;
  organizationName: string;
  invitedEmail: string;
  status: string;
  expiresAt: string;
  isExpired: boolean;
}

export default function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: rawToken } = use(params);
  const token = (rawToken || "")
    .trim()
    .replace(/^.*\/invite\//i, "")
    .split(/[?#]/)[0]
    .trim();

  const router = useRouter();
  const { user, loading: authLoading, signInWithGoogle, signOut, refreshSession } = useAuth();
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptSuccess, setAcceptSuccess] = useState(false);

  useEffect(() => {
    async function fetchInvitation() {
      try {
        const res = await fetch(`/api/invitations/${token}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to load invitation");
        }
        setInvitation(data.invitation);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Invitation not found or invalid");
      } finally {
        setLoading(false);
      }
    }
    if (token) {
      fetchInvitation();
    } else {
      setError("Missing invitation token");
      setLoading(false);
    }
  }, [token]);

  const handleAccept = async () => {
    if (!user) return;
    setAccepting(true);
    setError(null);

    try {
      // Force fresh token to eliminate "Invalid or expired token" errors
      await user.getIdToken().catch(() => {});

      const res = await authFetch(`/api/invitations/${token}/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to accept invitation");
      }

      setAcceptSuccess(true);
      await refreshSession();
      setTimeout(() => {
        router.push("/portal");
      }, 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to accept");
    } finally {
      setAccepting(false);
    }
  };

  const handleSignInAndAccept = async () => {
    setError(null);
    try {
      await signInWithGoogle();
      // Auth state update will trigger re-render with active user
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Google authentication failed");
    }
  };

  const handleSwitchAccount = async () => {
    setError(null);
    try {
      await signOut();
      await signInWithGoogle();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to switch Google account");
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-text-muted font-mono">
            {loading ? "Verifying invitation token..." : "Checking authentication session..."}
          </p>
        </div>
      </div>
    );
  }

  const isEmailMatch =
    user && invitation && user.email?.trim().toLowerCase() === invitation.invitedEmail.trim().toLowerCase();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full border-border shadow-xl">
        <CardHeader className="text-center space-y-2 pb-4">
          <div className="h-12 w-12 rounded-full bg-surface-muted mx-auto flex items-center justify-center text-primary border border-border">
            <Building2 className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">Tenancy Invitation</CardTitle>
          <CardDescription className="text-xs">
            You have been invited to join a rental property on RentPilot.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-status-overdue-bg text-status-overdue-fg text-xs font-medium flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {acceptSuccess ? (
            <div className="p-6 text-center space-y-2">
              <CheckCircle2 className="h-10 w-10 text-status-paid-fg mx-auto" />
              <h3 className="text-base font-semibold text-text-primary">Invitation Accepted!</h3>
              <p className="text-xs text-text-muted">
                Your tenancy has been verified. Redirecting to your Tenant Portal...
              </p>
            </div>
          ) : invitation ? (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg bg-surface-muted border border-border/40 text-xs space-y-2">
                <div className="flex justify-between py-1 border-b border-border/30">
                  <span className="text-text-muted">Rental Organization:</span>
                  <span className="font-semibold text-text-primary">
                    {invitation.organizationName}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/30">
                  <span className="text-text-muted">Invited Email:</span>
                  <span className="font-mono text-text-primary font-medium">
                    {invitation.invitedEmail}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-text-muted">Invitation Status:</span>
                  <Badge
                    variant={
                      invitation.status === "PENDING"
                        ? "pending"
                        : invitation.status === "ACCEPTED"
                        ? "paid"
                        : "overdue"
                    }
                  >
                    {invitation.status}
                  </Badge>
                </div>
              </div>

              {invitation.status === "ACCEPTED" && isEmailMatch ? (
                <div className="space-y-2 text-center pt-1">
                  <div className="p-3 rounded-md bg-status-paid-bg text-status-paid-fg text-xs font-medium flex items-center justify-center gap-2">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    <span>This tenancy is already active under your account.</span>
                  </div>
                  <Button
                    onClick={() => router.push("/portal")}
                    className="w-full h-11 font-semibold text-sm"
                  >
                    <span>Enter Tenant Portal</span>
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              ) : invitation.isExpired ? (
                <div className="text-center p-3 text-xs text-status-overdue-fg font-medium">
                  This invitation has expired. Please contact your property owner for a new invite.
                </div>
              ) : !user ? (
                /* User Not Signed In */
                <div className="space-y-3 pt-1">
                  <p className="text-xs text-text-muted text-center leading-relaxed">
                    To activate your rental tenancy, sign in with the Google account for <strong>{invitation.invitedEmail}</strong>.
                  </p>
                  <Button
                    onClick={handleSignInAndAccept}
                    className="w-full h-11 text-sm font-semibold flex items-center justify-center gap-2 shadow-sm"
                  >
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
                    <span>Sign in with Google ({invitation.invitedEmail}) to Accept</span>
                  </Button>
                </div>
              ) : !isEmailMatch ? (
                /* Email Mismatch Warning */
                <div className="p-3.5 rounded bg-status-pending-bg/60 border border-status-pending-fg/30 text-xs space-y-3">
                  <div className="flex items-center gap-1.5 font-semibold text-status-pending-fg">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Account Mismatch</span>
                  </div>
                  <p className="text-text-primary leading-relaxed">
                    You are currently signed in as <strong>{user.email}</strong>, but this tenancy invitation was issued to <strong>{invitation.invitedEmail}</strong>.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSwitchAccount}
                    className="w-full text-xs font-medium flex items-center justify-center gap-1.5"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Switch to {invitation.invitedEmail}</span>
                  </Button>
                </div>
              ) : (
                /* Ready to Accept */
                <Button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="w-full h-11 font-semibold text-sm"
                >
                  {accepting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span>Accepting Tenancy...</span>
                    </>
                  ) : (
                    <>
                      <span>Accept Invitation & Enter Portal</span>
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              )}
            </div>
          ) : null}

          <div className="pt-2 text-center flex items-center justify-center gap-4 text-xs text-text-muted">
            <Link href="/login" className="hover:text-text-primary transition-colors">
              RentPilot Login
            </Link>
            <span>•</span>
            <Link href="/" className="hover:text-text-primary transition-colors">
              Home Gateway
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
