"use client";

import { useEffect, useState } from "react";

const testimonials = [
  {
    quote: "Managing 8 units in Indiranagar used to mean cross-checking WhatsApp screenshots against my bank passbook for hours. RentPilot cut my monthly verification time to 30 seconds.",
    author: "Suresh Murthy",
    role: "Property Owner (8 Units)",
    location: "Indiranagar, Bengaluru",
    metric: "90% faster reconciliation",
  },
  {
    quote: "As a tenant, receiving itemized monthly rent on WhatsApp and paying directly via PhonePe with immediate signed PDF receipts gives me absolute peace of mind.",
    author: "Priya Sharma",
    role: "Tenant",
    location: "Koramangala, Bengaluru",
    metric: "Instant signed receipts",
  },
  {
    quote: "The trilingual support in Kannada and Hindi allowed our on-site building caretaker to report plumbing issues with photos directly from his smartphone.",
    author: "Anand Kulkarni",
    role: "Family Estate Manager",
    location: "Mysuru",
    metric: "100% caretaker adoption",
  },
  {
    quote: "The automated annual 5% rent escalation schedule handled lease renewals seamlessly without awkward verbal negotiations or missed anniversary dates.",
    author: "Rajesh & Sunita Mehta",
    role: "Residential Landlords (12 Units)",
    location: "Whitefield, Bengaluru",
    metric: "Zero missed increments",
  },
];

const neighborhoods = [
  "Indiranagar",
  "Koramangala",
  "HSR Layout",
  "Whitefield",
  "Jayanagar",
  "Malleshwaram",
  "Mysuru",
  "Hebbal",
];

export function TestimonialsSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % testimonials.length);
        setIsAnimating(false);
      }, 300);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const activeTestimonial = testimonials[activeIndex];

  return (
    <section className="relative py-24 lg:py-36 border-t border-foreground/10 bg-foreground/[0.01]">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Section Label */}
        <div className="flex items-center gap-4 mb-16">
          <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            Real Landlord & Tenant Spotlights
          </span>
          <div className="flex-1 h-px bg-foreground/10" />
          <span className="font-mono text-xs text-muted-foreground">
            {String(activeIndex + 1).padStart(2, "0")} / {String(testimonials.length).padStart(2, "0")}
          </span>
        </div>

        {/* Main Quote */}
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-8">
            <blockquote
              className={`transition-all duration-300 ${
                isAnimating ? "opacity-0 translate-y-3" : "opacity-100 translate-y-0"
              }`}
            >
              <p className="font-display text-3xl md:text-4xl lg:text-5xl leading-[1.15] tracking-tight text-foreground">
                &ldquo;{activeTestimonial.quote}&rdquo;
              </p>
            </blockquote>

            {/* Author */}
            <div
              className={`mt-10 flex items-center gap-5 transition-all duration-300 delay-100 ${
                isAnimating ? "opacity-0" : "opacity-100"
              }`}
            >
              <div className="w-14 h-14 rounded-full bg-foreground/5 border border-foreground/15 flex items-center justify-center">
                <span className="font-display text-2xl text-foreground">
                  {activeTestimonial.author.charAt(0)}
                </span>
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">{activeTestimonial.author}</p>
                <p className="text-sm text-muted-foreground">
                  {activeTestimonial.role} · <span className="font-medium text-foreground/80">{activeTestimonial.location}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Metric Highlight */}
          <div className="lg:col-span-4 flex flex-col justify-center">
            <div
              className={`p-8 rounded-xl border border-foreground/15 bg-background shadow-xs transition-all duration-300 ${
                isAnimating ? "opacity-0 scale-95" : "opacity-100 scale-100"
              }`}
            >
              <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase block mb-3">
                Key Operational Result
              </span>
              <p className="font-display text-2xl md:text-3xl text-foreground">
                {activeTestimonial.metric}
              </p>
            </div>

            {/* Navigation Dots */}
            <div className="flex gap-2.5 mt-6">
              {testimonials.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setIsAnimating(true);
                    setTimeout(() => {
                      setActiveIndex(idx);
                      setIsAnimating(false);
                    }, 300);
                  }}
                  className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                    idx === activeIndex
                      ? "w-8 bg-foreground"
                      : "w-2 bg-foreground/20 hover:bg-foreground/40"
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Region Marquee Label */}
        <div className="mt-20 pt-10 border-t border-foreground/10 text-center">
          <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase mb-8">
            Active Residential Clusters
          </p>
        </div>
      </div>
      
      {/* Full-width marquee outside container */}
      <div className="w-full">
        <div className="flex gap-14 items-center marquee">
          {[...Array(2)].map((_, setIdx) => (
            <div key={setIdx} className="flex gap-14 items-center shrink-0">
              {neighborhoods.map((area) => (
                <span
                  key={`${setIdx}-${area}`}
                  className="font-display text-lg md:text-2xl text-foreground/35 whitespace-nowrap hover:text-foreground transition-colors duration-300"
                >
                  {area}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
