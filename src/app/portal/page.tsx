"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { TenantShell } from "@/components/layout/tenant-shell";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Upload, CheckCircle2, FileText } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { useTranslation } from "@/components/layout/locale-context";
import { useAuth } from "@/lib/auth/auth-context";
import { paiseToRupees } from "@/lib/domain/rent-increments";
import { UpiPaymentModal } from "@/components/portal/upi-payment-modal";

export default function TenantHomePage() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();

  const [tenancyInfo, setTenancyInfo] = useState<{
    tenancyId: string;
    unitNumber: string;
    propertyName: string;
    baseRentRupees: number;
    tenantName: string;
    activeInvoice?: {
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
  }>({
    tenancyId: "mock-tenancy-1",
    unitNumber: "U-201",
    propertyName: "Green Villa",
    baseRentRupees: 16000,
    tenantName: "Rahul Sharma",
    activeInvoice: {
      id: "inv-mock-1",
      invoiceNumber: "INV-2026-11-U201",
      totalDueRupees: 18500,
      balanceDueRupees: 18500,
      dueDate: "15 Nov 2026",
      status: "ISSUED",
      isOverdue: true,
      electricityRupees: 2100,
      waterRupees: 400,
    },
  });

  const [showPayModal, setShowPayModal] = useState(false);

  useEffect(() => {
    async function loadPortalData() {
      try {
        if (!user) throw new Error("Demo preview mode");
        const token = await user.getIdToken();

        const [tenancyRes, invoicesRes] = await Promise.all([
          fetch("/api/portal/tenancy", { headers: { Authorization: `Bearer ${token}` } }),
          fetch("/api/invoices", { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        let tenancyId = "mock-tenancy-1";
        let unitNumber = "U-201";
        let propertyName = "Green Villa";
        let baseRentRupees = 16000;
        let tenantName = profile?.full_name || "Rahul Sharma";

        if (tenancyRes.ok) {
          const tData = await tenancyRes.json();
          if (tData.activeTenancy) {
            tenancyId = tData.activeTenancy.id;
            unitNumber = tData.activeTenancy.unit?.unit_number || "U-201";
            propertyName = tData.activeTenancy.unit?.property?.name || "Green Villa";
            baseRentRupees = paiseToRupees(tData.activeTenancy.monthly_rent_paise);
            tenantName = tData.tenant?.full_name || profile?.full_name || "Tenant";
          }
        }

        let activeInvoice = null;
        if (invoicesRes.ok) {
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
          }
          const invData = await invoicesRes.json();
          const unpaid = ((invData.invoices || []) as PortalInvoice[]).find(
            (i) => i.status !== "PAID" && i.status !== "CANCELLED"
          );
          if (unpaid) {
            activeInvoice = {
              id: unpaid.id,
              invoiceNumber: unpaid.invoice_number,
              totalDueRupees: paiseToRupees(unpaid.total_due_paise),
              balanceDueRupees: paiseToRupees(unpaid.balance_due_paise),
              dueDate: new Date(unpaid.due_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
              status: unpaid.status,
              isOverdue: unpaid.is_overdue,
              electricityRupees: paiseToRupees(unpaid.electricity_paise),
              waterRupees: paiseToRupees(unpaid.water_paise),
            };
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
      } catch (err) {
        console.warn("Portal tenancy fetch error:", err);
        setTenancyInfo({
          tenancyId: "mock-tenancy-1",
          unitNumber: "U-201",
          propertyName: "Green Villa",
          baseRentRupees: 16000,
          tenantName: profile?.full_name || "Rahul Sharma",
          activeInvoice: {
            id: "inv-mock-1",
            invoiceNumber: "INV-2026-11-U201",
            totalDueRupees: 18500,
            balanceDueRupees: 18500,
            dueDate: "15 Nov 2026",
            status: "ISSUED",
            isOverdue: true,
            electricityRupees: 1500,
            waterRupees: 500,
          },
        });
      }
    }

    loadPortalData();
  }, [user, profile]);

  const invoice = tenancyInfo.activeInvoice;

  return (
    <TenantShell>
      <div className="space-y-5">
        {/* Welcome Greeting */}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">
            {t("tenant.welcomeBack")}, {tenancyInfo.tenantName}
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Unit {tenancyInfo.unitNumber} — {tenancyInfo.propertyName} · Active Tenancy
          </p>
        </div>

        {/* Current Bill Hero Card */}
        {invoice ? (
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                  {t("tenant.currentBill")} (November 2026)
                </span>
                <div className="flex items-center gap-1.5">
                  <Badge variant={invoice.isOverdue ? "overdue" : "pending"}>
                    {invoice.isOverdue ? "🔴 Overdue" : "🟡 Unpaid"}
                  </Badge>
                </div>
              </div>
              <CardTitle className="text-3xl font-mono font-bold text-text-primary mt-1">
                {formatINR(invoice.balanceDueRupees)}
              </CardTitle>
              <p className="text-xs text-text-muted">
                {t("tenant.dueDate")}: <strong>{invoice.dueDate}</strong>
              </p>
            </CardHeader>

            <CardContent className="pt-4 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-border/30">
                <span className="text-text-muted">{t("tenant.baseRent")}</span>
                <span className="font-mono font-medium">{formatINR(tenancyInfo.baseRentRupees)}</span>
              </div>
              {invoice.electricityRupees > 0 && (
                <div className="flex justify-between py-1 border-b border-border/30">
                  <span className="text-text-muted">{t("tenant.electricity")}</span>
                  <span className="font-mono font-medium">{formatINR(invoice.electricityRupees)}</span>
                </div>
              )}
              {invoice.waterRupees > 0 && (
                <div className="flex justify-between py-1">
                  <span className="text-text-muted">{t("tenant.water")}</span>
                  <span className="font-mono font-medium">{formatINR(invoice.waterRupees)}</span>
                </div>
              )}
            </CardContent>

            <CardFooter className="flex flex-col gap-2 pt-2">
              <Button
                size="lg"
                onClick={() => setShowPayModal(true)}
                className="w-full font-semibold shadow-sm flex items-center justify-center gap-2"
              >
                <Zap className="h-4 w-4" />
                <span>{t("tenant.payViaUPI")}</span>
              </Button>

              <Button
                variant="outline"
                size="default"
                onClick={() => setShowPayModal(true)}
                className="w-full text-xs flex items-center justify-center gap-1.5"
              >
                <Upload className="h-4 w-4 text-text-muted" />
                <span>{t("tenant.submitProof")}</span>
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <Card className="p-8 text-center space-y-3">
            <CheckCircle2 className="h-10 w-10 text-status-paid-fg mx-auto" />
            <h3 className="text-base font-semibold text-text-primary">All Dues Settled!</h3>
            <p className="text-xs text-text-muted max-w-xs mx-auto">
              You have zero outstanding bills for {tenancyInfo.unitNumber}. Your next billing cycle starts on the 10th of next month.
            </p>
          </Card>
        )}

        {/* Recent Receipt Quick-View */}
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
              <span className="font-mono font-medium">RCP-2026-00412</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border/30">
              <span className="text-text-muted">{t("tenant.verifiedAt")}</span>
              <span>12 Oct 2026, 17:30 IST</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border/30">
              <span className="text-text-muted">{t("tenant.verifiedAmount")}</span>
              <span className="font-mono font-bold text-status-paid-fg">{formatINR(18200)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-text-muted">{t("tenant.transactionRef")}</span>
              <span className="font-mono font-medium text-primary">429810984120</span>
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
              // Reload page data
              window.location.reload();
            }}
          />
        )}
      </div>
    </TenantShell>
  );
}
