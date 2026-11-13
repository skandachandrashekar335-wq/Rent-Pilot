"use client";

import React, { useState } from "react";
import Link from "next/link";
import { OwnerShell } from "@/components/layout/owner-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, CheckCircle2, Clock, Eye, ShieldCheck, X } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { useTranslation } from "@/components/layout/locale-context";

interface PendingVerification {
  id: string;
  invoiceId: string;
  tenantName: string;
  unitCode: string;
  propertyName: string;
  amount: number;
  referenceNumber: string;
  submittedAt: string;
  receiptUrl: string;
}

const mockVerifications: PendingVerification[] = [
  {
    id: "pv-1",
    invoiceId: "INV-2026-11-201",
    tenantName: "Rahul Sharma",
    unitCode: "U-201",
    propertyName: "Green Villa",
    amount: 18500,
    referenceNumber: "431289012389",
    submittedAt: "Today 14:20 IST",
    receiptUrl: "/receipt-placeholder.png",
  },
  {
    id: "pv-2",
    invoiceId: "INV-2026-11-101",
    tenantName: "Amit Patel",
    unitCode: "U-01",
    propertyName: "Lakeview House",
    amount: 22000,
    referenceNumber: "431290458122",
    submittedAt: "Yesterday 18:45 IST",
    receiptUrl: "/receipt-placeholder.png",
  },
];

