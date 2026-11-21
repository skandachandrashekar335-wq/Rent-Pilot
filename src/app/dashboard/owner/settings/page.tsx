"use client";

import React from "react";
import { OwnerShell } from "@/components/layout/owner-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Building2, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { OWNER_ADMIN_EMAILS } from "@/lib/auth/admin-allowlist";
import { MfaSecurityCard } from "@/components/auth/mfa-security-card";

export default function OwnerSettingsPage() {
  const { user, activeOrganization } = useAuth();

  return (
    <OwnerShell>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
            Security & Account Settings
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Manage multi-factor authentication, administrative access controls, and organization credentials.
          </p>
        </div>

        {/* 1. Multi-Factor Authentication (MFA / 2FA) Card */}
        <MfaSecurityCard />

        {/* 2. Immutable Owner/Admin Access Allowlist */}
        <Card className="border-border">
          <CardHeader className="p-4 pb-3 border-b border-border/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">
                    Administrator Access Allowlist
                  </CardTitle>
                  <CardDescription className="text-xs text-text-muted mt-0.5">
                    Hard-locked, unbypassable email allowlist for the Owner Command Center.
                  </CardDescription>
                </div>
              </div>
              <Badge variant="paid" className="text-[11px] font-mono">
                ENFORCED (2 ADMINS)
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <p className="text-xs text-text-muted leading-relaxed">
              Only designated Google accounts can authenticate into the Owner Dashboard and call administrative APIs. All other accounts are strictly rejected with HTTP 403 Forbidden.
            </p>
            <div className="space-y-2">
              {OWNER_ADMIN_EMAILS.map((email) => {
                const isCurrent = user?.email?.toLowerCase() === email.toLowerCase();
                return (
                  <div
                    key={email}
                    className="flex items-center justify-between p-2.5 rounded-md border border-border/60 bg-surface text-xs font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      <span className="font-semibold text-text-primary">{email}</span>
                      {isCurrent && (
                        <Badge variant="outline" className="text-[10px] font-sans">
                          Current Session
                        </Badge>
                      )}
                    </div>
                    <Badge variant="paid" className="text-[10px]">
                      AUTHORIZED ADMIN
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 3. Organization Configuration */}
        <Card className="border-border">
          <CardHeader className="p-4 pb-3 border-b border-border/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-surface-muted text-primary flex items-center justify-center">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">
                    Organization Profile
                  </CardTitle>
                  <CardDescription className="text-xs text-text-muted mt-0.5">
                    Rental management business scope and billing cycle.
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-[11px] font-mono">
                {activeOrganization?.currency || "INR"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-border/40">
              <span className="text-text-muted">Organization Name:</span>
              <span className="font-semibold text-text-primary">
                {activeOrganization?.name || "Shekar Homes"}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border/40">
              <span className="text-text-muted">Standard Billing Day:</span>
              <span className="font-mono text-text-primary">
                Day {activeOrganization?.billing_day_of_month || 1} of each month
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border/40">
              <span className="text-text-muted">Timezone:</span>
              <span className="font-mono text-text-primary">
                {activeOrganization?.timezone || "Asia/Kolkata"}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-text-muted">Database Isolation:</span>
              <span className="font-mono text-emerald-600 font-semibold">
                Supabase RLS Protected
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </OwnerShell>
  );
}
