"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, QrCode } from "lucide-react";
import { AnimatedTetrahedron } from "./animated-tetrahedron";

export function CtaSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.15 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <section ref={sectionRef} className="relative py-20 lg:py-32 overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div
          className={`relative border border-foreground/15 rounded-3xl overflow-hidden bg-background shadow-lg transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
          onMouseMove={handleMouseMove}
        >
          {/* Spotlight effect */}
          <div 
            className="absolute inset-0 opacity-15 pointer-events-none transition-opacity duration-300"
            style={{
              background: `radial-gradient(600px circle at ${mousePosition.x}% ${mousePosition.y}%, currentColor, transparent 40%)`
            }}
          />
          
          <div className="relative z-10 px-8 lg:px-16 py-16 lg:py-20">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
              {/* Left content */}
              <div className="flex-1">
                <span className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground mb-6 bg-foreground/[0.03] px-3.5 py-1.5 rounded-full border border-foreground/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Rental & Property Management
                </span>
                <h2 className="text-3xl sm:text-5xl lg:text-6xl font-display tracking-tight mb-6 leading-[0.98]">
                  Ready to simplify your
                  <br />
                  rental operations?
                </h2>

                <p className="text-base lg:text-lg text-muted-foreground mb-10 leading-relaxed max-w-xl">
                  Set up your properties, generate accurate monthly rent bills, and keep track of tenant payments and maintenance with confidence.
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
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

                <p className="text-xs text-muted-foreground mt-6 font-mono">
                  Direct UPI settlement · Designed for property owners and tenants across India
                </p>
              </div>

              {/* Right animation */}
              <div className="hidden lg:flex items-center justify-center w-[440px] h-[440px] -mr-8">
                <AnimatedTetrahedron />
              </div>
            </div>
          </div>

          {/* Decorative corner accents */}
          <div className="absolute top-0 right-0 w-28 h-28 border-b border-l border-foreground/10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-28 h-28 border-t border-r border-foreground/10 pointer-events-none" />
        </div>
      </div>
    </section>
  );
}
