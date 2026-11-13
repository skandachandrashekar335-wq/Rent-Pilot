"use client";

import React, { useState } from "react";
import { OwnerShell } from "@/components/layout/owner-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet, CheckCircle2, Zap, DollarSign, X } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { useTranslation } from "@/components/layout/locale-context";

interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  tenantName: string;
  unitCode: string;
  propertyName: string;
  baseRent: number;
  variableCharges: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  dueDate: string;
  status: "PAID" | "PENDING_VERIFICATION" | "OVERDUE" | "ISSUED";
}

const mockInvoices: InvoiceRecord[] = [
  {
    id: "inv-1",
    invoiceNumber: "INV-2026-11-201",
    tenantName: "Rahul Sharma",
    unitCode: "U-201",
    propertyName: "Green Villa",
    baseRent: 16000,
    variableCharges: 2500,
    totalAmount: 18500,
    amountPaid: 0,
    balanceDue: 18500,
    dueDate: "15 Nov 2026",
    status: "PENDING_VERIFICATION",
  },
  {
    id: "inv-2",
    invoiceNumber: "INV-2026-11-101",
    tenantName: "Vijay Kumar",
    unitCode: "U-101",
    propertyName: "Green Villa",
    baseRent: 18000,
    variableCharges: 2700,
    totalAmount: 20700,
    amountPaid: 20700,
    balanceDue: 0,
    dueDate: "15 Nov 2026",
    status: "PAID",
  },
  {
    id: "inv-3",
    invoiceNumber: "INV-2026-11-102",
    tenantName: "Suresh Nair",
    unitCode: "U-102",
    propertyName: "Green Villa",
    baseRent: 12500,
    variableCharges: 2000,
    totalAmount: 14500,
    amountPaid: 14500,
    balanceDue: 0,
    dueDate: "15 Nov 2026",
    status: "PAID",
  },
  {
    id: "inv-4",
    invoiceNumber: "INV-2026-11-01",
    tenantName: "Amit Patel",
    unitCode: "U-01",
    propertyName: "Lakeview House",
    baseRent: 25000,
    variableCharges: 4800,
    totalAmount: 29800,
    amountPaid: 0,
    balanceDue: 29800,
    dueDate: "15 Nov 2026",
    status: "PENDING_VERIFICATION",
  },
];

