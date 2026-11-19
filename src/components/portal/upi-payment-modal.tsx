"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  QrCode,
  Copy,
  Check,
  ExternalLink,
  X,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { formatINR } from "@/lib/utils";
import { buildUpiPaymentUri, normalizePaymentReference } from "@/lib/domain/billing";
import { authFetch } from "@/lib/api-client";

interface UpiPaymentModalProps {
  isOpen: boolean;
  invoiceId: string;
  tenancyId: string;
  invoiceNumber: string;
  amountRupees: number;
  unitCode: string;
  vpa?: string;
  payeeName?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function UpiPaymentModal({
  isOpen,
  invoiceId,
  tenancyId,
  invoiceNumber,
  amountRupees,
  unitCode,
  vpa = "rentpilot@okhdfcbank",
  payeeName = "RentPilot Properties",
  onClose,
  onSuccess,
}: UpiPaymentModalProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [rawReference, setRawReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [copiedVpa, setCopiedVpa] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const safeAmount = Number.isFinite(amountRupees) && amountRupees > 0 ? amountRupees : 0;
  const upiUri = buildUpiPaymentUri({
    vpa,
    payeeName,
    amountPaise: BigInt(Math.round(safeAmount * 100)),
    transactionNote: `Rent ${invoiceNumber || "INV"} ${unitCode || ""}`.trim(),
  });

  const normalizedRef = normalizePaymentReference(rawReference);

  const handleCopyVpa = () => {
    navigator.clipboard.writeText(vpa);
    setCopiedVpa(true);
    setTimeout(() => setCopiedVpa(false), 2000);
  };

  const handleCopyAmount = () => {
    navigator.clipboard.writeText(amountRupees.toString());
    setCopiedAmount(true);
    setTimeout(() => setCopiedAmount(false), 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.size > 5 * 1024 * 1024) {
        setError("File size exceeds 5 MB limit. Please compress or choose a smaller image.");
        setFile(null);
        return;
      }
      setFile(selected);
      setError(null);
    }
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    setError(null);

    try {
      if (!user) throw new Error("Authentication required");
      if (!file) throw new Error("Payment screenshot is required");
      if (normalizedRef.length < 8 || normalizedRef.length > 30) {
        throw new Error("Transaction reference / UTR must be between 8 and 30 alphanumeric characters");
      }

      // 1. Get secure storage path
      const storageInitRes = await authFetch("/api/storage/receipts/upload-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "image/png",
          fileSize: file.size,
        }),
      });

      if (!storageInitRes.ok) throw new Error("Failed to initialize receipt storage");
      const storageData = await storageInitRes.json();

