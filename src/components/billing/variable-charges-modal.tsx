"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Zap, X, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { authFetch } from "@/lib/api-client";

interface BillingUnitRow {
  tenancyId: string;
  unitCode: string;
  propertyName: string;
  tenantName: string;
  monthlyRentRupees: number;
  electricityRupees: number;
  waterRupees: number;
  maintenanceRupees: number;
  otherChargesRupees: number;
  creditsRupees: number;
  dueDate: string;
  status: string;
}

interface VariableChargesModalProps {
  isOpen: boolean;
  billingYear: number;
  billingMonth: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function VariableChargesModal({
  isOpen,
  billingYear,
  billingMonth,
  onClose,
  onSuccess,
}: VariableChargesModalProps) {
  const { user } = useAuth();
  const [rows, setRows] = useState<BillingUnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const currentMonthName = monthNames[billingMonth - 1] || "Month";

  useEffect(() => {
    if (!isOpen) return;

    async function loadBatchData() {
      setLoading(true);
      setError(null);
      try {
        if (!user) {
          setRows([]);
          setLoading(false);
          return;
        }
        const res = await authFetch(`/api/billing/batch?year=${billingYear}&month=${billingMonth}`);

        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          throw new Error(errJson?.error || "Failed to load billing batch");
        }

        const data = await res.json();
        setRows(data.units || []);
      } catch (err: unknown) {
        console.warn("[Billing Batch] Fetch error:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    }

    loadBatchData();
  }, [isOpen, billingYear, billingMonth, user]);

  if (!isOpen) return null;

  const handleChargeChange = (
    index: number,
    field: "electricityRupees" | "waterRupees" | "maintenanceRupees" | "otherChargesRupees" | "creditsRupees",
    value: number
  ) => {
    const updated = [...rows];
    updated[index] = { ...updated[index]!, [field]: value };
    setRows(updated);
  };

  const handleSaveBatch = async (finalizeAndIssue: boolean) => {
    setSaving(true);
    setError(null);

    try {
      if (!user) throw new Error("Authentication required");

      const payload = {
        billingYear,
        billingMonth,
        finalizeAndIssue,
        items: rows.map((r) => ({
          tenancyId: r.tenancyId,
          electricityRupees: Number(r.electricityRupees || 0),
          waterRupees: Number(r.waterRupees || 0),
          maintenanceRupees: Number(r.maintenanceRupees || 0),
          otherChargesRupees: Number(r.otherChargesRupees || 0),
          creditsRupees: Number(r.creditsRupees || 0),
          dueDate: r.dueDate,
        })),
      };

      const res = await authFetch("/api/billing/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process billing batch");

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save charges");
    } finally {
      setSaving(false);
    }
  };

  const totalBatchRupees = rows.reduce((sum, r) => {
    return (
      sum +
      r.monthlyRentRupees +
      Number(r.electricityRupees || 0) +
      Number(r.waterRupees || 0) +
      Number(r.maintenanceRupees || 0) +
      Number(r.otherChargesRupees || 0) -
      Number(r.creditsRupees || 0)
    );
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-2 sm:p-4">
      <Card className="max-w-5xl w-full border-border shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[92dvh] flex flex-col">
        <CardHeader className="flex flex-row items-start justify-between pb-3 border-b border-border bg-surface-muted/30">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <span>Enter Variable Utility Charges — {currentMonthName} {billingYear}</span>
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Enter flat pre-calculated monthly utility amounts across units. Invoices are issued against tenancy agreements.
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-text-muted hover:text-text-primary -mr-2 -mt-2">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="p-0 flex-1 overflow-y-auto">
          {error && (
            <div className="m-4 p-3 rounded-md bg-status-overdue-bg text-status-overdue-fg text-xs font-medium flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
              <p className="text-xs text-text-muted font-mono">Loading tenancy list for {currentMonthName} {billingYear}...</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-xs text-text-muted">
              No active tenancies found for this billing cycle.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Unit & Tenant</TableHead>
                    <TableHead className="text-right w-[110px]">Base Rent (₹)</TableHead>
                    <TableHead className="text-right w-[120px]">Electricity (₹)</TableHead>
                    <TableHead className="text-right w-[110px]">Water (₹)</TableHead>
                    <TableHead className="text-right w-[110px]">Maintenance (₹)</TableHead>
                    <TableHead className="text-right w-[110px]">Credits (₹)</TableHead>
                    <TableHead className="text-right w-[130px]">Total Invoice (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => {
                    const rowTotal =
                      row.monthlyRentRupees +
                      Number(row.electricityRupees || 0) +
                      Number(row.waterRupees || 0) +
                      Number(row.maintenanceRupees || 0) +
                      Number(row.otherChargesRupees || 0) -
                      Number(row.creditsRupees || 0);

                    return (
                      <TableRow key={row.tenancyId}>
                        <TableCell>
                          <div className="font-semibold text-xs text-text-primary">
                            {row.unitCode} ({row.propertyName})
                          </div>
                          <div className="text-[11px] text-text-muted">{row.tenantName}</div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium text-xs text-text-primary">
                          {formatINR(row.monthlyRentRupees)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={row.electricityRupees}
                            onChange={(e) => handleChargeChange(idx, "electricityRupees", Number(e.target.value))}
                            className="h-8 text-xs font-mono text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={row.waterRupees}
                            onChange={(e) => handleChargeChange(idx, "waterRupees", Number(e.target.value))}
                            className="h-8 text-xs font-mono text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={row.maintenanceRupees}
                            onChange={(e) => handleChargeChange(idx, "maintenanceRupees", Number(e.target.value))}
                            className="h-8 text-xs font-mono text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={row.creditsRupees}
                            onChange={(e) => handleChargeChange(idx, "creditsRupees", Number(e.target.value))}
                            className="h-8 text-xs font-mono text-right text-status-paid-fg"
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-sm text-text-primary">
                          {formatINR(rowTotal)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>

        {/* Footer Summary & Action Controls */}
        <div className="p-4 border-t border-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs">
            <span className="text-text-muted">Total Batch Expected: </span>
            <span className="font-mono font-bold text-base text-text-primary">
              {formatINR(totalBatchRupees)}
            </span>
            <span className="text-text-muted ml-2">({rows.length} Units)</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSaveBatch(false)}
              disabled={saving || rows.length === 0}
            >
              Save Draft
            </Button>
            <Button
              size="sm"
              onClick={() => handleSaveBatch(true)}
              disabled={saving || rows.length === 0}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              <span>⚡ Finalize & Issue All Invoices</span>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
