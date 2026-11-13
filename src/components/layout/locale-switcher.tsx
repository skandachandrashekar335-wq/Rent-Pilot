"use client";

import React from "react";
import { Globe } from "lucide-react";
import { useTranslation, Locale } from "./locale-context";

export function LocaleSwitcher() {
  const { locale, setLocale } = useTranslation();

  return (
    <div className="flex items-center gap-1 bg-surface-muted rounded-md px-2 py-1 text-xs border border-border/40">
      <Globe className="h-3.5 w-3.5 text-text-muted" />
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="bg-transparent border-none text-text-primary focus:outline-none cursor-pointer pr-1"
        aria-label="Select Language"
      >
        <option value="en">EN</option>
        <option value="kn">ಕನ್ನಡ</option>
        <option value="hi">हिन्दी</option>
      </select>
    </div>
  );
}
