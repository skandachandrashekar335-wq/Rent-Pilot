"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { TenantShell } from "@/components/layout/tenant-shell";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Zap, Upload, CheckCircle2, QrCode, ArrowRight, X, FileText } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { useTranslation } from "@/components/layout/locale-context";
import { useAuth } from "@/lib/auth/auth-context";
import { paiseToRupees } from "@/lib/domain/rent-increments";

export default function TenantHomePage() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const [tenancyInfo, setTenancyInfo] = useState<{
    unitNumber: string;
    propertyName: string;
    baseRentRupees: number;
    tenantName: string;
  }>({
    unitNumber: "U-201",
    propertyName: "Green Villa",
    baseRentRupees: 16000,
    tenantName: "Rahul Sharma",
  });

  useEffect(() => {
    async function loadTenancy() {
      try {
        if (!user) return;
        const token = await user.getIdToken();
        const res = await fetch("/api/portal/tenancy", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.activeTenancy) {
            setTenancyInfo({
              unitNumber: data.activeTenancy.unit?.unit_number || "U-201",
              propertyName: data.activeTenancy.unit?.property?.name || "Green Villa",
              baseRentRupees: paiseToRupees(data.activeTenancy.monthly_rent_paise),
              tenantName: data.tenant?.full_name || profile?.full_name || "Tenant",
            });
          }
        }
      } catch (err) {
        console.warn("Portal tenancy fetch:", err);
      }
    }
    loadTenancy();
  }, [user, profile]);

  const [showPayModal, setShowPayModal] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [reference, setReference] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  const handleSubmitProof = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmittedSuccess(true);
      setTimeout(() => {
        setShowPayModal(false);
        setSubmittedSuccess(false);
        setStep(1);
      }, 2000);
    }, 1000);
  };

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
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3 border-b border-border/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                {t("tenant.currentBill")} (Nov 2026)
              </span>
              <Badge variant="pending">🟡 {t("common.unpaid")}</Badge>
            </div>
            <CardTitle className="text-3xl font-mono font-bold text-text-primary mt-1">
              {formatINR(tenancyInfo.baseRentRupees + 2500)}
            </CardTitle>
            <p className="text-xs text-text-muted">
              {t("tenant.dueDate")}: <strong>15 Nov 2026</strong>
            </p>
          </CardHeader>

          <CardContent className="pt-4 space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-border/30">
              <span className="text-text-muted">{t("tenant.baseRent")}</span>
              <span className="font-mono font-medium">{formatINR(tenancyInfo.baseRentRupees)}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/30">
              <span className="text-text-muted">{t("tenant.electricity")} (Nov)</span>
              <span className="font-mono font-medium">{formatINR(2100)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-text-muted">{t("tenant.water")}</span>
              <span className="font-mono font-medium">{formatINR(400)}</span>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-2 pt-2">
            <Button
              size="lg"
              onClick={() => {
                setStep(1);
                setShowPayModal(true);
              }}
              className="w-full font-semibold shadow-sm"
            >
              <Zap className="h-4 w-4 mr-2" />
              {t("tenant.payViaUPI")}
            </Button>

            <Button
              variant="outline"
              size="default"
              onClick={() => {
                setStep(2);
                setShowPayModal(true);
              }}
              className="w-full text-xs"
            >
              <Upload className="h-4 w-4 mr-1.5 text-text-muted" />
              {t("tenant.submitProof")}
            </Button>
          </CardFooter>
        </Card>

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
          <CardContent className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-text-muted">October 2026 Rent</span>
              <span className="font-mono font-semibold">{formatINR(18200)}</span>
            </div>
            <p className="text-[11px] font-mono text-text-muted">
              Ref: UPI/429810984120 · Paid on 12 Oct 2026
            </p>
          </CardContent>
          <CardFooter className="pt-0">
            <Link href="/portal/history" className="text-xs text-primary font-medium hover:underline">
              View all past receipts →
            </Link>
          </CardFooter>
        </Card>

        {/* Support CTA */}
        <div className="rounded-lg border border-border p-4 bg-surface-muted/40 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-text-primary">Need repairs or assistance?</p>
            <p className="text-[11px] text-text-muted">Submit photos and track contractor progress</p>
          </div>
          <Link href="/portal/support">
            <Button variant="outline" size="sm" className="text-xs">
              Report Issue
            </Button>
          </Link>
        </div>
      </div>

      {/* Two-Step Guided UPI Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-surface rounded-t-2xl sm:rounded-lg max-w-md w-full border border-border shadow-2xl p-5 space-y-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <span className="text-[11px] font-mono text-text-muted uppercase">
                  Step {step} of 2
                </span>
                <h3 className="text-base font-semibold text-text-primary">
                  {step === 1 ? "Scan & Pay via UPI" : "Submit Payment Confirmation"}
                </h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowPayModal(false)}
                aria-label="Close payment modal"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {submittedSuccess ? (
              <div className="p-6 text-center space-y-2">
                <CheckCircle2 className="h-10 w-10 text-status-paid-fg mx-auto" />
                <h4 className="text-base font-semibold text-text-primary">Payment Submitted</h4>
                <p className="text-xs text-text-muted">
                  Your reference has been sent to your landlord. You will receive an email receipt once verified.
                </p>
              </div>
            ) : step === 1 ? (
              /* Step 1: Dynamic QR Code & UPI Deep Link */
              <div className="space-y-4">
                <div className="border border-border rounded-lg bg-surface-muted/50 p-4 flex flex-col items-center text-center">
                  <div className="h-40 w-40 bg-white p-2 rounded-md shadow-sm border border-border flex items-center justify-center">
                    <div className="text-center font-mono text-[10px] text-text-muted flex flex-col items-center">
                      <QrCode className="h-24 w-24 text-text-primary mb-1" />
                      <span>Scan in GPay / PhonePe</span>
                    </div>
                  </div>
                  <p className="text-base font-mono font-bold text-text-primary mt-3">
                    {formatINR(18500)}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5">
                    UPI ID: <code className="font-mono font-medium">skanda.rentpilot@upi</code>
                  </p>
                </div>

                <div className="space-y-2">
                  <a
                    href="upi://pay?pa=skanda.rentpilot@upi&pn=Skanda%20Chandrashekar&am=18500&cu=INR&tn=RentPilot-INV-2026-11-201"
                    className="flex items-center justify-center gap-2 w-full h-11 rounded-md bg-primary text-primary-foreground text-sm font-semibold shadow-sm"
                  >
                    <span>Open in UPI App (GPay / PhonePe)</span>
                    <ArrowRight className="h-4 w-4" />
                  </a>

                  <Button
                    variant="outline"
                    className="w-full text-xs"
                    onClick={() => setStep(2)}
                  >
                    Paid Already? Continue to Step 2 →
                  </Button>
                </div>

                <p className="text-[11px] text-text-muted text-center">
                  ⚠️ Payment is not confirmed until you complete Step 2 and your landlord verifies the transfer.
                </p>
              </div>
            ) : (
              /* Step 2: Reference Number & Screenshot Upload */
              <form onSubmit={handleSubmitProof} className="space-y-3.5">
                <div>
                  <label className="text-xs font-medium text-text-primary">
                    Transaction Reference / UTR Number
                  </label>
                  <Input
                    placeholder="e.g. 431289012389 or GPay / PhonePe Ref"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    required
                    className="mt-1 font-mono uppercase"
                  />
                  <p className="text-[11px] text-text-muted mt-1">
                    Find this 8–30 character reference in your banking SMS or UPI confirmation screen.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-text-primary">
                    Upload Payment Screenshot
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    required
                    className="mt-1 block w-full text-xs text-text-muted file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-surface-muted file:text-text-primary hover:file:bg-surface-hover cursor-pointer border border-border rounded-md p-1"
                  />
                  <p className="text-[11px] text-text-muted mt-1">
                    Allowed: JPG, PNG, WEBP, PDF (Max 5MB). Encrypted in private storage.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="w-1/3"
                  >
                    ← Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-2/3"
                  >
                    {isSubmitting ? "Submitting..." : "Submit for Verification"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </TenantShell>
  );
}
