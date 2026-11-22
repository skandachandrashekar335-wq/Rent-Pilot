"use client";

import React, { useState, useEffect, useCallback } from "react";
import { OwnerShell } from "@/components/layout/owner-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet, CheckCircle2, Zap, DollarSign, Loader2, Search } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { useTranslation } from "@/components/layout/locale-context";
import { useAuth } from "@/lib/auth/auth-context";
import { paiseToRupees } from "@/lib/domain/billing";
import { VariableChargesModal } from "@/components/billing/variable-charges-modal";
import { RecordOfflinePaymentDialog } from "@/components/billing/record-offline-payment-dialog";
import { SplitScreenVerificationDrawer, VerificationItem } from "@/components/billing/split-screen-verification-drawer";
import { authFetch } from "@/lib/api-client";
import { getMemoryCache, setMemoryCache } from "@/lib/cache/memory-query-cache";

interface RawInvoiceApiResponse {
  id: string;
  invoice_number: string;
  rent_paise: number;
  total_due_paise: number;
  amount_paid_paise: number;
  balance_due_paise: number;
  due_date: string;
  status: string;
  is_overdue: boolean;
  has_pending_proof: boolean;
  tenancy?: {
    tenant?: { full_name?: string | null } | null;
    unit?: { unit_number?: string | null; property?: { name?: string | null } | null } | null;
  } | null;
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  tenantName: string;
  unitCode: string;
  propertyName: string;
  rentRupees: number;
  variableChargesRupees: number;
  totalDueRupees: number;
  amountPaidRupees: number;
  balanceDueRupees: number;
  dueDate: string;
  status: string;
  is_overdue: boolean;
  has_pending_proof: boolean;
}

