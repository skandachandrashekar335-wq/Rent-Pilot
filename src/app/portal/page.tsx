"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { TenantShell } from "@/components/layout/tenant-shell";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Upload, CheckCircle2, FileText, Loader2, Home } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { useTranslation } from "@/components/layout/locale-context";
import { useAuth } from "@/lib/auth/auth-context";
import { paiseToRupees } from "@/lib/domain/rent-increments";
import { UpiPaymentModal } from "@/components/portal/upi-payment-modal";
import { authFetch } from "@/lib/api-client";

interface PortalInvoice {
  id: string;
  invoice_number: string;
  total_due_paise: number;
  balance_due_paise: number;
  due_date: string;
  status: string;
  is_overdue: boolean;
  electricity_paise: number;
  water_paise: number;
  payments?: Array<{
    id: string;
    receipt_number: string;
    amount_paise: number;
    payment_date: string;
  }>;
}

interface RecentReceipt {
  receiptNumber: string;
  verifiedAt: string;
  verifiedAmountRupees: number;
  invoiceNumber: string;
}

export default function TenantHomePage() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [tenancyInfo, setTenancyInfo] = useState<{
    tenancyId: string;
    unitNumber: string;
    propertyName: string;
    baseRentRupees: number;
    tenantName: string;
    activeInvoice: {
      id: string;
      invoiceNumber: string;
      totalDueRupees: number;
      balanceDueRupees: number;
      dueDate: string;
      status: string;
      isOverdue: boolean;
      electricityRupees: number;
      waterRupees: number;
    } | null;
  } | null>(null);

  const [recentReceipt, setRecentReceipt] = useState<RecentReceipt | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);

  useEffect(() => {
    async function loadPortalData() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const [tenancyRes, invoicesRes] = await Promise.all([
          authFetch("/api/portal/tenancy"),
          authFetch("/api/invoices"),
        ]);

        if (tenancyRes.ok) {
          const tData = await tenancyRes.json();
          if (tData.activeTenancy) {
            const activeT = tData.activeTenancy;
            const tenancyId = activeT.id;
            const unitNumber = activeT.unit?.unit_number || "Unit";
            const propertyName = activeT.unit?.property?.name || "Residential Property";
            const baseRentRupees = paiseToRupees(activeT.monthly_rent_paise);
            const tenantName = tData.tenant?.full_name || profile?.full_name || user.displayName || "Tenant";

            let activeInvoice = null;
            let receipt: RecentReceipt | null = null;

            if (invoicesRes.ok) {
              const invData = await invoicesRes.json();
              const invoices = (invData.invoices || []) as PortalInvoice[];

              // Find current unpaid or pending invoice
              const unpaid = invoices.find(
                (i) => i.status !== "PAID" && i.status !== "CANCELLED"
              );
              if (unpaid) {
                activeInvoice = {
                  id: unpaid.id,
                  invoiceNumber: unpaid.invoice_number,
                  totalDueRupees: paiseToRupees(unpaid.total_due_paise),
                  balanceDueRupees: paiseToRupees(unpaid.balance_due_paise),
                  dueDate: new Date(unpaid.due_date).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  }),
                  status: unpaid.status,
                  isOverdue: unpaid.is_overdue,
                  electricityRupees: paiseToRupees(unpaid.electricity_paise || 0),
                  waterRupees: paiseToRupees(unpaid.water_paise || 0),
                };
              }

              // Find most recent verified payment across all invoices
              for (const inv of invoices) {
                if (inv.payments && inv.payments.length > 0) {
                  const sortedPayments = [...inv.payments].sort(
                    (a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
                  );
                  const latest = sortedPayments[0];
                  receipt = {
                    receiptNumber: latest.receipt_number,
                    verifiedAt: new Date(latest.payment_date).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }),
                    verifiedAmountRupees: paiseToRupees(latest.amount_paise),
                    invoiceNumber: inv.invoice_number,
                  };
                  break;
                }
              }
            }

            setTenancyInfo({
              tenancyId,
              unitNumber,
              propertyName,
              baseRentRupees,
              tenantName,
              activeInvoice,
            });
            setRecentReceipt(receipt);
          } else {
            setTenancyInfo(null);
          }
        } else {
          setTenancyInfo(null);
        }
      } catch (err) {
        console.warn("[Portal] Tenancy fetch error:", err);
        setTenancyInfo(null);
      } finally {
        setLoading(false);
      }
    }

    loadPortalData();
  }, [user, profile]);

  if (loading) {
    return (
      <TenantShell>
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-text-muted font-mono">Loading your tenancy records...</p>
        </div>
      </TenantShell>
    );
  }

  if (!tenancyInfo) {
    return (
      <TenantShell>
        <div className="max-w-xl mx-auto py-12 text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-surface-muted mx-auto flex items-center justify-center text-primary border border-border">
            <Home className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-semibold text-text-primary">No Active Tenancy Found</h2>
          <p className="text-xs text-text-muted leading-relaxed max-w-md mx-auto">
            Your Google account ({user?.email}) is not currently linked to an active tenancy. If your landlord sent you an invite link or invite token, please open it to link your lease.
          </p>
          <div className="pt-2">
            <Link href="/portal/support">
              <Button variant="outline" size="sm" className="text-xs">
                Contact Landlord / Support
              </Button>
            </Link>
          </div>
        </div>
      </TenantShell>
    );
  }

  const invoice = tenancyInfo.activeInvoice;

  return (
    <TenantShell>
      <div className="space-y-6 max-w-3xl mx-auto">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              {t("tenant.welcomeBack")}, {tenancyInfo.tenantName}
            </h1>
            <p className="text-xs text-text-muted mt-0.5">
              Unit {tenancyInfo.unitNumber} · {tenancyInfo.propertyName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-mono">
              Base Rent: {formatINR(tenancyInfo.baseRentRupees)}
            </Badge>
          </div>
        </div>

        {/* Active Billing Status Card */}
        {invoice ? (
          <Card className={invoice.isOverdue ? "border-status-overdue-fg/30 bg-status-overdue-bg/10" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono text-text-muted">{invoice.invoiceNumber}</span>
                  <CardTitle className="text-lg font-semibold mt-0.5">
                    {invoice.isOverdue ? t("tenant.billOverdue") : t("tenant.currentBill")}
                  </CardTitle>
                </div>
                <Badge variant={invoice.isOverdue ? "overdue" : "pending"}>
                  {invoice.isOverdue ? t("tenant.overdueBadge") : t("tenant.dueSoonBadge")}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex items-baseline justify-between py-2 border-b border-border/50">
                <span className="text-sm text-text-muted">{t("tenant.balanceDue")}</span>
                <span className="text-3xl font-mono font-bold text-text-primary">
                  {formatINR(invoice.balanceDueRupees)}
                </span>
              </div>

              {/* Utility Charges Breakdown */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded bg-surface-muted border border-border/40">
                  <div className="text-text-muted flex items-center gap-1 mb-1">
                    <Zap className="h-3 w-3 text-status-pending-fg" />
                    <span>{t("tenant.electricity")}</span>
                  </div>
                  <div className="font-mono font-semibold">{formatINR(invoice.electricityRupees)}</div>
                </div>

                <div className="p-2.5 rounded bg-surface-muted border border-border/40">
                  <div className="text-text-muted flex items-center gap-1 mb-1">
                    <span className="text-xs">💧</span>
                    <span>{t("tenant.water")}</span>
                  </div>
                  <div className="font-mono font-semibold">{formatINR(invoice.waterRupees)}</div>
                </div>
              </div>

              <div className="text-xs text-text-muted">
                {t("tenant.dueBy")}: <strong className="text-text-primary">{invoice.dueDate}</strong>
              </div>
            </CardContent>

            <CardFooter className="pt-2 flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => setShowPayModal(true)}
                className="w-full sm:w-auto flex-1 font-semibold flex items-center justify-center gap-2"
              >
                <Upload className="h-4 w-4" />
                <span>{t("tenant.payViaUpi")}</span>
              </Button>
              <Link href="/portal/history" className="w-full sm:w-auto">
                <Button variant="outline" className="w-full text-xs">
                  {t("tenant.viewPaymentHistory")}
                </Button>
              </Link>
            </CardFooter>
          </Card>
        ) : (
          <Card className="border-border">
            <CardContent className="p-8 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-status-paid-bg/30 text-status-paid-fg mx-auto flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-text-primary">All Bills Paid in Full</h3>
              <p className="text-xs text-text-muted max-w-sm mx-auto">
                You have no outstanding rent or utility charges due. Your next monthly invoice will be generated at the start of next month.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Recent Official Receipt */}
        {recentReceipt ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-text-muted" />
                  <span>{t("tenant.recentReceipt")}</span>
                </CardTitle>
                <Badge variant="paid">🟢 {t("common.verified")}</Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-border/30">
                <span className="text-text-muted">{t("tenant.receiptNumber")}</span>
                <span className="font-mono font-medium">{recentReceipt.receiptNumber}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/30">
                <span className="text-text-muted">{t("tenant.verifiedAt")}</span>
                <span>{recentReceipt.verifiedAt}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/30">
                <span className="text-text-muted">{t("tenant.verifiedAmount")}</span>
                <span className="font-mono font-bold text-status-paid-fg">
                  {formatINR(recentReceipt.verifiedAmountRupees)}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-text-muted">Invoice</span>
                <span className="font-mono font-medium text-primary">{recentReceipt.invoiceNumber}</span>
              </div>
            </CardContent>

            <CardFooter className="pt-0">
              <Link href="/portal/history" className="w-full">
                <Button variant="outline" size="sm" className="w-full text-xs">
                  {t("tenant.viewPaymentHistory")} →
                </Button>
              </Link>
            </CardFooter>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-text-muted" />
                <span>{t("tenant.recentReceipt")}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="py-4 text-center text-xs text-text-muted">
              No verified payment receipts yet. When your landlord confirms your UPI transaction, your official receipt will appear here.
            </CardContent>
          </Card>
        )}

        {/* Dynamic UPI Modal */}
        {invoice && (
          <UpiPaymentModal
            isOpen={showPayModal}
            invoiceId={invoice.id}
            tenancyId={tenancyInfo.tenancyId}
            invoiceNumber={invoice.invoiceNumber}
            amountRupees={invoice.balanceDueRupees}
            unitCode={tenancyInfo.unitNumber}
            onClose={() => setShowPayModal(false)}
            onSuccess={() => {
              window.location.reload();
            }}
          />
        )}
      </div>
    </TenantShell>
  );
}
