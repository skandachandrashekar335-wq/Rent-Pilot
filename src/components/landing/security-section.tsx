"use client";

import { useEffect, useState, useRef } from "react";
import { Shield, Lock, Eye, FileCheck } from "lucide-react";

const securityFeatures = [
  {
    icon: Shield,
    title: "Multi-Tenant Access Isolation",
    description: "Database security policies ensure that property owners and tenants can only access the records specifically belonging to them.",
  },
  {
    icon: Lock,
    title: "Private Document Storage",
    description: "Payment proofs, receipts, and maintenance photos are stored in private cloud storage and accessed only through time-limited secure links.",
  },
  {
    icon: Eye,
    title: "Duplicate Reference Checks",
    description: "Bank payment references and UTR numbers are verified against the existing ledger to prevent recording duplicate payments.",
  },
  {
    icon: FileCheck,
    title: "Verifiable Financial Records",
    description: "Every issued invoice, recorded offline payment, and verified settlement creates a permanent, timestamped entry in your financial history.",
  },
];

const certifications = [
  "Tenant Data Isolation",
  "Private Cloud Storage",
  "Google Authentication",
  "Duplicate Reference Checks",
  "Audit Ledger",
];

export function SecuritySection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

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
    <section id="security" ref={sectionRef} className="relative py-24 lg:py-32 bg-foreground/[0.02] border-y border-foreground/10 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24">
          {/* Left: Content */}
          <div
            className={`transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
              <span className="w-8 h-px bg-foreground/30" />
              Security & Data Privacy
            </span>
            <h2 className="text-4xl lg:text-6xl font-display tracking-tight mb-8">
              Built with privacy and
              <br />
              data integrity at the core.
            </h2>
            <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed mb-12">
              Your rental records, financial transactions, and tenant information are private. RentPilot ensures multi-tenant data isolation and secure document storage so your records remain strictly confidential.
            </p>

            {/* Invariant Badges */}
            <div className="flex flex-wrap gap-2.5">
              {certifications.map((cert, index) => (
                <span
                  key={cert}
                  className={`px-3.5 py-1.5 rounded-full border border-foreground/15 text-xs font-mono bg-background text-foreground transition-all duration-500 ${
                    isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  }`}
                  style={{ transitionDelay: `${index * 50 + 200}ms` }}
                >
                  {cert}
                </span>
              ))}
            </div>
          </div>

          {/* Right: Features */}
          <div className="grid gap-5">
            {securityFeatures.map((feature, index) => (
              <div
                key={feature.title}
                className={`p-6 border border-foreground/10 hover:border-foreground/30 rounded-xl bg-background transition-all duration-500 group shadow-xs ${
                  isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-11 h-11 rounded-lg flex items-center justify-center border border-foreground/15 bg-foreground/[0.03] group-hover:bg-foreground group-hover:text-background transition-colors duration-300">
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium mb-1 group-hover:translate-x-1 transition-transform duration-300">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
