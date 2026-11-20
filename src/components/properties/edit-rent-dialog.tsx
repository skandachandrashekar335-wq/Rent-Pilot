"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, AlertCircle, CheckCircle2, Pencil, X } from "lucide-react";
import { authFetch } from "@/lib/api-client";
import { formatINR } from "@/lib/utils";

interface EditRentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  unitId: string;
  unitNumber: string;
  propertyName: string;
  currentRentRupees: number;
  currentDepositRupees: number;
  isOccupied: boolean;
  tenantName?: string;
}

export function EditRentDialog({
  isOpen,
  onClose,
  onSuccess,
  unitId,
  unitNumber,
  propertyName,
  currentRentRupees,
  currentDepositRupees,
  isOccupied,
  tenantName,
}: EditRentDialogProps) {
  const [rentRupees, setRentRupees] = useState<number>(currentRentRupees || 0);
  const [depositRupees, setDepositRupees] = useState<number>(currentDepositRupees || 0);
  const [applyToActiveTenancy, setApplyToActiveTenancy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRentRupees(currentRentRupees || 0);
      setDepositRupees(currentDepositRupees || 0);
      setApplyToActiveTenancy(true);
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, currentRentRupees, currentDepositRupees]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitId) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await authFetch(`/api/units/${unitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseRentRupees: Number(rentRupees),
          securityDepositRupees: Number(depositRupees),
          applyToActiveTenancy: isOccupied ? applyToActiveTenancy : false,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update unit rent");
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 700);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update unit rent");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <Card className="max-w-md w-full border-border shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <CardHeader className="flex flex-row items-start justify-between pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Pencil className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                Edit Rent — {unitNumber}
              </CardTitle>
              <CardDescription className="text-xs text-text-muted mt-0.5">
                {propertyName} {isOccupied && tenantName ? `· Tenant: ${tenantName}` : "· Vacant"}
              </CardDescription>
            </div>
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
            <div className="p-3 rounded-lg bg-status-overdue-bg text-status-overdue-fg text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="py-6 text-center space-y-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <p className="text-sm font-semibold text-text-primary">Rent Updated Successfully</p>
              <p className="text-xs text-text-muted font-mono">{formatINR(rentRupees)} / month</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-text-primary flex items-center justify-between mb-1">
                  <span>Base Monthly Rent (₹)</span>
                  <span className="text-[11px] font-mono text-text-muted">
                    Current: {formatINR(currentRentRupees)}
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">₹</span>
                  <Input
                    type="number"
                    min={0}
                    step={100}
                    value={rentRupees || ""}
                    onChange={(e) => setRentRupees(Number(e.target.value))}
                    required
                    className="pl-7 font-mono text-sm"
                    placeholder="20000"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-text-primary flex items-center justify-between mb-1">
                  <span>Security Deposit (₹)</span>
                  <span className="text-[11px] font-mono text-text-muted">
                    Current: {formatINR(currentDepositRupees)}
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">₹</span>
                  <Input
                    type="number"
                    min={0}
                    step={500}
                    value={depositRupees || ""}
                    onChange={(e) => setDepositRupees(Number(e.target.value))}
                    className="pl-7 font-mono text-sm"
                    placeholder="100000"
                  />
                </div>
              </div>

              {isOccupied && (
                <div className="p-3 rounded-lg bg-surface-muted/70 border border-border/60 space-y-2">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyToActiveTenancy}
                      onChange={(e) => setApplyToActiveTenancy(e.target.checked)}
                      className="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4"
                    />
                    <div>
                      <span className="text-xs font-semibold text-text-primary block">
                        Update active tenant&apos;s lease contract
                      </span>
                      <span className="text-[11px] text-text-muted block mt-0.5 leading-relaxed">
                        Upcoming monthly billing cycles will immediately issue invoices at {formatINR(rentRupees || 0)}.
                      </span>
                    </div>
                  </label>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={submitting}
                  className="h-9 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !rentRupees}
                  className="h-9 text-xs font-semibold"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
