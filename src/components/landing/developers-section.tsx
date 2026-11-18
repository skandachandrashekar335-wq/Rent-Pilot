"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Copy, Check, Activity, ArrowRight } from "lucide-react";

const codeExamples = [
  {
    label: "Billing Engine",
    code: `// Deterministic integer paise calculation (₹0 drift)
const baseRentPaise = 2800000n       // ₹28,000.00
const electricityPaise = 185000n    // ₹1,850.00 BESCOM meter
const waterTankerPaise = 65000n     // ₹650.00 pro-rata
const totalDuePaise = baseRentPaise + electricityPaise + waterTankerPaise

// Exactly 3050000n (₹30,500.00) without floating-point inaccuracies
await db.invoices.upsert({
  where: { tenancy_month: 'ten_201_2026_12' },
  create: { total_due_paise: totalDuePaise, status: 'issued' }
})`,
  },
  {
    label: "UTR Deduplication",
    code: `// Strict NPCI 12-digit UTR validation & deduplication
const normalizedUTR = input.utr.trim().toUpperCase()

if (!/^[A-Z0-9]{12}$/.test(normalizedUTR)) {
  throw new Error('INVALID_FORMAT: UTR must be exactly 12 alphanumeric characters')
}

// PostgreSQL unique constraint enforces cross-tenant deduplication
await db.payment_proofs.create({
  data: { utr_number: normalizedUTR, status: 'pending_verification' }
})`,
  },
  {
    label: "Reliability Heartbeat",
    code: `# GitHub Actions 48-Hour Heartbeat & Idempotent Trigger
curl -s -f -X GET https://rentpilot-nine.vercel.app/api/health \\
  -H "Authorization: Bearer $CRON_SECRET"

# Response:
# {
#   "status": "healthy",
#   "database": "connected",
#   "version": "1.0.0"
# }`,
  },
];

const features = [
  { 
    title: "Paise Integer Precision", 
    description: "All monetary values stored in BigInt paise to avoid IEEE-754 currency rounding bugs."
  },
  { 
    title: "PostgreSQL GiST Constraints", 
    description: "Exclusion constraints mathematically prevent overlapping lease dates on the same unit."
  },
  { 
    title: "Demand-Driven Recovery", 
    description: "Owner dashboard checks and executes overdue billing tasks automatically on login."
  },
  { 
    title: "Encrypted JSON Backup", 
    description: "Standalone CLI script dumps complete database snapshot for offsite disaster recovery."
  },
];

const codeAnimationStyles = `
  .dev-code-line {
    opacity: 0;
    transform: translateX(-6px);
    animation: devLineReveal 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
  
  @keyframes devLineReveal {
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  .dev-code-char {
    opacity: 0;
    filter: blur(6px);
    animation: devCharReveal 0.25s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
  
  @keyframes devCharReveal {
    to {
      opacity: 1;
      filter: blur(0);
    }
  }
`;

export function DevelopersSection() {
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeExamples[activeTab].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

  return (
    <section id="reliability" ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: codeAnimationStyles }} />
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          {/* Left: Content */}
          <div
            className={`transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
              <span className="w-8 h-px bg-foreground/30" />
              Audit-Grade Reliability
            </span>
            <h2 className="text-4xl lg:text-6xl font-display tracking-tight mb-8">
              Deterministic code.
              <br />
              <span className="text-muted-foreground">Flawless ledger math.</span>
            </h2>
            <p className="text-lg lg:text-xl text-muted-foreground mb-12 leading-relaxed">
              RentPilot is built like financial infrastructure. We eliminated floating-point currency representation, race conditions on duplicate UPI submissions, and tenancy date overlaps using PostgreSQL-native capabilities.
            </p>
            
            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {features.map((feature, index) => (
                <div
                  key={feature.title}
                  className={`p-5 rounded-xl border border-foreground/10 bg-background transition-all duration-500 shadow-xs ${
                    isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  }`}
                  style={{ transitionDelay: `${index * 50 + 200}ms` }}
                >
                  <h3 className="font-medium text-base mb-1.5 text-foreground">{feature.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
          
          {/* Right: Code block */}
          <div
            className={`lg:sticky lg:top-32 transition-all duration-700 delay-200 ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
            }`}
          >
            <div className="border border-foreground/15 rounded-xl overflow-hidden bg-background shadow-sm">
              {/* Tabs */}
              <div className="flex items-center border-b border-foreground/10 bg-foreground/[0.02]">
                {codeExamples.map((example, idx) => (
                  <button
                    key={example.label}
                    type="button"
                    onClick={() => setActiveTab(idx)}
                    className={`px-5 py-3.5 text-xs sm:text-sm font-mono transition-colors relative cursor-pointer ${
                      activeTab === idx
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {example.label}
                    {activeTab === idx && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
                    )}
                  </button>
                ))}
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-4 py-3.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  aria-label="Copy code"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
              
              {/* Code content */}
              <div className="p-6 md:p-8 font-mono text-xs sm:text-sm bg-foreground/[0.015] min-h-[260px] overflow-x-auto">
                <pre className="text-foreground/85">
                  {codeExamples[activeTab].code.split('\n').map((line, lineIndex) => (
                    <div 
                      key={`${activeTab}-${lineIndex}`} 
                      className="leading-relaxed dev-code-line"
                      style={{ animationDelay: `${lineIndex * 40}ms` }}
                    >
                      <span className="inline-flex">
                        {line.split('').map((char, charIndex) => (
                          <span
                            key={`${activeTab}-${lineIndex}-${charIndex}`}
                            className="dev-code-char"
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
            </div>
            
            {/* Live API Health Link */}
            <div className="mt-6 flex items-center justify-between text-xs sm:text-sm text-muted-foreground px-1">
              <Link 
                href="/api/health" 
                target="_blank"
                className="inline-flex items-center gap-1.5 text-foreground hover:underline font-mono"
              >
                <Activity className="w-4 h-4 text-emerald-500" />
                Inspect Live GET /api/health
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <span className="font-mono text-[11px]">Next.js 15 · PostgreSQL 15</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
