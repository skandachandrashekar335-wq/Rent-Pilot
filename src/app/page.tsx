"use client";

import React from "react";
import Link from "next/link";
import { Building2, User, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function RootGatewayPage() {

  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      {/* Top Bar */}
      <header className="h-16 border-b border-border bg-surface/80 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center h-8 w-8 rounded-md bg-primary text-primary-foreground font-bold text-sm">
            ◈
          </span>
          <span className="font-semibold text-lg tracking-tight text-text-primary">
            RentPilot
          </span>
          <Badge variant="outline" className="hidden sm:inline-flex text-[11px] font-mono ml-2">
            Family Rental Operations
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12 sm:py-16 flex flex-col justify-center">
        <div className="text-center space-y-3 mb-10">
          <Badge variant="paid" className="mx-auto">
            <ShieldCheck className="h-3.5 w-3.5 mr-1" />
            Stage A Foundation Active
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary">
            Rental Operations & Billing Command
          </h1>
          <p className="text-sm sm:text-base text-text-muted max-w-xl mx-auto">
            Secure property management, manual variable charges, idempotent UPI payment verification, and tenant self-service portal.
          </p>
        </div>

        {/* Dual-Portal Entry Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Landlord Command Center */}
          <Card className="hover:border-primary/60 transition-colors flex flex-col justify-between">
            <CardHeader className="space-y-2">
              <div className="h-10 w-10 rounded-md bg-surface-muted flex items-center justify-center text-primary border border-border/40">
                <Building2 className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">Owner Command Center</CardTitle>
              <CardDescription>
                Full administrative oversight: properties, tenant contracts, billing cycle prep, and split-screen UPI proof verification.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="text-xs text-text-muted space-y-1">
                <p>• 4 Unified Navigation Hubs</p>
                <p>• Offline Cash / Bank Payment Recording</p>
                <p>• Anti-AI-slop High Information Density</p>
              </div>
              <Link href="/dashboard/owner" className="block w-full pt-2">
                <Button className="w-full justify-between">
                  <span>Enter Owner Dashboard</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Tenant Self-Service Portal */}
          <Card className="hover:border-primary/60 transition-colors flex flex-col justify-between">
            <CardHeader className="space-y-2">
              <div className="h-10 w-10 rounded-md bg-surface-muted flex items-center justify-center text-primary border border-border/40">
                <User className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">Tenant Self-Service Portal</CardTitle>
              <CardDescription>
                Mobile-first utility: view itemized monthly rent, two-step guided UPI payment with QR, reference upload, and repair tickets.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="text-xs text-text-muted space-y-1">
                <p>• 390px Mobile Touch Optimized (44px targets)</p>
                <p>• Two-step Guided UPI Intent / QR Flow</p>
                <p>• Instant English, Kannada & Hindi Switching</p>
              </div>
              <Link href="/portal" className="block w-full pt-2">
                <Button variant="outline" className="w-full justify-between">
                  <span>Enter Tenant Portal</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* System Safeguards Footer */}
        <div className="mt-12 pt-6 border-t border-border/40 text-center text-xs text-text-muted">
          <p className="font-mono text-[11px]">
            RentPilot Architecture: Next.js 15 · TypeScript · Tailwind CSS · Supabase RLS · Firebase Auth · Brevo
          </p>
          <p className="mt-1 text-[11px]">
            Targeting ₹0 operating cost · Strictly no mock transactions presented as real
          </p>
        </div>
      </main>
    </div>
  );
}
