"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, X, AlertCircle, Loader2 } from "lucide-react";
import { formatINR } from "@/lib/utils";

interface ApplyIncrementDialogProps {
  isOpen: boolean;
  tenancyId: string;
  unitCode: string;
  tenantName: string;
  currentRentRupees: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function ApplyIncrementDialog({
  isOpen,
  tenancyId,
  unitCode,
  tenantName,
  currentRentRupees,
  onClose,
  onSuccess,
}: ApplyIncrementDialogProps) {
  const { user } = useAuth();
  const [percentRate, setPercentRate] = useState(5);
  const defaultCalculatedRent = Math.round(currentRentRupees * 1.05);
  const [newRentRupees, setNewRentRupees] = useState(defaultCalculatedRent);
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split("T")[0]!);
  const [notes, setNotes] = useState("Annual scheduled 5% lease escalation");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePercentChange = (rate: number) => {
    setPercentRate(rate);
    const calculated = Math.round(currentRentRupees * (1 + rate / 100));
    setNewRentRupees(calculated);
    setNotes(`Annual scheduled ${rate}% lease escalation`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!user) throw new Error("Authentication required");
      const token = await user.getIdToken();

      const res = await fetch(`/api/tenancies/${tenancyId}/increment`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          newRentRupees: Number(newRentRupees),
          effectiveDate,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to apply rent increment");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to apply increment");
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
              <TrendingUp className="h-5 w-5 text-primary" />
              <span>Apply Rent Increment — {unitCode}</span>
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Active Tenant: {tenantName} · Current: {formatINR(currentRentRupees)}/month
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
                Quick Escalation Percentage
              </label>
              <div className="flex gap-2">
                {[5, 6, 7.5, 10].map((rate) => (
                  <Button
                    key={rate}
                    type="button"
                    variant={percentRate === rate ? "primary" : "outline"}
                    size="sm"
                    onClick={() => handlePercentChange(rate)}
                    className="flex-1 text-xs"
                  >
                    +{rate}%
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">
                  New Monthly Rent (₹) <span className="text-status-overdue-fg">*</span>
                </label>
                <Input
                  type="number"
                  min={currentRentRupees}
                  step={1}
                  value={newRentRupees}
                  onChange={(e) => setNewRentRupees(Number(e.target.value))}
                  required
                  className="text-xs font-mono font-semibold text-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">
                  Effective Date <span className="text-status-overdue-fg">*</span>
                </label>
                <Input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  required
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div className="p-2.5 rounded bg-surface-muted border border-border text-xs flex justify-between items-center font-mono">
              <span className="text-text-muted">Difference:</span>
              <span className="font-semibold text-status-paid-fg">
                +{formatINR(newRentRupees - currentRentRupees)} / month
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">
                Escalation Notes
              </label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Applying...
                  </>
                ) : (
                  "Confirm Increment"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
