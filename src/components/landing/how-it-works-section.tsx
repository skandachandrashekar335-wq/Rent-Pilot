"use client";

import { useEffect, useRef, useState } from "react";

const steps = [
  {
    number: "I",
    title: "Add Property & Onboard Tenants",
    description: "Define multi-unit apartment complexes or independent floors, assign tenancy leases with PostgreSQL GiST non-overlap guarantees, and dispatch WhatsApp invite tokens with instant trilingual onboarding.",
    code: `import { rentpilot } from '@rentpilot/core'

// 1. Configure property & active units
const property = await rentpilot.properties.create({
  name: 'Indiranagar Residency',
  type: 'multi_unit',
  units: [
    { name: 'Unit 201', baseRentPaise: 2800000n },
    { name: 'Unit 202', baseRentPaise: 3200000n }
  ]
})

// 2. Dispatch expiring WhatsApp tenant invite
await rentpilot.invitations.sendWhatsApp({
  phone: '+91 98800 12345',
  unitId: property.units[0].id
})`,
  },
  {
    number: "II",
    title: "Generate Monthly INR Invoices",
    description: "Automated 1st-of-month billing batches automatically compute recurring rent, apply annual percentage escalations, and allow manual utility charge entry (BESCOM power, water tankers) with 64-bit integer paise precision.",
    code: `// Automated 1st-of-month billing run
const batch = await rentpilot.billing.prepareCycle({
  monthYear: '2026-12',
  utilityCharges: [
    { unitId: 'u_201', type: 'BESCOM_POWER', amountPaise: 185000n },
    { unitId: 'u_201', type: 'WATER_TANKER', amountPaise: 65000n }
  ]
})

// Immutable invoice generated with ₹0 rounding drift
const invoice = await batch.finalize({ notifyTenant: true })`,
  },
  {
    number: "III",
    title: "Verify UPI & Issue Signed Receipts",
    description: "Tenants pay via PhonePe, GPay, Paytm, or BHIM using dynamic UPI intent QR codes. Landlords inspect the screenshot proof split-screen, verify the 12-digit UTR, and release private 15-minute signed PDF receipts.",
    code: `// Landlord split-screen UTR verification
const payment = await rentpilot.payments.reconcileUTR({
  invoiceId: invoice.id,
  utrNumber: '431289012389',
  amountPaidPaise: 3050000n,
  proofBucket: 'payment-proofs'
})

// Issues private 15-minute signed PDF receipt
const receiptUrl = await payment.generateSignedReceiptUrl({
  expiresInSeconds: 900
})
// Verified · Sent via Email & WhatsApp in IST`,
  },
];

export function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="relative py-24 lg:py-32 bg-foreground text-background overflow-hidden"
    >
      {/* Diagonal lines pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 40px,
            currentColor 40px,
            currentColor 41px
          )`
        }} />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="mb-16 lg:mb-24">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-background/50 mb-6">
            <span className="w-8 h-px bg-background/30" />
            Operational Lifecycle
          </span>
          <h2
            className={`text-4xl lg:text-6xl font-display tracking-tight transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            Three steps.
            <br />
            <span className="text-background/50">Zero spreadsheet reconciliation chaos.</span>
          </h2>
        </div>

        {/* Main content */}
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24">
          {/* Steps */}
          <div className="space-y-0">
            {steps.map((step, index) => (
              <button
                key={step.number}
                type="button"
                onClick={() => setActiveStep(index)}
                className={`w-full text-left py-8 border-b border-background/10 transition-all duration-500 group cursor-pointer ${
                  activeStep === index ? "opacity-100" : "opacity-40 hover:opacity-75"
                }`}
              >
                <div className="flex items-start gap-6">
                  <span className="font-display text-3xl text-background/40">{step.number}</span>
                  <div className="flex-1">
                    <h3 className="text-2xl lg:text-3xl font-display mb-3 group-hover:translate-x-2 transition-transform duration-300">
                      {step.title}
                    </h3>
                    <p className="text-background/70 text-base leading-relaxed">
                      {step.description}
                    </p>
                    
                    {/* Progress indicator */}
                    {activeStep === index && (
                      <div className="mt-4 h-0.5 bg-background/20 overflow-hidden rounded-full">
                        <div 
                          className="h-full bg-background w-0"
                          style={{
                            animation: 'progress 6s linear forwards'
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Code display */}
          <div className="lg:sticky lg:top-32 self-start">
            <div className="border border-background/15 rounded-xl bg-background/[0.04] backdrop-blur-md overflow-hidden">
              {/* Window header */}
              <div className="px-6 py-4 border-b border-background/10 flex items-center justify-between">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                </div>
                <span className="text-xs font-mono text-background/50">rentpilot-engine.ts</span>
              </div>

              {/* Code content */}
              <div className="p-6 md:p-8 font-mono text-xs md:text-sm min-h-[300px] overflow-x-auto">
                <pre className="text-background/80">
                  {steps[activeStep].code.split('\n').map((line, lineIndex) => (
                    <div 
                      key={`${activeStep}-${lineIndex}`} 
                      className="leading-relaxed code-line-reveal"
                      style={{ 
                        animationDelay: `${lineIndex * 40}ms`,
                      }}
                    >
                      <span className="text-background/25 select-none w-6 inline-block text-right mr-4">{lineIndex + 1}</span>
                      <span className="inline-flex">
                        {line.split('').map((char, charIndex) => (
                          <span
                            key={`${activeStep}-${lineIndex}-${charIndex}`}
                            className="code-char-reveal"
                            style={{
                              animationDelay: `${lineIndex * 40 + charIndex * 8}ms`,
                            }}
                          >
                            {char === ' ' ? '\u00A0' : char}
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
                </pre>
              </div>

              {/* Status */}
              <div className="px-6 py-3.5 border-t border-background/10 flex items-center justify-between text-xs font-mono text-background/60">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>State: Deterministic ACID Execution</span>
                </div>
                <span>IST +05:30</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        
        .code-line-reveal {
          opacity: 0;
          transform: translateX(-6px);
          animation: lineReveal 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        
        @keyframes lineReveal {
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .code-char-reveal {
          opacity: 0;
          filter: blur(4px);
          animation: charReveal 0.25s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        
        @keyframes charReveal {
          to {
            opacity: 1;
            filter: blur(0);
          }
        }
      `}</style>
    </section>
  );
}
