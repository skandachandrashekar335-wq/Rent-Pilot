"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UserCheck, X, AlertCircle, Copy, Check, ExternalLink, Loader2, TrendingUp } from "lucide-react";

interface CreateTenancyDialogProps {
  isOpen: boolean;
  unitId: string;
  unitCode: string;
  propertyName: string;
  defaultRentRupees: number;
  defaultDepositRupees: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateTenancyDialog({
  isOpen,
  unitId,
  unitCode,
  propertyName,
  defaultRentRupees,
  defaultDepositRupees,
  onClose,
  onSuccess,
}: CreateTenancyDialogProps) {
  const { user, activeOrganization } = useAuth();
  const [tenantName, setTenantName] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]!);
  const [endDate, setEndDate] = useState("");
  const [monthlyRent, setMonthlyRent] = useState(defaultRentRupees || 18000);
  const [securityDeposit, setSecurityDeposit] = useState(defaultDepositRupees || 100000);

  // Increment schedule toggle & parameters
  const [hasIncrement, setHasIncrement] = useState(true);
  const [incrementType, setIncrementType] = useState<"PERCENTAGE" | "FIXED_AMOUNT">("PERCENTAGE");
  const [incrementValue, setIncrementValue] = useState(5);
  const [intervalMonths, setIntervalMonths] = useState(12);

  // Calculate default next increment date: 1 year from start date
  const computeInitialNextDate = () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split("T")[0]!;
  };
  const [nextIncrementDate, setNextIncrementDate] = useState(computeInitialNextDate());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    inviteUrl: string;
    tenantEmail: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!user) throw new Error("Authentication required");
      const token = await user.getIdToken();

      const payload: Record<string, unknown> = {
        organizationId: activeOrganization?.id,
        unitId,
        tenantEmail: tenantEmail.trim().toLowerCase(),
        tenantFullName: tenantName.trim(),
        tenantPhone: tenantPhone.trim() || undefined,
        startDate,
        endDate: endDate ? endDate : null,
        monthlyRentRupees: Number(monthlyRent),
        securityDepositRupees: Number(securityDeposit),
        status: "ACTIVE",
      };

      if (hasIncrement) {
        payload.incrementSchedule = {
          incrementType,
          incrementValue: Number(incrementValue),
          intervalMonths: Number(intervalMonths),
          nextIncrementDate,
          autoApply: false,
        };
      }

      const res = await fetch("/api/tenancies", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create tenancy agreement");
      }

      setSuccessResult({
        inviteUrl: data.inviteUrl,
        tenantEmail: tenantEmail.trim(),
      });
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create tenancy");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!successResult) return;
    navigator.clipboard.writeText(successResult.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <Card className="max-w-lg w-full border-border shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90dvh] overflow-y-auto">
        <CardHeader className="flex flex-row items-start justify-between pb-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              <span>Assign Tenant to {unitCode}</span>
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {propertyName} · Setup lease contract, rent terms, and scheduled increment.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-text-muted hover:text-text-primary -mr-2 -mt-2"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-status-overdue-bg text-status-overdue-fg text-xs font-medium flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!successResult ? (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-primary mb-1">
                    Tenant Full Name <span className="text-status-overdue-fg">*</span>
                  </label>
                  <Input
                    placeholder="e.g. Rahul Sharma"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    required
                    className="text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-primary mb-1">
                    Tenant Email <span className="text-status-overdue-fg">*</span>
                  </label>
                  <Input
                    type="email"
                    placeholder="tenant@example.com"
                    value={tenantEmail}
                    onChange={(e) => setTenantEmail(e.target.value)}
                    required
                    className="text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">
                  Tenant Phone Number
                </label>
                <Input
                  placeholder="+91 98765 43210"
                  value={tenantPhone}
                  onChange={(e) => setTenantPhone(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-primary mb-1">
                    Lease Start Date <span className="text-status-overdue-fg">*</span>
                  </label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-primary mb-1">
                    Lease End Date (Optional)
                  </label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-primary mb-1">
                    Monthly Rent (₹) <span className="text-status-overdue-fg">*</span>
                  </label>
                  <Input
                    type="number"
                    min={1}
                    step={100}
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(Number(e.target.value))}
                    required
                    className="text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-primary mb-1">
                    Security Deposit (₹)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={1000}
                    value={securityDeposit}
                    onChange={(e) => setSecurityDeposit(Number(e.target.value))}
                    className="text-xs font-mono"
                  />
                </div>
              </div>

              {/* Scheduled Rent Increment Box */}
              <div className="p-3 rounded-lg border border-border bg-surface-muted/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold text-text-primary">
                      Scheduled Rent Increment
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={hasIncrement}
                    onChange={(e) => setHasIncrement(e.target.checked)}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                  />
                </div>

                {hasIncrement && (
                  <div className="space-y-2 pt-1 border-t border-border/40 text-xs">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] text-text-muted mb-1">Type</label>
                        <select
                          value={incrementType}
                          onChange={(e) => setIncrementType(e.target.value as "PERCENTAGE" | "FIXED_AMOUNT")}
                          className="w-full h-8 rounded border border-input bg-surface px-2 text-xs"
                        >
                          <option value="PERCENTAGE">Percentage (%)</option>
                          <option value="FIXED_AMOUNT">Fixed (₹)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] text-text-muted mb-1">
                          {incrementType === "PERCENTAGE" ? "Rate (%)" : "Amount (₹)"}
                        </label>
                        <Input
                          type="number"
                          step={0.5}
                          min={0.1}
                          value={incrementValue}
                          onChange={(e) => setIncrementValue(Number(e.target.value))}
                          className="h-8 text-xs font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-text-muted mb-1">Interval</label>
                        <select
                          value={intervalMonths}
                          onChange={(e) => setIntervalMonths(Number(e.target.value))}
                          className="w-full h-8 rounded border border-input bg-surface px-2 text-xs"
                        >
                          <option value={11}>Every 11 Months</option>
                          <option value={12}>Every 12 Months (1 Year)</option>
                          <option value={24}>Every 24 Months (2 Years)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">Next Increment Date</label>
                      <Input
                        type="date"
                        value={nextIncrementDate}
                        onChange={(e) => setNextIncrementDate(e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Creating Tenancy...
                    </>
                  ) : (
                    "Create Tenancy & Generate Invite"
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 pt-1">
              <div className="p-3 rounded-md bg-status-paid-bg border border-status-paid-fg/20 text-xs text-status-paid-fg font-medium">
                Tenancy contract active! An onboarding invitation link was generated for <strong>{successResult.tenantEmail}</strong>.
              </div>

              <div>
                <label className="block text-xs font-medium text-text-primary mb-1">
                  Tenant Portal Invitation Link
                </label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={successResult.inviteUrl}
                    className="font-mono text-xs bg-surface-muted select-all"
                  />
                  <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0 h-9 w-9">
                    {copied ? <Check className="h-4 w-4 text-status-paid-fg" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Hello! Here is your official RentPilot invitation to access your tenancy records and bills for ${unitCode} at ${propertyName}: ${successResult.inviteUrl}`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1"
                >
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Share via WhatsApp
                  </Button>
                </a>
                <Button size="sm" onClick={onClose} className="text-xs">
                  Done
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
