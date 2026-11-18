"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UserPlus, Copy, Check, ExternalLink, X, AlertCircle, Loader2 } from "lucide-react";
import { isValidUuid } from "@/lib/utils";

interface InviteTenantDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InviteTenantDialog({ isOpen, onClose }: InviteTenantDialogProps) {
  const { user, activeOrganization } = useAuth();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [unitId, setUnitId] = useState("mock-unit-101");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedInvite, setGeneratedInvite] = useState<{
    token: string;
    inviteUrl: string;
    expiresAt: string;
    email: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!user) {
        throw new Error("You must be authenticated to issue tenant invitations.");
      }

      const token = await user.getIdToken();
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organizationId: isValidUuid(activeOrganization?.id) ? activeOrganization?.id : undefined,
          email: email.trim().toLowerCase(),
          fullName: fullName.trim() || undefined,
          phone: phone.trim() || undefined,
          unitId: unitId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create invitation");
      }

      const inviteUrl = `${window.location.origin}/invite/${data.invitation.token}`;
      setGeneratedInvite({
        token: data.invitation.token,
        inviteUrl,
        expiresAt: data.invitation.expires_at,
        email: data.invitation.email,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate invitation");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!generatedInvite) return;
    navigator.clipboard.writeText(generatedInvite.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setGeneratedInvite(null);
    setEmail("");
    setFullName("");
    setPhone("");
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <Card className="max-w-md w-full border-border shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <CardHeader className="flex flex-row items-start justify-between pb-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              <span>Invite New Tenant</span>
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Issue a cryptographically signed onboarding invitation bound to the tenant&apos;s email.
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

          {!generatedInvite ? (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">
                  Tenant Email Address <span className="text-status-overdue-fg">*</span>
                </label>
                <Input
                  type="email"
                  placeholder="tenant@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="text-xs"
                />
                <p className="text-[11px] text-text-muted mt-1">
                  Tenant must sign in with this exact Google account email to redeem.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">
                  Full Name (Optional)
                </label>
                <Input
                  placeholder="e.g. Rahul Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">
                  Phone Number (Optional)
                </label>
                <Input
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">
                  Assigned Unit
                </label>
                <select
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-surface px-3 py-1 text-xs text-text-primary shadow-xs focus-visible:outline-xs focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="mock-unit-101">Unit 101 — Green Villa (1st Floor)</option>
                  <option value="mock-unit-102">Unit 102 — Green Villa (1st Floor)</option>
                  <option value="mock-unit-201">Unit 201 — Green Villa (2nd Floor)</option>
                  <option value="mock-unit-01">Unit 01 — Lakeview House (Ground)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Generating...
                    </>
                  ) : (
                    "Generate Invitation"
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 pt-1">
              <div className="p-3 rounded-md bg-status-paid-bg border border-status-paid-fg/20 text-xs text-status-paid-fg font-medium">
                Invitation created successfully for <strong>{generatedInvite.email}</strong>.
              </div>

              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">
                  Sharable Invitation Link (Valid for 7 days)
                </label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={generatedInvite.inviteUrl}
                    className="font-mono text-xs bg-surface-muted select-all"
                  />
                  <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0 h-9 w-9">
                    {copied ? <Check className="h-4 w-4 text-status-paid-fg" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Hello! Here is your official RentPilot invitation to join your rental unit: ${generatedInvite.inviteUrl}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1"
                >
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Share via WhatsApp
                  </Button>
                </a>
                <Button variant="outline" size="sm" onClick={handleReset} className="text-xs">
                  Invite Another
                </Button>
              </div>

              <div className="text-right pt-2 border-t border-border">
                <Button size="sm" onClick={onClose}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
