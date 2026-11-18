"use client";

import { useEffect, useRef, useState } from "react";

const features = [
  {
    number: "01",
    title: "Automated Monthly Rent & Variable Invoicing",
    description: "Scheduled batch generation of recurring monthly rent with manual variable utility inputs (BESCOM electricity, water tankers, maintenance charges) calculated in exact 64-bit integer paise with zero floating-point error.",
    visual: "billing",
  },
  {
    number: "02",
    title: "Split-Screen UPI Verification & UTR Deduplication",
    description: "Two-step guided UPI payment flow with dynamic QR intent (PhonePe, GPay, Paytm, BHIM). Owners review payment screenshots side-by-side with bank references, backed by strict 12-digit UTR uniqueness constraints.",
    visual: "upi",
  },
  {
    number: "03",
    title: "Overlap-Free Tenancies & Annual Escalations",
    description: "PostgreSQL GiST temporal exclusion constraints prevent accidental unit double-booking. Set automatic annual rent increment schedules (e.g. 5% or 10%) that apply on exact lease anniversary dates.",
    visual: "tenancy",
  },
  {
    number: "04",
    title: "Maintenance Ticket Lifecycle & Contractor Expense Tracking",
    description: "Tenants report plumbing, electrical, and structural issues with private photo uploads. Owners manage contractor quotes, approve repairs, track paise expenses against monthly yields, and log status milestones.",
    visual: "maintenance",
  },
];

function BillingVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full text-foreground">
      <defs>
        <clipPath id="billingClip">
          <rect x="30" y="20" width="140" height="120" rx="6" />
        </clipPath>
      </defs>
      
      {/* Invoice Container */}
      <rect x="30" y="20" width="140" height="120" rx="6" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.8" />
      
      {/* Header bar */}
      <line x1="30" y1="46" x2="170" y2="46" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <rect x="42" y="28" width="40" height="8" rx="2" fill="currentColor" opacity="0.6" />
      <rect x="135" y="28" width="22" height="8" rx="2" fill="currentColor" opacity="0.4" />
      
      {/* Animated ledger line-items */}
      <g clipPath="url(#billingClip)">
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect
              x="42"
              y={56 + i * 18}
              width="65"
              height="8"
              rx="2"
              fill="currentColor"
              opacity="0.2"
            >
              <animate
                attributeName="opacity"
                values="0.2;0.65;0.2"
                dur="2.4s"
                begin={`${i * 0.25}s`}
                repeatCount="indefinite"
              />
            </rect>
            <rect
              x="125"
              y={56 + i * 18}
              width="32"
              height="8"
              rx="2"
              fill="currentColor"
              opacity="0.25"
            >
              <animate
                attributeName="opacity"
                values="0.25;0.85;0.25"
                dur="2.4s"
                begin={`${i * 0.25}s`}
                repeatCount="indefinite"
              />
            </rect>
          </g>
        ))}
      </g>
      
      {/* Total row highlight */}
      <line x1="42" y1="126" x2="157" y2="126" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
      <text x="44" y="136" fontSize="7" fontFamily="monospace" fill="currentColor" opacity="0.6">TOTAL ₹</text>
      <text x="130" y="136" fontSize="7" fontFamily="monospace" fill="currentColor" fontWeight="bold">₹28,500</text>
    </svg>
  );
}

function UPIVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full text-foreground">
      {/* QR & Bank Verification Gateway */}
      <rect x="36" y="28" width="56" height="56" rx="6" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.7" />
      <rect x="46" y="38" width="14" height="14" fill="currentColor" opacity="0.8" />
      <rect x="68" y="38" width="14" height="14" fill="currentColor" opacity="0.5" />
      <rect x="46" y="60" width="14" height="14" fill="currentColor" opacity="0.5" />
      <rect x="68" y="60" width="14" height="14" fill="currentColor" opacity="0.8" />
      
      {/* Verification Shield / Status Badge */}
      <g transform="translate(112, 34)">
        <circle cx="28" cy="24" r="22" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.7" />
        <path
          d="M 18 24 L 25 31 L 38 17"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <animate attributeName="stroke-dashoffset" values="40;0" dur="2s" repeatCount="indefinite" />
        </path>
      </g>
      
      {/* UTR Deduplication Bar */}
      <g transform="translate(36, 102)">
        <rect x="0" y="0" width="128" height="30" rx="5" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <text x="10" y="19" fontSize="9" fontFamily="monospace" fill="currentColor" opacity="0.8">
          UTR: 431289012389
        </text>
        <circle cx="114" cy="15" r="4" fill="currentColor" opacity="0.8">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  );
}

function TenancyVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full text-foreground">
      {/* Calendar Timeline Grid */}
      <rect x="30" y="30" width="140" height="100" rx="6" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.7" />
      
      {/* Lease blocks on timeline */}
      <rect x="40" y="45" width="70" height="22" rx="4" fill="currentColor" opacity="0.25">
        <animate attributeName="opacity" values="0.25;0.55;0.25" dur="3s" repeatCount="indefinite" />
      </rect>
      <text x="46" y="59" fontSize="8" fontFamily="monospace" fill="currentColor" opacity="0.8">TENANCY A</text>
      
      <rect x="115" y="45" width="45" height="22" rx="4" fill="currentColor" opacity="0.4">
        <animate attributeName="opacity" values="0.4;0.7;0.4" dur="3s" begin="1.5s" repeatCount="indefinite" />
      </rect>
      <text x="120" y="59" fontSize="8" fontFamily="monospace" fill="currentColor">TENANCY B</text>
      
      {/* Non-overlapping divider constraint (GiST) */}
      <line x1="112" y1="40" x2="112" y2="72" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2" />
      
      {/* Annual Increment Curve */}
      <path
        d="M 40 110 Q 90 102 120 92 T 160 82"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="160" cy="82" r="4" fill="currentColor" />
      <text x="124" y="118" fontSize="8" fontFamily="monospace" fill="currentColor" opacity="0.7">+5% / YR</text>
    </svg>
  );
}

function MaintenanceVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full text-foreground">
      {/* Maintenance Ticket Modal */}
      <rect x="35" y="24" width="130" height="112" rx="6" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.8" />
      
      {/* Photo attachment placeholder */}
      <rect x="45" y="36" width="42" height="36" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <path d="M 45 62 L 58 50 L 70 60 L 80 54 L 87 62" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      <circle cx="56" cy="46" r="3" fill="currentColor" opacity="0.6" />
      
      {/* Status progression badges */}
      <g transform="translate(96, 36)">
        <rect x="0" y="0" width="60" height="10" rx="2" fill="currentColor" opacity="0.2" />
        <rect x="0" y="14" width="50" height="10" rx="2" fill="currentColor" opacity="0.4" />
        <rect x="0" y="28" width="55" height="10" rx="2" fill="currentColor" opacity="0.7" />
      </g>
      
      {/* Contractor expense row */}
      <line x1="45" y1="84" x2="155" y2="84" stroke="currentColor" strokeWidth="1" opacity="0.25" />
      <text x="46" y="98" fontSize="8" fontFamily="monospace" fill="currentColor" opacity="0.7">REPAIR: PLUMBING</text>
      <text x="46" y="114" fontSize="8" fontFamily="monospace" fill="currentColor" opacity="0.5">COST: ₹1,850 · LOGGED</text>
      
      {/* Pulse check */}
      <circle cx="148" cy="108" r="5" fill="currentColor" opacity="0.8">
        <animate attributeName="r" values="3;6;3" dur="1.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1.8s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function AnimatedVisual({ type }: { type: string }) {
  switch (type) {
    case "billing":
      return <BillingVisual />;
    case "upi":
      return <UPIVisual />;
    case "tenancy":
      return <TenancyVisual />;
    case "maintenance":
      return <MaintenanceVisual />;
    default:
      return <BillingVisual />;
  }
}

function FeatureCard({ feature, index }: { feature: typeof features[0]; index: number }) {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.15 }
    );

    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={cardRef}
      className={`group relative transition-all duration-700 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
      }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-16 py-12 lg:py-20 border-b border-foreground/10">
        {/* Number */}
        <div className="shrink-0">
          <span className="font-mono text-sm text-muted-foreground">{feature.number}</span>
        </div>
        
        {/* Content */}
        <div className="flex-1 grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <h3 className="text-2xl lg:text-3xl font-display mb-4 group-hover:translate-x-2 transition-transform duration-500">
              {feature.title}
            </h3>
            <p className="text-base lg:text-lg text-muted-foreground leading-relaxed">
              {feature.description}
            </p>
          </div>
          
          {/* Visual */}
          <div className="flex justify-center lg:justify-end">
            <div className="w-56 h-44 text-foreground">
              <AnimatedVisual type={feature.visual} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FeaturesSection() {
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

  return (
    <section
      id="features"
      ref={sectionRef}
      className="relative py-24 lg:py-32"
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="mb-16 lg:mb-24">
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
            <span className="w-8 h-px bg-foreground/30" />
            Core Capabilities
          </span>
          <h2
            className={`text-4xl lg:text-6xl font-display tracking-tight transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            Everything landlords need.
            <br />
            <span className="text-muted-foreground">Zero mock spreadsheets. Zero guesswork.</span>
          </h2>
        </div>

        {/* Features List */}
        <div>
          {features.map((feature, index) => (
            <FeatureCard key={feature.number} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
