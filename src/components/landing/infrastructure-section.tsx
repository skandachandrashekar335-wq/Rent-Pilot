"use client";

import { useEffect, useState, useRef } from "react";

const locations = [
  { city: "Bengaluru", region: "Karnataka Core", latency: "12ms" },
  { city: "Mumbai", region: "Supabase ap-south-1", latency: "18ms" },
  { city: "Chennai", region: "Tamil Nadu Edge", latency: "16ms" },
  { city: "Hyderabad", region: "Telangana Edge", latency: "22ms" },
  { city: "Delhi NCR", region: "North India Hub", latency: "28ms" },
  { city: "Kolkata", region: "East India Edge", latency: "34ms" },
];

export function InfrastructureSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [activeLocation, setActiveLocation] = useState(0);
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

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveLocation((prev) => (prev + 1) % locations.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden border-b border-foreground/10">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Left: Content */}
          <div
            className={`transition-all duration-700 ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
            }`}
          >
            <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
              <span className="w-8 h-px bg-foreground/30" />
              Indian Cloud Infrastructure
            </span>
            <h2 className="text-4xl lg:text-6xl font-display tracking-tight mb-8">
              Low-latency across
              <br />
              the subcontinent.
            </h2>
            <p className="text-lg lg:text-xl text-muted-foreground leading-relaxed mb-12">
              Hosted in Mumbai (AWS/Supabase <span className="font-mono text-foreground font-semibold">ap-south-1</span>) with Next.js 15 Edge delivery across India, ensuring instant mobile access for landlords in Indiranagar and tenants across Bengaluru, Hyderabad, and Delhi.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 sm:gap-8">
              <div>
                <div className="text-3xl sm:text-4xl lg:text-5xl font-display mb-1 text-foreground">ap-south-1</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Mumbai region</div>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl lg:text-5xl font-display mb-1 text-foreground">99.9%</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Uptime target</div>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl lg:text-5xl font-display mb-1 text-foreground">&lt;30ms</div>
                <div className="text-xs sm:text-sm text-muted-foreground">India latency</div>
              </div>
            </div>
          </div>

          {/* Right: Location list */}
          <div
            className={`transition-all duration-700 delay-200 ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
            }`}
          >
            <div className="border border-foreground/15 rounded-xl overflow-hidden bg-background shadow-sm">
              {/* Header */}
              <div className="px-6 py-4 border-b border-foreground/10 flex items-center justify-between bg-foreground/[0.02]">
                <span className="text-sm font-mono text-muted-foreground">Subcontinent Network Routing</span>
                <span className="flex items-center gap-2 text-xs font-mono text-emerald-600 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  All nodes active
                </span>
              </div>

              {/* Locations */}
              <div>
                {locations.map((location, index) => (
                  <div
                    key={location.city}
                    className={`px-6 py-4 border-b border-foreground/5 last:border-b-0 flex items-center justify-between transition-all duration-300 ${
                      activeLocation === index ? "bg-foreground/[0.04]" : ""
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span 
                        className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
                          activeLocation === index ? "bg-foreground" : "bg-foreground/20"
                        }`}
                      />
                      <div>
                        <div className="font-medium text-foreground">{location.city}</div>
                        <div className="text-xs text-muted-foreground">{location.region}</div>
                      </div>
                    </div>
                    <span className="font-mono text-xs sm:text-sm text-muted-foreground">{location.latency}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
