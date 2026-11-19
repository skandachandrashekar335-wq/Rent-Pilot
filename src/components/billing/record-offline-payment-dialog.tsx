"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DollarSign, X, AlertCircle, Loader2 } from "lucide-react";
import { formatINR, isValidUuid } from "@/lib/utils";
import { authFetch } from "@/lib/api-client";

interface InvoiceOption {
  id: string;
  invoiceNumber: string;
  unitCode: string;
  tenantName: string;
  balanceDueRupees: number;
}

interface RecordOfflinePaymentDialogProps {
  isOpen: boolean;
  invoices: InvoiceOption[];
  preSelectedInvoiceId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function RecordOfflinePaymentDialog({
  isOpen,
  invoices,
  preSelectedInvoiceId,
  onClose,
  onSuccess,
}: RecordOfflinePaymentDialogProps) {
  const { user, activeOrganization } = useAuth();
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(preSelectedInvoiceId || invoices[0]?.id || "");
  const [amountRupees, setAmountRupees] = useState<number>(invoices[0]?.balanceDueRupees || 18500);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CHEQUE" | "BANK_TRANSFER">("CASH");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]!);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      const activeInv = invoices.find((i) => i.id === (preSelectedInvoiceId || invoices[0]?.id));
      if (activeInv) {
        setSelectedInvoiceId(activeInv.id);
        setAmountRupees(activeInv.balanceDueRupees);
      }
    }
  }, [isOpen, preSelectedInvoiceId, invoices]);

  if (!isOpen) return null;

  const currentInvoice = invoices.find((inv) => inv.id === selectedInvoiceId);

  const handleInvoiceChange = (id: string) => {
    setSelectedInvoiceId(id);
    const inv = invoices.find((i) => i.id === id);
    if (inv) {
      setAmountRupees(inv.balanceDueRupees);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!user) throw new Error("Authentication required");

      const res = await authFetch("/api/payments/offline", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organizationId: isValidUuid(activeOrganization?.id) ? activeOrganization?.id : undefined,
          invoiceId: selectedInvoiceId,
          amountRupees: Number(amountRupees),
          paymentMethod,
          paymentDate,
          referenceNumber: referenceNumber.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record payment");

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to record payment");
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
              <DollarSign className="h-5 w-5 text-primary" />
              <span>Record Offline Payment</span>
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Record cash, cheque, or direct NEFT/RTGS payments into the verified ledger.
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-text-muted hover:text-text-primary -mr-2 -mt-2">
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
                Target Invoice <span className="text-status-overdue-fg">*</span>
              </label>
              <select
                value={selectedInvoiceId}
                onChange={(e) => handleInvoiceChange(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-surface px-2.5 py-1 text-xs text-text-primary shadow-xs"
                required
              >
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.unitCode} ({inv.tenantName}) — {inv.invoiceNumber} (Bal: {formatINR(inv.balanceDueRupees)})
                  </option>
                ))}
              </select>
              {currentInvoice && (
                <p className="text-[11px] text-text-muted mt-1">
                  Unit {currentInvoice.unitCode} · Outstanding Balance: <span className="font-semibold text-text-primary">{formatINR(currentInvoice.balanceDueRupees)}</span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">
                  Amount Received (₹) <span className="text-status-overdue-fg">*</span>
                </label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(Number(e.target.value))}
                  required
                  className="text-xs font-mono font-bold text-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as "CASH" | "CHEQUE" | "BANK_TRANSFER")}
                  className="w-full h-9 rounded-md border border-input bg-surface px-2.5 py-1 text-xs text-text-primary shadow-xs"
                >
                  <option value="CASH">Cash in Hand</option>
                  <option value="BANK_TRANSFER">Direct Bank Transfer / NEFT</option>
                  <option value="CHEQUE">Bank Cheque</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">
                  Payment Date <span className="text-status-overdue-fg">*</span>
                </label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                  className="text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">
                  Cheque / NEFT Reference
                </label>
                <Input
                  placeholder="e.g. CHQ-481920 or UTR"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-text-primary mb-1">
                Internal Remarks (Optional)
              </label>
              <Input
                placeholder="Handed over in person / Bank branch credit"
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
                    Recording...
                  </>
                ) : (
                  "Record Verified Payment"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
