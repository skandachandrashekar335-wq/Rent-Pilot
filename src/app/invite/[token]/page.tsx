"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, CheckCircle2, AlertTriangle, ArrowRight, Loader2 } from "lucide-react";

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
  const { token } = use(params);
  const router = useRouter();
  const { user, signInWithGoogle, refreshSession } = useAuth();
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
        setError(err instanceof Error ? err.message : "Invitation not found");
      } finally {
        setLoading(false);
      }
    }
    fetchInvitation();
  }, [token]);

  const handleAccept = async () => {
    if (!user) return;
    setAccepting(true);
    setError(null);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch(`/api/invitations/${token}/accept`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
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
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to accept");
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-text-muted font-mono">Verifying invitation token...</p>
        </div>
      </div>
    );
  }

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
                  <span className="font-mono text-text-primary">
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

              {invitation.isExpired ? (
                <div className="text-center p-3 text-xs text-status-overdue-fg font-medium">
                  This invitation has expired. Please contact your property owner for a new invite.
                </div>
              ) : !user ? (
                /* User Not Signed In */
                <div className="space-y-2">
                  <p className="text-xs text-text-muted text-center">
                    Sign in with the Google account associated with <strong>{invitation.invitedEmail}</strong> to accept.
                  </p>
                  <Button onClick={signInWithGoogle} className="w-full h-11 text-sm font-semibold">
                    Sign in with Google to Accept
                  </Button>
                </div>
              ) : user.email?.toLowerCase() !== invitation.invitedEmail.toLowerCase() ? (
                /* Email Mismatch Warning */
                <div className="p-3 rounded bg-status-pending-bg/60 border border-status-pending-fg/30 text-xs space-y-2">
                  <p className="font-semibold text-status-pending-fg">Account Mismatch</p>
                  <p className="text-text-primary">
                    You are signed in as <strong>{user.email}</strong>, but this invite was issued to <strong>{invitation.invitedEmail}</strong>.
                  </p>
                  <Button variant="outline" size="sm" onClick={signInWithGoogle} className="w-full text-xs">
                    Switch to {invitation.invitedEmail}
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
                    "Accepting Tenancy..."
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

          <div className="pt-2 text-center">
            <Link href="/" className="text-xs text-text-muted hover:text-text-primary">
              ← Return to RentPilot Gateway
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
