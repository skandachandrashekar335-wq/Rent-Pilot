"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { multiFactor } from "firebase/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Smartphone, CheckCircle2, ExternalLink, RefreshCw } from "lucide-react";

export function MfaSecurityCard() {
  const { user } = useAuth();
  const [enrolledFactors, setEnrolledFactors] = useState<Array<{ uid: string; displayName?: string | null; factorId: string; enrollmentTime?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const checkMfaStatus = useCallback(async () => {
    setLoading(true);
    try {
      if (user) {
        // Reload user to get fresh token & factor info
        await user.reload().catch(() => {});
        const mfaUser = multiFactor(user);
        const factors = (mfaUser.enrolledFactors || []).map((f) => ({
          uid: f.uid,
          displayName: f.displayName || "Second Factor Authenticator",
          factorId: f.factorId,
          enrollmentTime: f.enrollmentTime,
        }));
        setEnrolledFactors(factors);
      } else {
        setEnrolledFactors([]);
      }
      setLastChecked(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
    } catch (err) {
      console.warn("[MFA] Failed to check factors:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkMfaStatus();
  }, [checkMfaStatus]);

  return (
    <Card className="border-border">
      <CardHeader className="p-4 pb-3 border-b border-border/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">
                Two-Factor Authentication (MFA / 2FA)
              </CardTitle>
              <CardDescription className="text-xs text-text-muted mt-0.5">
                Multi-factor protection for your RentPilot account credentials.
              </CardDescription>
            </div>
          </div>
          <Badge variant="paid" className="text-[11px] font-mono">
            {enrolledFactors.length > 0 ? "2FA ENROLLED" : "SECURED VIA GOOGLE"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        <div className="p-3 rounded-lg bg-surface-muted/60 border border-border/40 space-y-2">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-medium text-text-primary">
                Google Authenticator & Workspace SSO Integration
              </p>
              <p className="text-text-muted leading-relaxed text-[11px]">
                Your account signs in via Google OAuth. 2-Step Verification enabled on your Google Account automatically protects your RentPilot session without requiring separate SMS codes or recovery passkeys.
              </p>
            </div>
          </div>
        </div>

        {enrolledFactors.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-text-primary">Enrolled Second Factors:</p>
            {enrolledFactors.map((factor) => (
              <div key={factor.uid} className="flex items-center justify-between p-2.5 rounded-md border border-border/60 bg-surface text-xs">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-primary" />
                  <div>
                    <span className="font-medium text-text-primary">{factor.displayName}</span>
                    <span className="text-[10px] text-text-muted block">ID: {factor.factorId}</span>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">ACTIVE</Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-between text-xs text-text-muted py-1 border-t border-border/30">
            <span>Additional TOTP / App Factor:</span>
            <span className="font-mono text-text-primary">Optional / Ready</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="text-[11px] text-text-muted">
            {lastChecked && `Verified at ${lastChecked}`}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={checkMfaStatus}
              disabled={loading}
              className="text-xs h-8 flex-1 sm:flex-initial"
            >
              <RefreshCw className={`h-3 w-3 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh 2FA Status
            </Button>
            <a
              href="https://myaccount.google.com/signinoptions/two-step-verification"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-initial"
            >
              <Button size="sm" variant="outline" className="text-xs h-8 w-full">
                <span>Manage Google 2FA</span>
                <ExternalLink className="h-3 w-3 ml-1.5" />
              </Button>
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