export default function OwnerOverviewPage() {
  const { t } = useTranslation();
  const [selectedVerification, setSelectedVerification] = useState<PendingVerification | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const handleApprove = (id: string) => {
    setActionSuccess(`Payment ${id} verified successfully.`);
    setTimeout(() => {
      setSelectedVerification(null);
      setActionSuccess(null);
    }, 1500);
  };

  return (
    <OwnerShell>
      <div className="space-y-6">
        {/* Page Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
              {t("owner.actionCenter")}
            </h1>
            <p className="text-sm text-text-muted mt-1">
              Financial overview and active operational tasks for November 2026.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/dashboard/owner/billing">
              <Button variant="outline" size="sm">
                {t("owner.recordOfflinePayment")}
              </Button>
            </Link>
            <Link href="/dashboard/owner/billing">
              <Button size="sm">
                {t("owner.enterUtilityCharges")}
              </Button>
            </Link>
          </div>
        </div>

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                {t("owner.totalBilled")}
              </span>
              <CardTitle className="text-2xl font-mono font-semibold text-text-primary">
                {formatINR(125000)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-text-muted">
                November billing cycle · 6 active units
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                {t("owner.collected")}
              </span>
              <CardTitle className="text-2xl font-mono font-semibold text-status-paid-fg">
                {formatINR(95000)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1.5 text-xs text-text-muted">
                <span className="font-medium text-status-paid-fg">76%</span> of billed total settled
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                {t("owner.pendingVerification")}
              </span>
              <CardTitle className="text-2xl font-mono font-semibold text-status-pending-fg">
                {formatINR(22500)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1.5 text-xs text-status-pending-fg font-medium">
                <Clock className="h-3.5 w-3.5" />
                <span>2 receipts awaiting verification</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Priority Action Required Alert Banner */}
        <div className="rounded-lg border border-status-pending-fg/30 bg-status-pending-bg/50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-status-pending-fg shrink-0 mt-0.5" />
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-text-primary">
                {t("owner.urgentActions")}
              </h2>
              <ul className="mt-2 space-y-1.5 text-xs text-text-primary">
                <li className="flex items-center justify-between">
                  <span>
                    • <strong>2 Units Missing Variable Charges:</strong> House 2 (Unit 102), House 4 (Unit 201)
                  </span>
                  <Link href="/dashboard/owner/billing" className="text-primary font-medium hover:underline ml-2">
                    Enter Charges →
                  </Link>
                </li>
                <li className="flex items-center justify-between">
                  <span>
                    • <strong>2 Pending UPI Verifications:</strong> ₹22,500 submitted by tenants
                  </span>
                  <button
                    onClick={() => setSelectedVerification(mockVerifications[0])}
                    className="text-primary font-medium hover:underline ml-2"
                  >
                    Open Review Drawer →
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Pending Verification Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                {t("owner.recentActivity")}
              </CardTitle>
              <p className="text-xs text-text-muted mt-0.5">
                Every verification action requires inspecting the signed receipt in the split drawer.
              </p>
            </div>
            <Badge variant="pending">2 Pending</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("owner.tenantName")}</TableHead>
                  <TableHead>{t("owner.unitNumber")}</TableHead>
                  <TableHead>{t("owner.amount")}</TableHead>
                  <TableHead>{t("owner.reference")}</TableHead>
                  <TableHead>{t("owner.submittedAt")}</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockVerifications.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-text-primary">
                      {item.tenantName}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-mono bg-surface-muted px-2 py-0.5 rounded border border-border/40">
                        {item.propertyName} · {item.unitCode}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono font-semibold">
                      {formatINR(item.amount)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-text-muted">
                      {item.referenceNumber}
                    </TableCell>
                    <TableCell className="text-xs text-text-muted">
                      {item.submittedAt}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelectedVerification(item)}
                        className="text-xs font-medium"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1 text-text-muted" />
                        {t("common.review")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Split-Screen Verification Drawer */}
      {selectedVerification && (
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-end">
          <div className="w-full max-w-2xl bg-surface h-full shadow-xl flex flex-col border-l border-border animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-surface-muted/50">
              <div>
                <span className="text-xs font-mono text-text-muted uppercase">
                  {selectedVerification.invoiceId}
                </span>
                <h3 className="text-base font-semibold text-text-primary">
                  Verify UPI Payment — {selectedVerification.tenantName}
                </h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedVerification(null)}
                aria-label="Close drawer"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Drawer Body: Two-Column Split View */}
            <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Left Column: Signed Receipt Viewport */}
              <div className="flex flex-col space-y-3">
                <span className="text-xs font-medium text-text-muted uppercase">
                  Uploaded Payment Screenshot
                </span>
                <div className="border border-border rounded-lg bg-surface-muted p-4 flex flex-col items-center justify-center min-h-[260px] text-center">
                  <div className="border-2 border-dashed border-border rounded p-6 w-full flex flex-col items-center">
                    <span className="font-mono text-xs text-text-muted font-semibold">
                      [UPI PAYMENT RECEIPT]
                    </span>
                    <p className="text-xs text-text-primary mt-2">
                      Paid to: Skanda Chandrashekar
                    </p>
                    <p className="text-sm font-mono font-semibold text-status-paid-fg mt-1">
                      {formatINR(selectedVerification.amount)}
                    </p>
                    <p className="text-[11px] font-mono text-text-muted mt-2">
                      Ref: {selectedVerification.referenceNumber}
                    </p>
                    <p className="text-[10px] text-text-muted/60 mt-1">
                      {selectedVerification.submittedAt}
                    </p>
                  </div>
                  <span className="text-[11px] text-text-muted mt-3">
                    Storage: Private bucket · 15-minute signed URL
                  </span>
                </div>
              </div>

              {/* Right Column: Ledger Verification & Deduplication */}
              <div className="flex flex-col space-y-4">
                <span className="text-xs font-medium text-text-muted uppercase">
                  Ledger Details
                </span>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-text-muted">Property & Unit:</span>
                    <span className="font-medium text-text-primary">
                      {selectedVerification.propertyName} · {selectedVerification.unitCode}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-text-muted">Total Bill Due:</span>
                    <span className="font-mono font-semibold text-text-primary">
                      {formatINR(selectedVerification.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/40">
                    <span className="text-text-muted">Claimed Paid:</span>
                    <span className="font-mono font-semibold text-status-paid-fg">
                      {formatINR(selectedVerification.amount)}
                    </span>
                  </div>
                </div>

                {/* Database Deduplication Check Badge */}
                <div className="p-3 rounded-md bg-status-paid-bg/70 border border-status-paid-fg/20 flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 text-status-paid-fg shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-semibold text-status-paid-fg">
                      Database Check: Unique Reference
                    </span>
                    <p className="text-text-muted mt-0.5">
                      No matching verified or pending payments exist with reference{" "}
                      <code className="font-mono text-[11px]">{selectedVerification.referenceNumber}</code>.
                    </p>
                  </div>
                </div>

                {actionSuccess ? (
                  <div className="p-3 rounded bg-status-paid-bg text-status-paid-fg text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{actionSuccess}</span>
                  </div>
                ) : (
                  <div className="space-y-2 pt-2">
                    <Button
                      onClick={() => handleApprove(selectedVerification.id)}
                      className="w-full bg-status-paid-fg hover:bg-status-paid-fg/90 text-white"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Approve & Issue Receipt
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" className="text-xs">
                        Record Partial
                      </Button>
                      <Button variant="destructive" size="sm" className="text-xs">
                        Reject with Reason
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </OwnerShell>
  );
}
