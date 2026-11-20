"use client";

import React, { useState, useEffect, useCallback } from "react";
import { OwnerShell } from "@/components/layout/owner-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Clock, Eye, UserPlus, DollarSign, Zap, Loader2 } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { useTranslation } from "@/components/layout/locale-context";
import { useAuth } from "@/lib/auth/auth-context";
import { paiseToRupees } from "@/lib/domain/billing";
import { InviteTenantDialog } from "@/components/auth/invite-tenant-dialog";
import { SplitScreenVerificationDrawer } from "@/components/billing/split-screen-verification-drawer";
import { authFetch } from "@/lib/api-client";
import { RecordOfflinePaymentDialog } from "@/components/billing/record-offline-payment-dialog";
import { VariableChargesModal } from "@/components/billing/variable-charges-modal";

interface PendingVerification {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  tenantName: string;
  unitCode: string;
  propertyName: string;
  amountPaise: number;
  normalizedReference: string;
  submittedAt: string;
  storagePath: string;
}

interface InvoiceSubmission {
  id: string;
  status: string;
  amount_paise: number;
  normalized_reference: string;
  created_at: string;
  storage_path: string;
}

interface OverviewInvoice {
  id: string;
  invoice_number: string;
  total_due_paise: number;
  amount_paid_paise: number;
  balance_due_paise: number;
  tenancy?: {
    tenant?: { full_name?: string | null } | null;
    unit?: { unit_number?: string | null; property?: { name?: string | null } | null } | null;
  } | null;
  payment_submissions?: InvoiceSubmission[] | null;
}