export default function BillingPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [variableChargesOpen, setVariableChargesOpen] = useState(false);
  const [offlinePaymentOpen, setOfflinePaymentOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<string | undefined>(undefined);
  const [verificationItem, setVerificationItem] = useState<VerificationItem | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const BILLING_CACHE_KEY = "/api/billing-invoices-view";

  const fetchInvoices = useCallback(async () => {
    try {
      if (!user) {
        setInvoices([]);
        setLoading(false);
        return;
      }

      const cached = getMemoryCache<InvoiceRow[]>(BILLING_CACHE_KEY);
      if (cached && cached.length > 0) {
        setInvoices(cached);
        setLoading(false);
      }

      const res = await authFetch("/api/invoices");
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || "Failed to load invoices");
      }
      const data = await res.json();

      const rawInvoices = (data.invoices || []) as RawInvoiceApiResponse[];
      const mapped: InvoiceRow[] = rawInvoices.map((inv) => {
        const rentRupees = paiseToRupees(inv.rent_paise);
        const totalDueRupees = paiseToRupees(inv.total_due_paise);
        const amountPaidRupees = paiseToRupees(inv.amount_paid_paise);
        const balanceDueRupees = paiseToRupees(inv.balance_due_paise);
        const variableChargesRupees = totalDueRupees - rentRupees;

        return {
          id: inv.id,
          invoice_number: inv.invoice_number,
          tenantName: inv.tenancy?.tenant?.full_name || "Unknown Tenant",
          unitCode: inv.tenancy?.unit?.unit_number || "Unit",
          propertyName: inv.tenancy?.unit?.property?.name || "Property",
          rentRupees,
          variableChargesRupees: variableChargesRupees > 0 ? variableChargesRupees : 0,
          totalDueRupees,
          amountPaidRupees,
          balanceDueRupees,
          dueDate: inv.due_date,
          status: inv.status,
          is_overdue: inv.is_overdue,
          has_pending_proof: inv.has_pending_proof,
        };
      });

      setInvoices(mapped);
      setMemoryCache(BILLING_CACHE_KEY, mapped);
    } catch (err: unknown) {
      console.warn("[Billing] Invoices fetch error:", err);
      if (!getMemoryCache(BILLING_CACHE_KEY)) {
        setInvoices([]);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      inv.tenantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.unitCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === "ALL") return true;
    if (statusFilter === "OVERDUE") return inv.is_overdue || inv.status === "OVERDUE";
    return inv.status === statusFilter;
  });

  const totalBilled = filteredInvoices.reduce((s, i) => s + i.totalDueRupees, 0);
  const totalBalanceDue = filteredInvoices.reduce((s, i) => s + i.balanceDueRupees, 0);

  return (
    <OwnerShell>
      <div className="space-y-6">
        {/* Header & Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
              {t("common.billing")} & Invoices
            </h1>
            <p className="text-sm text-text-muted mt-1">
              Monthly invoice cycles, manual variable charges entry, and verified payment ledgers.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedInvoiceForPayment(undefined);
                setOfflinePaymentOpen(true);
              }}
              className="flex items-center gap-1.5"
            >
              <DollarSign className="h-4 w-4 text-primary" />
              <span>{t("owner.recordOfflinePayment")}</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setVariableChargesOpen(true)}
              className="flex items-center gap-1.5"
            >
              <Zap className="h-4 w-4" />
              <span>Enter Variable Charges</span>
            </Button>
          </div>
        </div>

        {actionSuccess && (
          <div className="p-3 rounded-md bg-status-paid-bg text-status-paid-fg text-xs font-medium flex items-center gap-2 border border-status-paid-fg/20">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Billing Schedule Info Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-semibold">
                  November 2026 Billing Engine
                </CardTitle>
              </div>
              <Badge variant="pending">Billing Cycle Active</Badge>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-text-muted space-y-1">
            <p>• <strong>Preparation Date:</strong> 10th of every month (Enter electricity, water, and maintenance amounts).</p>
            <p>• <strong>Invoice Due Date:</strong> 15th of every month (UPI QR display and deep-links active in tenant portals).</p>
            <p>• <strong>Financial Invariant:</strong> Base rents derive from signed lease contracts; invoices are uniquely composite-keyed by tenancy and month.</p>
          </CardContent>
        </Card>

        {/* Filter Controls & Ledger Table */}
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
            <div>
              <CardTitle className="text-base font-semibold">Invoices Ledger</CardTitle>
              <p className="text-xs text-text-muted mt-0.5">
                Showing {filteredInvoices.length} invoices · Total Billed: {formatINR(totalBilled)} · Outstanding: {formatINR(totalBalanceDue)}
              </p>
            </div>

            {/* Filter Pills & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" />
                <Input
                  placeholder="Search tenant or unit..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs w-full sm:w-48"
                />
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                {["ALL", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE"].map((st) => (
                  <Button
                    key={st}
                    variant={statusFilter === st ? "primary" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(st)}
                    className="h-7 text-xs px-2.5"
                  >
                    {st.replace(/_/g, " ")}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="p-12 text-center text-xs text-text-muted">
                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                Loading ledger records...
              </div>
            ) : filteredInvoices.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted">
                No invoices match the selected filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Tenant & Unit</TableHead>
                      <TableHead className="text-right">Base Rent</TableHead>
                      <TableHead className="text-right">Utilities</TableHead>
                      <TableHead className="text-right">Total Bill</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Balance Due</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-xs font-semibold text-text-primary">
                          {inv.invoice_number}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-xs text-text-primary">{inv.tenantName}</div>
                          <div className="text-[11px] text-text-muted">{inv.unitCode} ({inv.propertyName})</div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatINR(inv.rentRupees)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatINR(inv.variableChargesRupees)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-xs text-text-primary">
                          {formatINR(inv.totalDueRupees)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-status-paid-fg">
                          {formatINR(inv.amountPaidRupees)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-xs text-text-primary">
                          {formatINR(inv.balanceDueRupees)}
                        </TableCell>
                        <TableCell className="text-xs text-text-muted">
                          {new Date(inv.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 items-start">
                            <Badge
                              variant={
                                inv.status === "PAID"
                                  ? "paid"
                                  : inv.status === "OVERDUE"
                                  ? "overdue"
                                  : "pending"
                              }
                            >
                              {inv.status.replace(/_/g, " ")}
                            </Badge>

                            {/* Precedence Invariant: Partially paid + past due shows OVERDUE indicator */}
                            {inv.is_overdue && inv.status === "PARTIALLY_PAID" && (
                              <Badge variant="overdue" className="text-[10px]">
                                OVERDUE
                              </Badge>
                            )}

                            {inv.has_pending_proof && (
                              <span className="text-[10px] text-primary font-medium flex items-center gap-0.5">
                                ● Proof Pending
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {inv.balanceDueRupees > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedInvoiceForPayment(inv.id);
                                  setOfflinePaymentOpen(true);
                                }}
                                className="h-7 text-xs flex items-center gap-1"
                              >
                                <DollarSign className="h-3 w-3 text-primary" />
                                <span>Pay</span>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialogs */}
        <VariableChargesModal
          isOpen={variableChargesOpen}
          billingYear={2026}
          billingMonth={11}
          onClose={() => setVariableChargesOpen(false)}
          onSuccess={() => {
            setActionSuccess("Variable charges saved and billing cycle updated.");
            fetchInvoices();
            setTimeout(() => setActionSuccess(null), 3000);
          }}
        />

        <RecordOfflinePaymentDialog
          isOpen={offlinePaymentOpen}
          invoices={invoices.map((inv) => ({
            id: inv.id,
            invoiceNumber: inv.invoice_number,
            unitCode: inv.unitCode,
            tenantName: inv.tenantName,
            balanceDueRupees: inv.balanceDueRupees,
          }))}
          preSelectedInvoiceId={selectedInvoiceForPayment}
          onClose={() => setOfflinePaymentOpen(false)}
          onSuccess={() => {
            setActionSuccess("Payment successfully recorded into verified ledger.");
            fetchInvoices();
            setTimeout(() => setActionSuccess(null), 3000);
          }}
        />

        <SplitScreenVerificationDrawer
          isOpen={!!verificationItem}
          item={verificationItem}
          onClose={() => setVerificationItem(null)}
          onSuccess={() => {
            setActionSuccess("Payment proof verified and receipt issued.");
            fetchInvoices();
            setTimeout(() => setActionSuccess(null), 3000);
          }}
        />
      </div>
    </OwnerShell>
  );
}
