"use client";

import React, { useState } from "react";
import { TenantShell } from "@/components/layout/tenant-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wrench, CheckCircle2, Clock } from "lucide-react";
import { useTranslation } from "@/components/layout/locale-context";

export default function TenantSupportPage() {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <TenantShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">
            {t("common.support")} & Maintenance
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Submit repair requests with photos directly to your landlord.
          </p>
        </div>

        {submitted ? (
          <Card className="p-6 text-center border-status-paid-fg/30 bg-status-paid-bg/30">
            <CheckCircle2 className="h-8 w-8 text-status-paid-fg mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-text-primary">Ticket Submitted</h3>
            <p className="text-xs text-text-muted mt-1">
              Your landlord has been notified. You can track updates below.
            </p>
          </Card>
        ) : (
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Wrench className="h-4 w-4 text-primary" />
                <span>New Maintenance Request</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-text-primary">Category</label>
                  <select className="mt-1 w-full h-11 sm:h-9 rounded-md border border-border bg-background px-3 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary">
                    <option>Plumbing (Taps, pipes, leakage)</option>
                    <option>Electrical (Switch, breaker, fan)</option>
                    <option>Appliance (Geyser, AC)</option>
                    <option>Structural (Doors, locks, paint)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-text-primary">Issue Description</label>
                  <textarea
                    rows={3}
                    placeholder="Describe what is broken or leaking..."
                    required
                    className="mt-1 w-full rounded-md border border-border bg-background p-2.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-text-primary">Attach Photo (Optional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="mt-1 block w-full text-xs text-text-muted file:mr-2 file:py-1.5 file:px-2.5 file:rounded file:border-0 file:text-xs file:bg-surface-muted file:text-text-primary border border-border rounded-md p-1"
                  />
                </div>

                <Button type="submit" className="w-full mt-2">
                  Submit Request
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Active Ticket Timeline */}
        <div className="space-y-2 pt-2">
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Active Requests (1)
          </span>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold">TKT-108 · Plumbing</span>
              <Badge variant="pending">
                <Clock className="h-3 w-3 mr-1" />
                In Progress
              </Badge>
            </div>
            <p className="text-xs text-text-primary mt-2">
              Bathroom sink faucet slow drip and pipe seal leaking under counter.
            </p>
            <p className="text-[10px] text-text-muted mt-2">
              Reported on 12 Nov 2026 · Plumber scheduled for tomorrow morning.
            </p>
          </Card>
        </div>
      </div>
    </TenantShell>
  );
}
