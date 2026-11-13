"use client";

import React from "react";
import { TenantShell } from "@/components/layout/tenant-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Globe, Home } from "lucide-react";
import { useTranslation } from "@/components/layout/locale-context";

export default function TenantProfilePage() {
  const { t, locale, setLocale } = useTranslation();

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

        {/* Tenancy Details Card */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Home className="h-4 w-4 text-primary" />
              <span>Tenancy Agreement</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-text-muted">Tenant Name:</span>
              <span className="font-medium text-text-primary">Rahul Sharma</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-text-muted">Unit Assigned:</span>
              <span className="font-medium text-text-primary">Green Villa · U-201</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-text-muted">Contract Rent:</span>
              <span className="font-mono font-medium text-text-primary">₹16,000 / month</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-text-muted">Deposit Paid:</span>
              <span className="font-mono font-medium text-text-primary">₹80,000 (Refundable)</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-text-muted">Landlord:</span>
              <span className="font-medium text-text-primary">Skanda Chandrashekar</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </TenantShell>
  );
}
