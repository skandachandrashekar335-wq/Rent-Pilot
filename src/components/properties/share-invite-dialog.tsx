"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Share2, Copy, Check, ExternalLink, X, AlertCircle, Loader2 } from "lucide-react";
import { authFetch } from "@/lib/api-client";

interface ShareInviteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  unitId: string;
  unitNumber: string;
  propertyName: string;
  tenantName: string;
  tenantEmail: string;
  isLinked: boolean;
}

export function ShareInviteDialog({
  isOpen,
  onClose,
  unitId,
  unitNumber,
  propertyName,
  tenantName,
  tenantEmail,
  isLinked,
}: ShareInviteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [inviteResult, setInviteResult] = useState<{
    inviteUrl: string;
    rawToken: string;
    emailSent: boolean;
    emailError?: string;
  } | null>(null);

  // Auto-generate fresh invite link when dialog opens
  useEffect(() => {
    if (isOpen && tenantEmail) {
      setLoading(true);
      setError(null);
      setInviteResult(null);

      authFetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invitedEmail: tenantEmail.trim().toLowerCase(),
          fullName: tenantName.trim() || undefined,
          unitId: unitId || undefined,
          expiresInDays: 7,
        }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "Failed to generate invitation link");
          }
          setInviteResult({
            inviteUrl: data.inviteUrl,
            rawToken: data.rawToken,
            emailSent: Boolean(data.emailSent),
            emailError: data.emailError,
          });
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Failed to generate invitation link");
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, tenantEmail, tenantName, unitId]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!inviteResult) return;
    navigator.clipboard.writeText(inviteResult.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const whatsappMessage = `Hello ${tenantName}! Here is your official RentPilot invitation to access your tenant portal, rental receipts, and invoices for ${unitNumber} at ${propertyName}: ${inviteResult?.inviteUrl || ""}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <Card className="max-w-md w-full border-border shadow-2xl">
        <CardHeader className="flex flex-row items-start justify-between pb-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Share2 className="h-5 w-5 text-primary" />
              <span>Tenant Portal Invitation</span>
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Invite or re-share portal credentials for <strong>Unit {unitNumber}</strong> ({propertyName}).
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-text-muted hover:text-text-primary -mr-2 -mt-2"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-status-overdue-bg text-status-overdue-fg text-xs font-medium flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3.5 rounded-lg bg-surface-muted border border-border/40 text-xs space-y-2">
            <div className="flex justify-between py-1 border-b border-border/30">
              <span className="text-text-muted">Tenant Name:</span>
              <span className="font-semibold text-text-primary">{tenantName}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/30">
              <span className="text-text-muted">Invited Email:</span>
              <span className="font-mono text-text-primary font-medium">{tenantEmail}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-text-muted">Account Status:</span>
              <Badge variant={isLinked ? "paid" : "pending"}>
                {isLinked ? "Account Active & Linked" : "Pending Acceptance"}
              </Badge>
            </div>
          </div>

          {loading ? (
            <div className="py-6 flex flex-col items-center justify-center gap-2 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs text-text-muted">Generating fresh invitation link & checking email delivery...</p>
            </div>
          ) : inviteResult ? (
            <div className="space-y-3.5">
              {inviteResult.emailSent ? (
                <div className="p-2.5 rounded bg-surface-muted border border-border/40 text-xs flex items-center gap-2 text-status-paid-fg">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>Invitation email dispatched to {tenantEmail} via Brevo.</span>
                </div>
              ) : (
                <div className="p-2.5 rounded bg-surface-muted border border-border/40 text-xs flex items-center gap-2 text-status-pending-fg">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Manual share required — copy the link or share via WhatsApp below.</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">
                  Tenant Portal Invitation Link
                </label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={inviteResult.inviteUrl}
                    className="font-mono text-xs bg-surface-muted select-all"
                  />
                  <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0 h-9 w-9">
                    {copied ? <Check className="h-4 w-4 text-status-paid-fg" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1"
                >
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Share via WhatsApp
                  </Button>
                </a>
                <Button size="sm" onClick={onClose} className="text-xs">
                  Done
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
