"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Loader2,
  Maximize2,
} from "lucide-react";
import { formatINR } from "@/lib/utils";
import { paiseToRupees } from "@/lib/domain/billing";
import { authFetch } from "@/lib/api-client";

export interface VerificationItem {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  tenantName: string;
  unitCode: string;
  propertyName: string;
  amountPaise: number;
  normalizedReference: string;
  submittedAt: string;
  storagePath: string;
}

interface SplitScreenVerificationDrawerProps {
  isOpen: boolean;
  item: VerificationItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function SplitScreenVerificationDrawer({
  isOpen,
  item,
  onClose,
  onSuccess,
}: SplitScreenVerificationDrawerProps) {
  const { user } = useAuth();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !item) {
      setSignedUrl(null);
      setRejectMode(false);
      setRejectionReason("");
      setError(null);
      return;
    }

    async function fetchSignedUrl() {
      setLoadingUrl(true);
      try {
        if (!user) return;
        const res = await authFetch(`/api/storage/receipts/${item!.id}/signed-url`);
        if (res.ok) {
          const data = await res.json();
          setSignedUrl(data.signedUrl);
        } else {
          setSignedUrl("/receipt-placeholder.png");
        }
      } catch {
        setSignedUrl("/receipt-placeholder.png");
      } finally {
        setLoadingUrl(false);
      }
    }

    fetchSignedUrl();
  }, [isOpen, item, user]);

  if (!isOpen || !item) return null;

  const handleApprove = async () => {
    setActionLoading(true);
    setError(null);
    try {
      if (!user) throw new Error("Authentication required");

      const res = await authFetch(`/api/payments/submissions/${item.id}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "APPROVE" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approval failed");

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    try {
      if (!user) throw new Error("Authentication required");

      const res = await authFetch(`/api/payments/submissions/${item.id}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "REJECT",
          rejectionReason: rejectionReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rejection failed");

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Rejection failed");
    } finally {
      setActionLoading(false);
    }
  };

  const amountRupees = paiseToRupees(item.amountPaise);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-2 sm:p-4">
      <div className="max-w-5xl w-full bg-surface border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="h-14 border-b border-border px-4 sm:px-6 flex items-center justify-between bg-surface-muted/40">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-sm font-semibold text-text-primary">
                Payment Verification: {item.unitCode} ({item.propertyName})
              </h2>
              <p className="text-[11px] text-text-muted">
                Invoice: {item.invoiceNumber} · Submitted {item.submittedAt}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-text-muted hover:text-text-primary">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {error && (
          <div className="mx-4 mt-3 p-3 rounded-md bg-status-overdue-bg text-status-overdue-fg text-xs font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Split Screen Body */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-y-auto min-h-0">
          {/* Left Column: Receipt Screenshot Viewer */}
          <div className="p-4 border-b md:border-b-0 md:border-r border-border bg-surface-muted/30 flex flex-col items-center justify-center min-h-[300px]">
            <div className="w-full flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono text-text-muted uppercase tracking-wider">
                Submitted Receipt Screenshot (Private)
              </span>
              {signedUrl && signedUrl !== "/receipt-placeholder.png" && (
                <a href={signedUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span>Open Full Image</span>
                </a>
              )}
            </div>

            <div className="w-full flex-1 rounded-lg border border-border bg-background flex items-center justify-center p-2 overflow-hidden shadow-inner">
              {loadingUrl ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs text-text-muted font-mono">Generating 15-minute signed token...</span>
                </div>
              ) : signedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={signedUrl}
                  alt="Tenant UPI Payment Receipt"
                  className="max-h-[380px] w-auto max-w-full object-contain rounded"
                />
              ) : (
                <div className="text-xs text-text-muted italic">Receipt preview unavailable</div>
              )}
            </div>
            <p className="text-[10px] text-text-muted mt-2 text-center">
              Private Supabase Storage with cryptographic 900-second token access.
            </p>
          </div>

          {/* Right Column: Transaction Comparison & Controls */}
          <div className="p-4 sm:p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div>
                <span className="text-xs text-text-muted uppercase font-mono">Claimed Amount</span>
                <div className="text-3xl font-mono font-bold text-text-primary mt-1">
                  {formatINR(amountRupees)}
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-text-muted">Tenant Name:</span>
                  <span className="font-semibold text-text-primary">{item.tenantName}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-text-muted">Rental Unit:</span>
                  <span className="font-medium text-text-primary">{item.unitCode} — {item.propertyName}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-text-muted">Normalized UTR / Reference:</span>
                  <span className="font-mono font-bold text-primary text-sm tracking-wide bg-surface-muted px-2 py-0.5 rounded">
                    {item.normalizedReference}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/50">
                  <span className="text-text-muted">Payment Method:</span>
                  <Badge variant="paid" className="text-[10px]">UPI Transfer</Badge>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-surface-muted/60 border border-border text-[11px] text-text-muted space-y-1">
                <p>• Cross-check the 12-digit UTR in the left screenshot against your UPI banking statement.</p>
                <p>• Approving immediately creates an immutable transaction in the ledger, recalculates invoice balance, and emails a verified receipt to {item.tenantName}.</p>
              </div>

              {rejectMode && (
                <form onSubmit={handleReject} className="space-y-2.5 pt-2 border-t border-border animate-in fade-in">
                  <label className="block text-xs font-semibold text-status-overdue-fg">
                    Reason for Rejection <span className="text-destructive">*</span>
                  </label>
                  <Input
                    placeholder="e.g. UTR not found in bank statement / Amount mismatch"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    required
                    className="text-xs"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" size="sm" onClick={() => setRejectMode(false)} disabled={actionLoading}>
                      Cancel
                    </Button>
                    <Button type="submit" variant="destructive" size="sm" disabled={actionLoading || rejectionReason.length < 3}>
                      {actionLoading ? "Rejecting..." : "Confirm Rejection"}
                    </Button>
                  </div>
                </form>
              )}
            </div>

            {/* Bottom Actions */}
            {!rejectMode && (
              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setRejectMode(true)}
                  disabled={actionLoading}
                  className="text-status-overdue-fg hover:text-status-overdue-fg hover:bg-status-overdue-bg text-xs"
                >
                  Reject with Reason
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="bg-status-paid-fg hover:bg-status-paid-fg/90 text-white font-semibold text-xs flex items-center gap-1.5"
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  <span>Approve & Issue Receipt</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