      // 2. Submit payment proof
      const submitRes = await authFetch("/api/payments/submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          invoiceId,
          tenancyId,
          amountRupees: Number(amountRupees),
          rawReference,
          storagePath: storageData.storagePath,
        }),
      });

      const submitData = await submitRes.json();
      if (!submitRes.ok) {
        throw new Error(submitData.error || "Failed to submit payment proof");
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <Card className="max-w-md w-full border-border shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <CardHeader className="flex flex-row items-start justify-between pb-3 border-b border-border/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-surface-muted border border-border">
                Step {step} of 2
              </span>
              <CardTitle className="text-base font-bold">
                {step === 1 ? "Scan & Pay via UPI" : "Upload Payment Proof"}
              </CardTitle>
            </div>
            <CardDescription className="text-xs mt-1">
              Invoice: {invoiceNumber} · {unitCode}
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-text-muted hover:text-text-primary -mr-2 -mt-2">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-status-overdue-bg text-status-overdue-fg text-xs font-medium flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="py-6 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-status-paid-bg text-status-paid-fg flex items-center justify-center mx-auto border border-status-paid-fg/20">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-text-primary">Payment Proof Submitted!</h3>
              <p className="text-xs text-text-muted max-w-xs mx-auto">
                Your payment reference <strong>{normalizedRef}</strong> has been logged for review. Your landlord will verify and issue your receipt.
              </p>
            </div>
          ) : step === 1 ? (
            /* STEP 1: SCAN & PAY VIA UPI */
            <div className="space-y-4">
              {/* Amount Display */}
              <div className="p-3 rounded-lg bg-surface-muted/60 border border-border flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-text-muted uppercase">Amount Due</span>
                  <div className="text-2xl font-mono font-bold text-text-primary">{formatINR(amountRupees)}</div>
                </div>
                <Button variant="outline" size="sm" onClick={handleCopyAmount} className="h-8 text-xs">
                  {copiedAmount ? <Check className="h-3.5 w-3.5 text-status-paid-fg" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                  <span>{copiedAmount ? "Copied" : "Copy"}</span>
                </Button>
              </div>

              {/* Dynamic QR Code Box */}
              <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-border bg-white shadow-xs">
                {/* Clean inline SVG QR placeholder / illustration */}
                <div className="p-2 border-2 border-black rounded-lg bg-white mb-2">
                  <div className="w-36 h-36 flex items-center justify-center font-mono text-[10px] text-black text-center p-2 border border-dashed border-gray-400">
                    <div>
                      <QrCode className="h-10 w-10 mx-auto mb-1 text-black" />
                      <span className="font-bold">UPI QR CODE</span>
                      <div className="text-[9px] text-gray-600 mt-1">{vpa}</div>
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-medium text-slate-800">
                  Scan with GPay, PhonePe, Paytm, or BHIM
                </span>
              </div>

              {/* UPI ID Details */}
              <div className="flex items-center justify-between p-2.5 rounded bg-surface-muted text-xs border border-border">
                <div className="overflow-hidden mr-2">
                  <span className="text-[10px] text-text-muted block">Landlord UPI ID (VPA):</span>
                  <span className="font-mono font-semibold text-text-primary truncate block">{vpa}</span>
                </div>
                <Button variant="outline" size="sm" onClick={handleCopyVpa} className="h-7 text-xs shrink-0">
                  {copiedVpa ? <Check className="h-3.5 w-3.5 text-status-paid-fg" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                  <span>{copiedVpa ? "Copied" : "Copy"}</span>
                </Button>
              </div>

              {/* Mobile Deep-Link Launch */}
              <a href={upiUri} className="block w-full">
                <Button variant="outline" className="w-full h-10 text-xs font-semibold flex items-center justify-center gap-1.5 border-primary/40 hover:bg-primary/5">
                  <ExternalLink className="h-3.5 w-3.5 text-primary" />
                  <span>Open in Installed UPI App</span>
                </Button>
              </a>

              <div className="pt-2">
                <Button onClick={() => setStep(2)} className="w-full h-11 text-xs font-semibold flex items-center justify-center gap-1.5">
                  <span>I Have Paid → Enter UTR & Upload Screenshot</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            /* STEP 2: ENTER UTR & UPLOAD SCREENSHOT */
            <form onSubmit={handleSubmitProof} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">
                  12-Digit UTR / Transaction Reference <span className="text-status-overdue-fg">*</span>
                </label>
                <Input
                  placeholder="e.g. 431289012389"
                  value={rawReference}
                  onChange={(e) => setRawReference(e.target.value)}
                  required
                  className="font-mono text-sm tracking-wider uppercase font-semibold"
                />
                {normalizedRef && (
                  <div className="text-[11px] text-text-muted mt-1 flex items-center gap-1 font-mono">
                    <span>Normalized:</span>
                    <strong className="text-primary">{normalizedRef}</strong>
                    <span>({normalizedRef.length} chars)</span>
                  </div>
                )}
                <p className="text-[11px] text-text-muted mt-1">
                  Found in your GPay / PhonePe / Bank app payment details screen.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">
                  Upload Payment Screenshot <span className="text-status-overdue-fg">*</span>
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileChange}
                  required
                  className="block w-full text-xs text-text-muted file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-surface-muted file:text-text-primary hover:file:bg-surface-muted/80 cursor-pointer"
                />
                <p className="text-[11px] text-text-muted mt-1">
                  Max size: 5 MB. Formats: JPG, PNG, WEBP, PDF.
                </p>
              </div>

              <div className="p-3 rounded bg-surface-muted border border-border/40 text-[11px] text-text-muted flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>
                  Your receipt is stored privately. Once verified, an official tax receipt will be downloadable in your portal.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-between gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setStep(1)} disabled={uploading}>
                  ← Back to QR
                </Button>
                <Button type="submit" size="sm" disabled={uploading || !file || normalizedRef.length < 8}>
                  {uploading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Uploading Proof...
                    </>
                  ) : (
                    "Submit for Verification"
                  )}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