export default function OwnerOverviewPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [invoices, setInvoices] = useState<OverviewInvoice[]>([]);
  const [pendingVerifications, setPendingVerifications] = useState<PendingVerification[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [selectedVerification, setSelectedVerification] = useState<PendingVerification | null>(null);
  const [offlinePaymentOpen, setOfflinePaymentOpen] = useState(false);
  const [variableChargesOpen, setVariableChargesOpen] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      if (!user) {
        setInvoices([]);
        setPendingVerifications([]);
        setLoading(false);
        return;
      }

      const res = await authFetch("/api/invoices");
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || "Failed to fetch invoices");
      }
      const data = await res.json();
      const invs = (data.invoices || []) as OverviewInvoice[];
      setInvoices(invs);

      // Extract all pending submissions
      const verifications: PendingVerification[] = [];
      invs.forEach((inv) => {
        (inv.payment_submissions || []).forEach((sub) => {
          if (sub.status === "PENDING_REVIEW") {
            verifications.push({
              id: sub.id,
              invoiceId: inv.id,
              invoiceNumber: inv.invoice_number,
              tenantName: inv.tenancy?.tenant?.full_name || "Tenant",
              unitCode: inv.tenancy?.unit?.unit_number || "Unit",
              propertyName: inv.tenancy?.unit?.property?.name || "Property",
              amountPaise: sub.amount_paise,
              normalizedReference: sub.normalized_reference,
              submittedAt: new Date(sub.created_at).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              }),
              storagePath: sub.storage_path,
            });
          }
        });
      });

      setPendingVerifications(verifications);

      // Stage F: Demand-driven background reconciliation on owner dashboard mount
      authFetch("/api/billing/reconcile", {
        method: "POST",
      }).catch((reconcileErr) => {
        console.warn("[Background Billing Reconcile]", reconcileErr);
      });
    } catch (err: unknown) {
      console.warn("[Dashboard] Invoices fetch error:", err);
      setPendingVerifications([]);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Financial KPIs
  const totalBilledRupees = invoices.reduce((sum, inv) => sum + paiseToRupees(inv.total_due_paise), 0);
  const collectedRupees = invoices.reduce((sum, inv) => sum + paiseToRupees(inv.amount_paid_paise), 0);
  const pendingCount = pendingVerifications.length;

  return (
    <OwnerShell>
      <div className="space-y-6">
        {/* Page Title & Actions */}
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInviteModalOpen(true)}
              className="flex items-center gap-1.5"
            >
              <UserPlus className="h-4 w-4 text-primary" />
              <span>Invite Tenant</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOfflinePaymentOpen(true)}
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
              <span>{t("owner.enterUtilityCharges")}</span>
            </Button>
          </div>
        </div>

        {actionSuccess && (
          <div className="p-3 rounded-md bg-status-paid-bg text-status-paid-fg text-xs font-medium flex items-center gap-2 border border-status-paid-fg/20">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                {t("owner.totalBilled")}
              </span>
              <CardTitle className="text-2xl font-mono font-semibold text-text-primary">
                {formatINR(totalBilledRupees)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-text-muted">
                Current billing cycle · {invoices.length} active invoices
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                {t("owner.collected")}
              </span>
              <CardTitle className="text-2xl font-mono font-semibold text-status-paid-fg">
                {formatINR(collectedRupees)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1.5 text-xs text-text-muted">
                <span className="font-medium text-status-paid-fg">
                  {totalBilledRupees > 0 ? Math.round((collectedRupees / totalBilledRupees) * 100) : 0}%
                </span> of billed total settled
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                {t("owner.pendingVerification")}
              </span>
              <CardTitle className="text-2xl font-mono font-semibold text-status-pending-fg">
                {pendingCount}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-text-muted">
                {pendingCount === 0 ? "All payment proofs verified" : "Requires owner bank statement cross-check"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Verification Queue Section */}
        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-status-pending-fg" />
                <span>UPI Payment Verification Queue</span>
              </CardTitle>
              <p className="text-xs text-text-muted mt-0.5">
                Tenants have submitted these UPI references. Cross-check against your bank account.
              </p>
            </div>
            {pendingCount > 0 && (
              <Badge variant="pending">
                {pendingCount} Pending
              </Badge>
            )}
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-xs text-text-muted">
                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
                Loading verification queue...
              </div>
            ) : pendingVerifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-text-muted">
                <CheckCircle2 className="h-8 w-8 text-status-paid-fg mx-auto mb-2 opacity-80" />
                No pending payments awaiting verification. All proofs are settled.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant & Unit</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Transaction UTR</TableHead>
                      <TableHead>Submitted At</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingVerifications.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-semibold text-xs text-text-primary">{item.tenantName}</div>
                          <div className="text-[11px] text-text-muted">
                            {item.unitCode} ({item.propertyName})
                          </div>
                        </TableCell>
                        <TableCell className="font-mono font-bold text-xs text-text-primary">
                          {formatINR(paiseToRupees(item.amountPaise))}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-primary font-medium">
                          {item.normalizedReference}
                        </TableCell>
                        <TableCell className="text-xs text-text-muted">{item.submittedAt}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => setSelectedVerification(item)}
                            className="h-8 text-xs flex items-center gap-1.5"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Review & Verify</span>
                          </Button>
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
        <InviteTenantDialog
          isOpen={inviteModalOpen}
          onClose={() => setInviteModalOpen(false)}
        />

        <SplitScreenVerificationDrawer
          isOpen={!!selectedVerification}
          item={selectedVerification}
          onClose={() => setSelectedVerification(null)}
          onSuccess={() => {
            setActionSuccess("Payment proof successfully verified and receipt issued.");
            fetchDashboardData();
            setTimeout(() => setActionSuccess(null), 3000);
          }}
        />

        <RecordOfflinePaymentDialog
          isOpen={offlinePaymentOpen}
          invoices={invoices.map((inv) => ({
            id: inv.id,
            invoiceNumber: inv.invoice_number,
            unitCode: inv.tenancy?.unit?.unit_number || "Unit",
            tenantName: inv.tenancy?.tenant?.full_name || "Tenant",
            balanceDueRupees: paiseToRupees(inv.balance_due_paise),
          }))}
          onClose={() => setOfflinePaymentOpen(false)}
          onSuccess={() => {
            setActionSuccess("Offline payment successfully recorded into ledger.");
            fetchDashboardData();
            setTimeout(() => setActionSuccess(null), 3000);
          }}
        />

        <VariableChargesModal
          isOpen={variableChargesOpen}
          billingYear={2026}
          billingMonth={11}
          onClose={() => setVariableChargesOpen(false)}
          onSuccess={() => {
            setActionSuccess("Billing batch processed successfully.");
            fetchDashboardData();
            setTimeout(() => setActionSuccess(null), 3000);
          }}
        />
      </div>
    </OwnerShell>
  );
}
