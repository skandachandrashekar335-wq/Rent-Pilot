"use client";

import React, { useState, useEffect } from "react";
import { TenantShell } from "@/components/layout/tenant-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, Home, TrendingUp, Loader2 } from "lucide-react";
import { useTranslation } from "@/components/layout/locale-context";
import { useAuth } from "@/lib/auth/auth-context";
import { formatINR } from "@/lib/utils";
import { paiseToRupees } from "@/lib/domain/rent-increments";
import { authFetch } from "@/lib/api-client";
import { MfaSecurityCard } from "@/components/auth/mfa-security-card";

interface TenancyDetails {
  id: string;
  start_date: string;
  end_date: string | null;
  monthly_rent_paise: number;
  security_deposit_paise: number;
  status: string;
  unit: {
    unit_number: string;
    configuration_label: string;
    bedrooms: number;
    bathrooms: number;
    has_parking: boolean;
    property: {
      name: string;
      address_line: string;
      city: string;
      state: string;
      pincode: string;
    };
  };
  rent_increment_schedules?: Array<{
    increment_type: string;
    increment_value: number;
    next_increment_date: string;
  }>;
}

export default function TenantProfilePage() {
  const { t, locale, setLocale } = useTranslation();
  const { user } = useAuth();
  const [tenancy, setTenancy] = useState<TenancyDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTenantData() {
      try {
        if (!user) {
          setTenancy(null);
          setLoading(false);
          return;
        }
        const res = await authFetch("/api/portal/tenancy");

        if (res.ok) {
          const data = await res.json();
          if (data.activeTenancy) {
            setTenancy(data.activeTenancy);
            return;
          }
        }
        setTenancy(null);
      } catch (err) {
        console.warn("[Portal Profile] Tenancy fetch warning:", err);
        setTenancy(null);
      } finally {
        setLoading(false);
      }
    }

    loadTenantData();
  }, [user]);

  const rentRupees = tenancy ? paiseToRupees(tenancy.monthly_rent_paise) : 0;
  const depositRupees = tenancy ? paiseToRupees(tenancy.security_deposit_paise) : 0;
  const activeSchedule = tenancy?.rent_increment_schedules?.[0];

  return (
    <TenantShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">
            {t("common.profile")} & Preferences
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Manage language preferences and review your tenancy details.
          </p>
        </div>

        {/* Language Selection Card */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              <span>{t("common.language")} / ಭಾಷೆ / भाषा</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={locale === "en" ? "primary" : "outline"}
                size="sm"
                onClick={() => setLocale("en")}
                className="text-xs"
              >
                English
              </Button>
              <Button
                variant={locale === "kn" ? "primary" : "outline"}
                size="sm"
                onClick={() => setLocale("kn")}
                className="text-xs"
              >
                ಕನ್ನಡ
              </Button>
              <Button
                variant={locale === "hi" ? "primary" : "outline"}
                size="sm"
                onClick={() => setLocale("hi")}
                className="text-xs"
              >
                हिन्दी
              </Button>
            </div>
            <p className="text-[11px] text-text-muted mt-2">
              UI labels switch immediately. Indian currency (₹) and dates remain standard.
            </p>
          </CardContent>
        </Card>

        {/* Two-Factor Authentication Security Card */}
        <MfaSecurityCard />

        {/* Tenancy Details Card */}
        {loading ? (
          <div className="p-6 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
            <p className="text-xs text-text-muted">Loading tenancy contract...</p>
          </div>
        ) : tenancy ? (
          <Card>
            <CardHeader className="p-4 pb-2 border-b border-border/40">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Home className="h-4 w-4 text-primary" />
                  <span>Tenancy Agreement</span>
                </CardTitle>
                <Badge variant="paid" className="text-[11px]">
                  {tenancy.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-3 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-text-muted">Assigned Property:</span>
                <span className="font-medium text-text-primary">
                  {tenancy.unit.property.name} ({tenancy.unit.property.city})
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-text-muted">Unit & Specs:</span>
                <span className="font-medium text-text-primary">
                  {tenancy.unit.unit_number} · {tenancy.unit.configuration_label} ({tenancy.unit.bedrooms} Bed, {tenancy.unit.bathrooms} Bath)
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-text-muted">Parking:</span>
                <span className="text-text-primary">
                  {tenancy.unit.has_parking ? "Dedicated Slot Allocated" : "None"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-text-muted">Contract Monthly Rent:</span>
                <span className="font-mono font-semibold text-text-primary">
                  {formatINR(rentRupees)} / month
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-text-muted">Security Deposit:</span>
                <span className="font-mono font-medium text-text-primary">
                  {formatINR(depositRupees)} (Refundable)
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-text-muted">Lease Start Date:</span>
                <span className="font-mono text-text-primary">
                  {new Date(tenancy.start_date).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>

              {/* Scheduled Rent Increment Notice */}
              {activeSchedule && (
                <div className="mt-3 p-3 rounded-md bg-surface-muted border border-border flex items-start gap-2.5">
                  <TrendingUp className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="text-[11px] space-y-0.5">
                    <p className="font-semibold text-text-primary">
                      Next Scheduled Increment: +{activeSchedule.increment_value}%
                    </p>
                    <p className="text-text-muted">
                      Effective on{" "}
                      <strong>
                        {new Date(activeSchedule.next_increment_date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </strong>{" "}
                      (Projected rent:{" "}
                      {formatINR(Math.round(rentRupees * (1 + activeSchedule.increment_value / 100)))})
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="p-6 text-center text-xs text-text-muted">
            No active tenancy found. If your landlord invited you, please ask them for your direct invitation link.
          </Card>
        )}
      </div>
    </TenantShell>
  );
}
