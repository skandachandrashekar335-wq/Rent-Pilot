"use client";

import React from "react";
import { TenantShell } from "@/components/layout/tenant-shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, CheckCircle2 } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { useTranslation } from "@/components/layout/locale-context";

const pastInvoices = [
  {
    id: "inv-oct-26",
    month: "October 2026",
    amount: 18200,
    paidAt: "12 Oct 2026",
    reference: "UPI/429810984120",
    status: "PAID",
  },
  {
    id: "inv-sep-26",
    month: "September 2026",
    amount: 16000,
    paidAt: "14 Sep 2026",
    reference: "UPI/426710492811",
    status: "PAID",
  },
  {
    id: "inv-aug-26",
    month: "August 2026",
    amount: 16000,
    paidAt: "11 Aug 2026",
    reference: "CASH / Direct Receipt #419",
    status: "PAID",
  },
];

export default function TenantHistoryPage() {
  const { t } = useTranslation();

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

        <div className="space-y-3">
          {pastInvoices.map((inv) => (
            <Card key={inv.id}>
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-text-primary">
                    {inv.month}
                  </span>
                  <p className="font-mono text-sm font-bold text-text-primary mt-0.5">
                    {formatINR(inv.amount)}
                  </p>
                </div>
                <Badge variant="paid">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              </CardHeader>
              <CardContent className="p-4 pt-1 flex items-center justify-between text-xs text-text-muted">
                <div>
                  <p className="font-mono text-[11px]">{inv.reference}</p>
                  <p className="text-[10px]">Settled on {inv.paidAt}</p>
                </div>
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Receipt
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </TenantShell>
  );
}
