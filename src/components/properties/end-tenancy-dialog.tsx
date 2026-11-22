"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LogOut, X, AlertCircle, Loader2 } from "lucide-react";
import { authFetch } from "@/lib/api-client";
import { invalidateCachePrefix } from "@/lib/cache/memory-query-cache";

interface EndTenancyDialogProps {
  isOpen: boolean;
  tenancyId: string;
  unitCode: string;
  tenantName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function EndTenancyDialog({
  isOpen,
  tenancyId,
  unitCode,
  tenantName,
  onClose,
  onSuccess,
}: EndTenancyDialogProps) {
  const { user } = useAuth();
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]!);
  const [status, setStatus] = useState<"COMPLETED" | "TERMINATED">("COMPLETED");
  const [terminationReason, setTerminationReason] = useState("Lease completed as agreed");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!user) throw new Error("Authentication required");

      const res = await authFetch(`/api/tenancies/${tenancyId}/end`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          endDate,
          status,
          terminationReason: terminationReason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to end tenancy");
      }

      invalidateCachePrefix("/api/properties");
      invalidateCachePrefix("/api/properties-view");
      invalidateCachePrefix("/api/tenancies");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to end tenancy");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <Card className="max-w-md w-full border-border shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <CardHeader className="flex flex-row items-start justify-between pb-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <LogOut className="h-5 w-5 text-status-overdue-fg" />
              <span>Conclude Tenancy — {unitCode}</span>
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Tenant: {tenantName} · Mark unit as vacant while preserving historical invoices and payment logs.
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

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">
                Termination Type
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "COMPLETED" | "TERMINATED")}
                className="w-full h-9 rounded-md border border-input bg-surface px-3 py-1 text-xs text-text-primary shadow-xs"
              >
                <option value="COMPLETED">Completed (Natural Lease Expiry / Mutual Agreement)</option>
                <option value="TERMINATED">Terminated (Early Move-Out or Landlord Notice)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">
                Move-Out / Vacating Date <span className="text-status-overdue-fg">*</span>
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">
                Reason / Remarks
              </label>
              <Input
                value={terminationReason}
                onChange={(e) => setTerminationReason(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="p-3 rounded-md bg-surface-muted border border-border/40 text-[11px] text-text-muted">
              Note: Historical billing statements, verified payment submissions, and audit records will remain preserved in accordance with financial regulations.
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" size="sm" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Concluding...
                  </>
                ) : (
                  "Conclude Tenancy"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
