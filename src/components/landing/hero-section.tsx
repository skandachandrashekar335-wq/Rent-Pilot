"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, QrCode } from "lucide-react";
import { AnimatedSphere } from "./animated-sphere";

const words = ["automate", "reconcile", "collect", "simplify"];

export function HeroSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % words.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-[92vh] flex flex-col justify-center overflow-hidden pt-24 pb-20">
      {/* Animated sphere background */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] md:w-[680px] md:h-[680px] lg:w-[840px] lg:h-[840px] opacity-40 pointer-events-none select-none">
        <AnimatedSphere />
      </div>
      
      {/* Subtle grid lines */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        {[...Array(8)].map((_, i) => (
          <div
            key={`h-${i}`}
            className="absolute h-px bg-foreground/15"
            style={{
              top: `${12.5 * (i + 1)}%`,
              left: 0,
              right: 0,
            }}
          />
        ))}
        {[...Array(12)].map((_, i) => (
          <div
            key={`v-${i}`}
            className="absolute w-px bg-foreground/15"
            style={{
              left: `${8.33 * (i + 1)}%`,
              top: 0,
              bottom: 0,
            }}
          />
        ))}
      </div>
      
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12 py-16 lg:py-24">
        {/* Eyebrow */}
        <div 
          className={`mb-8 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground bg-foreground/[0.03] px-3.5 py-1 rounded-full border border-foreground/10">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Precision Rental Operations & UPI Settlement for India
          </span>
        </div>
        
        {/* Main headline */}
        <div className="mb-10 max-w-4xl">
          <h1 
            className={`text-[clamp(2.8rem,8.5vw,7.5rem)] font-display leading-[0.93] tracking-tight transition-all duration-1000 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <span className="block">The platform</span>
            <span className="block">
              to{" "}
              <span className="relative inline-block">
                <span 
                  key={wordIndex}
                  className="inline-flex"
                >
                  {words[wordIndex].split("").map((char, i) => (
                    <span
                      key={`${wordIndex}-${i}`}
                      className="inline-block animate-char-in"
                      style={{
                        animationDelay: `${i * 45}ms`,
                      }}
                    >
                      {char}
                    </span>
                  ))}
                </span>
                <span className="absolute -bottom-2 left-0 right-0 h-3 bg-foreground/10" />
              </span>
            </span>
            <span className="block text-muted-foreground/80 mt-1">rental operations.</span>
          </h1>
        </div>
        
        {/* Description & CTAs */}
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-20 items-end">
          <p 
            className={`text-lg lg:text-xl text-muted-foreground leading-relaxed max-w-xl transition-all duration-700 delay-200 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            Automated ₹ INR monthly rent ledgers, 1-click UPI screenshot proof verification with UTR deduplication, WhatsApp tenant onboarding, and maintenance tracking with zero arithmetic drift.
          </p>
          
          {/* CTAs */}
          <div 
            className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-4 transition-all duration-700 delay-300 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <Link href="/dashboard/owner">
              <Button 
                size="lg" 
                className="w-full sm:w-auto bg-foreground hover:bg-foreground/90 text-background px-8 h-14 text-base rounded-full group cursor-pointer"
              >
                Enter Owner Dashboard
                <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link href="/portal">
              <Button 
                size="lg" 
                variant="outline" 
                className="w-full sm:w-auto h-14 px-8 text-base rounded-full border-foreground/20 hover:bg-foreground/5 cursor-pointer"
              >
                <QrCode className="w-4 h-4 mr-2 opacity-70" />
                Tenant Portal
              </Button>
            </Link>
          </div>
        </div>
        
      </div>
      
      {/* Stats marquee - full width outside container */}
      <div 
        className={`mt-12 lg:mt-16 w-full border-y border-foreground/10 py-5 bg-background/50 backdrop-blur-sm transition-all duration-700 delay-500 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex gap-16 marquee whitespace-nowrap">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex gap-16">
              {[
                { value: "₹0", label: "rounding drift", sub: "INTEGER PAISE PRECISION" },
                { value: "15-min", label: "signed URLs", sub: "PRIVATE S3 RECEIPT STORAGE" },
                { value: "3", label: "languages supported", sub: "ENGLISH · ಕನ್ನಡ · हिन्दी" },
                { value: "100%", label: "overlap-free", sub: "POSTGRESQL GIST CONSTRAINTS" },
                { value: "12-digit", label: "UTR validation", sub: "NPCI BANK PROOF DEDUPLICATION" },
              ].map((stat) => (
                <div key={`${stat.sub}-${i}`} className="flex items-baseline gap-4">
                  <span className="text-3xl lg:text-4xl font-display">{stat.value}</span>
                  <span className="text-xs text-muted-foreground">
                    {stat.label}
                    <span className="block font-mono text-[10px] mt-0.5 tracking-wider text-foreground/50">{stat.sub}</span>
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      
    </section>
  );
}
