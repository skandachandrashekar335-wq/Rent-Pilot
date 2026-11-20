"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { AnimatedWave } from "./animated-wave";

interface FooterLink {
  name: string;
  href: string;
  external?: boolean;
  badge?: string;
}

const footerLinks: Record<string, FooterLink[]> = {
  Capabilities: [
    { name: "Property Management", href: "#capabilities" },
    { name: "Monthly Billing", href: "#capabilities" },
    { name: "UPI Payment Tracking", href: "#how-it-works" },
    { name: "Maintenance Requests", href: "#capabilities" },
  ],
  Portals: [
    { name: "Owner Dashboard", href: "/dashboard/owner" },
    { name: "Tenant Portal", href: "/portal" },
    { name: "Sign In", href: "/login" },
  ],
  Platform: [
    { name: "Security & Privacy", href: "#security" },
    { name: "System Health API", href: "/api/health", external: true },
  ],
  Legal: [
    { name: "Privacy Policy", href: "#security" },
    { name: "Terms of Service", href: "#security" },
  ],
};

export function FooterSection() {
  return (
    <footer className="relative border-t border-foreground/10 bg-background overflow-hidden">
      {/* Animated wave background */}
      <div className="absolute inset-0 h-64 opacity-15 pointer-events-none overflow-hidden select-none">
        <AnimatedWave />
      </div>
      
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Main Footer */}
        <div className="py-16 lg:py-24">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-10 lg:gap-8">
            {/* Brand Column */}
            <div className="col-span-2">
              <Link href="/" className="inline-flex items-center gap-2 mb-5 group">
                <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-foreground text-background font-bold text-sm">
                  ◈
                </span>
                <span className="text-2xl font-display text-foreground">RentPilot</span>
                <span className="text-[11px] text-muted-foreground font-mono">₹ IN</span>
              </Link>

              <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-sm">
                A practical rental management platform for property owners, independent landlords, and tenants in India. Simple monthly billing, UPI payment tracking, and digital records.
              </p>

              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>PostgreSQL & Firebase Auth · End-to-End Secure</span>
              </div>
            </div>

            {/* Link Columns */}
            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-5">{title}</h3>
                <ul className="space-y-3">
                  {links.map((link) => (
                    <li key={link.name}>
                      <Link
                        href={link.href}
                        target={link.external ? "_blank" : undefined}
                        className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5 group"
                      >
                        {link.name}
                        {link.external && (
                          <ArrowUpRight className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                        )}
                        {"badge" in link && link.badge && (
                          <span className="text-[10px] font-mono px-2 py-0.5 bg-foreground/10 text-foreground rounded-full">
                            {link.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="py-8 border-t border-foreground/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            © 2026 RentPilot. Built for Indian residential property management.
          </p>

          <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              All systems operational
            </span>
            <span className="text-foreground/20">|</span>
            <span>Asia/Kolkata (IST)</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
