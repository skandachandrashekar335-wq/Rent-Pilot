"use client";

import React, { useState, useEffect } from "react";
import { TenantShell } from "@/components/layout/tenant-shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { useTranslation } from "@/components/layout/locale-context";
import { useAuth } from "@/lib/auth/auth-context";
import { paiseToRupees } from "@/lib/domain/billing";
import { authFetch } from "@/lib/api-client";

interface HistoryPayment {
  id: string;
  amount_paise: number;
  payment_date: string;
  normalized_reference: string | null;
  receipt_number: string;
  payment_method: string;
}

interface HistoryInvoice {
  billing_period_month: number;
  billing_period_year: number;
  payments?: HistoryPayment[] | null;
}

interface HistoryRecord {
  id: string;
  month: string;
  amountRupees: number;
  paidAt: string;
  reference: string;
  receiptNumber: string;
  method: string;
  status: string;
}

export default function TenantHistoryPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      try {
        if (!user) {
          setHistoryRecords([]);
          setLoading(false);
          return;
        }

        const res = await authFetch("/api/invoices");

        if (res.ok) {
          const data = await res.json();
          const records: HistoryRecord[] = [];

          const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

          const rawInvoices = (data.invoices || []) as HistoryInvoice[];
          rawInvoices.forEach((inv) => {
            const monthLabel = `${monthNames[inv.billing_period_month - 1]} ${inv.billing_period_year}`;

            (inv.payments || []).forEach((p) => {
              records.push({
                id: p.id,
                month: monthLabel,
                amountRupees: paiseToRupees(p.amount_paise),
                paidAt: new Date(p.payment_date).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                }),
                reference: p.normalized_reference || "Direct / Bank Transfer",
                receiptNumber: p.receipt_number,
                method: p.payment_method,
                status: "VERIFIED",
              });
            });
          });

          setHistoryRecords(records);
        } else {
          setHistoryRecords([]);
        }
      } catch (err) {
        console.warn("[Portal History] Fetch error:", err);
        setHistoryRecords([]);
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, [user]);

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <TenantShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">
            {t("common.history")} & Receipts
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Verified monthly rental invoices and verified payment confirmations.
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-text-muted">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
            Loading payment history...
          </div>
        ) : historyRecords.length === 0 ? (
          <Card className="p-8 text-center text-xs text-text-muted">
            No payment history found yet.
          </Card>
        ) : (
          <div className="space-y-3">
            {historyRecords.map((inv) => (
              <Card key={inv.id} className="overflow-hidden">
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between bg-surface-muted/30">
                  <div>
                    <span className="text-xs font-semibold text-text-primary">
                      {inv.month}
                    </span>
                    <span className="text-[11px] text-text-muted ml-2 font-mono">
                      {inv.receiptNumber}
                    </span>
                  </div>
                  <Badge variant="paid" className="text-[11px]">
                    🟢 {inv.status}
                  </Badge>
                </CardHeader>
                <CardContent className="p-4 pt-3 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-lg font-mono font-bold text-text-primary">
                      {formatINR(inv.amountRupees)}
                    </div>
                    <div className="text-xs text-text-muted">
                      Paid on {inv.paidAt} · {inv.method}
                    </div>
                    <div className="text-[11px] text-text-muted font-mono">
                      Ref: {inv.reference}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePrintReceipt()}
                    className="h-8 text-xs flex items-center gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Receipt</span>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </TenantShell>
  );
}