export default function BillingPage() {
  const { t } = useTranslation();
  const [showVariableModal, setShowVariableModal] = useState(false);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [offlineSuccess, setOfflineSuccess] = useState<string | null>(null);

  const handleRecordOffline = (e: React.FormEvent) => {
    e.preventDefault();
    setOfflineSuccess("Offline cash payment recorded and receipt generated.");
    setTimeout(() => {
      setShowOfflineModal(false);
      setOfflineSuccess(null);
    }, 1500);
  };

  return (
    <OwnerShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
              {t("common.billing")}
            </h1>
            <p className="text-sm text-text-muted mt-1">
              Monthly invoice cycles, manual variable charges entry, and verified payment ledgers.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOfflineModal(true)}
            >
              <DollarSign className="h-4 w-4 mr-1.5" />
              {t("owner.recordOfflinePayment")}
            </Button>
            <Button
              size="sm"
              onClick={() => setShowVariableModal(true)}
            >
              <Zap className="h-4 w-4 mr-1.5" />
              Enter Variable Charges
            </Button>
          </div>
        </div>

        {/* Billing Schedule Info Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-semibold">
                  November 2026 Billing Cycle
                </CardTitle>
              </div>
              <Badge variant="pending">Preparation Window Active</Badge>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-text-muted space-y-1">
            <p>• Preparation Date: <strong>10th of every month</strong> (Configurable by owner)</p>
            <p>• Invoice Due Date: <strong>15th of every month</strong></p>
            <p>• Base rent is locked from tenancy contracts; variable charges (electricity, water, maintenance) are entered manually.</p>
          </CardContent>
        </Card>

        {/* Invoices Ledger Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">
              Issued Invoices (November 2026)
            </CardTitle>
            <span className="text-xs text-text-muted">
              Total 4 Invoices · ₹83,500 Total Billed
            </span>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Base Rent</TableHead>
                  <TableHead>Variables</TableHead>
                  <TableHead>Total Bill</TableHead>
                  <TableHead>Balance Due</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockInvoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs font-semibold text-text-primary">
                      {inv.invoiceNumber}
                    </TableCell>
                    <TableCell className="font-medium text-text-primary">
                      {inv.tenantName}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-mono bg-surface-muted px-2 py-0.5 rounded border border-border/40">
                        {inv.unitCode}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatINR(inv.baseRent)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-text-muted">
                      {formatINR(inv.variableCharges)}
                    </TableCell>
                    <TableCell className="font-mono font-semibold">
                      {formatINR(inv.totalAmount)}
                    </TableCell>
                    <TableCell className="font-mono font-semibold">
                      {inv.balanceDue === 0 ? (
                        <span className="text-status-paid-fg">₹0.00</span>
                      ) : (
                        <span className="text-status-pending-fg">{formatINR(inv.balanceDue)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-text-muted">
                      {inv.dueDate}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={
                          inv.status === "PAID"
                            ? "paid"
                            : inv.status === "PENDING_VERIFICATION"
                            ? "pending"
                            : "overdue"
                        }
                      >
                        {inv.status === "PENDING_VERIFICATION" ? "Pending Review" : inv.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Variable Charges Modal */}
      {showVariableModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-lg max-w-2xl w-full border border-border shadow-xl p-5 sm:p-6 space-y-4 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">
                  Enter Variable Utility Charges — November 2026
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Input pre-calculated electricity, water, and maintenance amounts in ₹ for each tenant.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowVariableModal(false)}
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unit & Tenant</TableHead>
                    <TableHead>Base Rent</TableHead>
                    <TableHead>Electricity (₹)</TableHead>
                    <TableHead>Water (₹)</TableHead>
                    <TableHead>Maint (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-xs font-medium">H1 - U-101 (Vijay)</TableCell>
                    <TableCell className="font-mono text-xs">₹18,000</TableCell>
                    <TableCell><Input defaultValue="1850" className="h-8 font-mono text-xs w-24" /></TableCell>
                    <TableCell><Input defaultValue="350" className="h-8 font-mono text-xs w-20" /></TableCell>
                    <TableCell><Input defaultValue="500" className="h-8 font-mono text-xs w-20" /></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-xs font-medium">H1 - U-201 (Rahul)</TableCell>
                    <TableCell className="font-mono text-xs">₹16,000</TableCell>
                    <TableCell><Input defaultValue="2100" className="h-8 font-mono text-xs w-24" /></TableCell>
                    <TableCell><Input defaultValue="400" className="h-8 font-mono text-xs w-20" /></TableCell>
                    <TableCell><Input defaultValue="500" className="h-8 font-mono text-xs w-20" /></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setShowVariableModal(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => setShowVariableModal(false)}>
                Finalize & Issue Invoices
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Record Offline Payment Modal */}
      {showOfflineModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-lg max-w-md w-full border border-border shadow-xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="text-base font-semibold text-text-primary">
                  Record Offline Payment
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Owner-only recording for direct cash, cheque, or bank transfers.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowOfflineModal(false)}
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {offlineSuccess ? (
              <div className="p-4 rounded-md bg-status-paid-bg text-status-paid-fg text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{offlineSuccess}</span>
              </div>
            ) : (
              <form onSubmit={handleRecordOffline} className="space-y-3.5">
                <div>
                  <label className="text-xs font-medium text-text-primary">Invoice</label>
                  <select className="mt-1 w-full h-11 sm:h-9 rounded-md border border-border bg-background px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary">
                    <option>INV-2026-11-201 — Rahul Sharma (₹18,500 due)</option>
                    <option>INV-2026-11-01 — Amit Patel (₹29,800 due)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-text-primary">Payment Method</label>
                  <select className="mt-1 w-full h-11 sm:h-9 rounded-md border border-border bg-background px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary">
                    <option value="CASH">Cash Payment</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="BANK_TRANSFER">Direct Bank Transfer (NEFT/RTGS)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-text-primary">Amount Received (₹)</label>
                  <Input defaultValue="18500" className="mt-1 font-mono" required />
                </div>

                <div>
                  <label className="text-xs font-medium text-text-primary">Reference Number / Notes</label>
                  <Input placeholder="e.g. Cheque #10294 or cash handed over" className="mt-1" />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowOfflineModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm">
                    Confirm & Settle Invoice
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </OwnerShell>
  );
}
