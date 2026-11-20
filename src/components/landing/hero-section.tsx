"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, QrCode } from "lucide-react";
import { AnimatedSphere } from "./animated-sphere";

export function HeroSection() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <section className="relative min-h-[88vh] flex flex-col justify-center overflow-hidden pt-24 pb-16 lg:pb-24">
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
          <span className="inline-flex items-center gap-2.5 text-xs font-mono uppercase tracking-widest text-muted-foreground bg-foreground/[0.03] px-3.5 py-1.5 rounded-full border border-foreground/10">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Rental & Property Management
          </span>
        </div>
        
        {/* Main headline */}
        <div className="mb-10 max-w-4xl">
          <h1 
            className={`text-[clamp(2.6rem,7.5vw,6.5rem)] font-display leading-[0.96] tracking-tight transition-all duration-1000 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <span className="block">Rental management,</span>
            <span className="block text-muted-foreground/80 mt-1">
              without the monthly chaos.
            </span>
          </h1>
        </div>
        
        {/* Description & CTAs */}
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-20 items-end">
          <p 
            className={`text-lg lg:text-xl text-muted-foreground leading-relaxed max-w-xl transition-all duration-700 delay-200 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            Manage your properties, organise tenant information, prepare monthly rent bills and keep track of payments — all in one place.
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
    </section>
  );
}
