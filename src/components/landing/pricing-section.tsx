"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

const plans = [
  {
    name: "Family Landlord",
    description: "Designed for independent owners managing up to 5 rental units",
    price: { monthly: 0, annual: 0 },
    features: [
      "Up to 5 rental units",
      "Exact integer paise billing ledger",
      "Two-step guided UPI QR payments",
      "Split-screen UTR proof verification",
      "15-minute signed PDF rent receipts",
      "Trilingual portal (English, ಕನ್ನಡ, हिन्दी)",
      "WhatsApp invitation sharing",
    ],
    cta: "Start Free Forever",
    popular: false,
    href: "/login",
  },
  {
    name: "Growing Owner",
    description: "For owners and families managing entire apartment blocks (up to 25 units)",
    price: { monthly: 499, annual: 399 },
    features: [
      "Up to 25 rental units",
      "Everything in Family Landlord",
      "Automated Brevo email notifications",
      "Contractor expense & maintenance tracking",
      "Automated annual percentage increments",
      "Overdue reminder tracking queue",
      "CSV & encrypted JSON ledger backups",
    ],
    cta: "Start 14-Day Free Trial",
    popular: true,
    href: "/login",
  },
  {
    name: "Portfolio Estates",
    description: "For commercial property groups and large residential developments",
    price: { monthly: null, annual: null },
    features: [
      "Unlimited units & multiple buildings",
      "Everything in Growing Owner",
      "Multi-manager organization RBAC",
      "Custom WhatsApp business API sender",
      "Automated off-site database snapshot replication",
      "Dedicated onboarding in Bengaluru",
      "SLA & phone support priority",
    ],
    cta: "Contact Operations",
    popular: false,
    href: "/login",
  },
];

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    <section id="pricing" className="relative py-24 lg:py-36 border-t border-foreground/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="max-w-3xl mb-16 lg:mb-20">
          <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase block mb-4">
            Transparent Pricing
          </span>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl tracking-tight text-foreground mb-6">
            Simple, honest pricing.
            <br />
            <span className="text-stroke">Zero hidden commission.</span>
          </h2>
          <p className="text-base lg:text-lg text-muted-foreground max-w-xl">
            We charge zero percentage commission on rent collected. 100% of tenant UPI payments transfer directly into your personal bank account.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center gap-4 mb-14">
          <span
            className={`text-sm font-medium transition-colors ${
              !isAnnual ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            Monthly
          </span>
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            className="relative w-14 h-7 bg-foreground/15 rounded-full p-1 transition-colors hover:bg-foreground/25 cursor-pointer"
            aria-label="Toggle annual or monthly pricing"
          >
            <div
              className={`w-5 h-5 bg-foreground rounded-full transition-transform duration-300 ${
                isAnnual ? "translate-x-7" : "translate-x-0"
              }`}
            />
          </button>
          <span
            className={`text-sm font-medium transition-colors ${
              isAnnual ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            Annual Billing
          </span>
          {isAnnual && (
            <span className="ml-2 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-mono font-medium">
              Save 20%
            </span>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-px bg-foreground/15 border border-foreground/15 rounded-2xl overflow-hidden shadow-sm">
          {plans.map((plan, idx) => (
            <div
              key={plan.name}
              className={`relative p-8 lg:p-10 bg-background flex flex-col justify-between ${
                plan.popular ? "md:bg-foreground/[0.02]" : ""
              }`}
            >
              <div>
                {plan.popular && (
                  <span className="inline-block mb-4 px-3 py-1 rounded-full bg-foreground text-background text-[11px] font-mono uppercase tracking-wider font-semibold">
                    Most Popular
                  </span>
                )}

                {/* Plan Header */}
                <div className="mb-6">
                  <span className="font-mono text-xs text-muted-foreground">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-display text-2xl lg:text-3xl text-foreground mt-1">{plan.name}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">{plan.description}</p>
                </div>

                {/* Price */}
                <div className="mb-8 pb-6 border-b border-foreground/10">
                  {plan.price.monthly !== null ? (
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-display text-4xl lg:text-5xl text-foreground font-semibold">
                        ₹{isAnnual ? plan.price.annual : plan.price.monthly}
                      </span>
                      <span className="text-xs sm:text-sm text-muted-foreground">/ month</span>
                    </div>
                  ) : (
                    <span className="font-display text-3xl lg:text-4xl text-foreground">Custom</span>
                  )}
                  {plan.price.monthly === 0 && (
                    <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-1">₹0 forever · No credit card</p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3.5 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                      <span className="text-xs sm:text-sm text-foreground/80 leading-snug">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA */}
              <Link href={plan.href} className="w-full block">
                <button
                  className={`w-full py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all group cursor-pointer ${
                    plan.popular
                      ? "bg-foreground text-background hover:bg-foreground/90 shadow-xs"
                      : "border border-foreground/20 text-foreground hover:bg-foreground/5"
                  }`}
                >
                  {plan.cta}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              </Link>
            </div>
          ))}
        </div>

        {/* Bottom Note */}
        <p className="mt-10 text-center text-xs sm:text-sm text-muted-foreground">
          All tiers include trilingual support (EN / ಕನ್ನಡ / हिन्दी), HTTPS encryption, and automatic IST date calculations.
        </p>
      </div>
    </section>
  );
}
