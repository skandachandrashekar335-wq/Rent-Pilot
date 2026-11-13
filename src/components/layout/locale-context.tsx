"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import enMessages from "@/messages/en.json";
import knMessages from "@/messages/kn.json";
import hiMessages from "@/messages/hi.json";

export type Locale = "en" | "kn" | "hi";

type Messages = typeof enMessages;

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

const dictionaries: Record<Locale, Messages> = {
  en: enMessages,
  kn: knMessages,
  hi: hiMessages,
};

const LocaleContext = createContext<LocaleContextType>({
  locale: "en",
  setLocale: () => {},
  t: (key: string) => key,
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const saved = localStorage.getItem("rentpilot_locale") as Locale;
    if (saved && (saved === "en" || saved === "kn" || saved === "hi")) {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("rentpilot_locale", l);
  };

  const t = (path: string): string => {
    const parts = path.split(".");
    let current: Record<string, unknown> | string =
      dictionaries[locale] || dictionaries.en;
    for (const part of parts) {
      if (current && typeof current === "object" && part in current) {
        current = (current as Record<string, unknown>)[part] as
          | Record<string, unknown>
          | string;
      } else {
        // Fallback to English
        let fallback: Record<string, unknown> | string = dictionaries.en;
        for (const f of parts) {
          if (fallback && typeof fallback === "object" && f in fallback) {
            fallback = (fallback as Record<string, unknown>)[f] as
              | Record<string, unknown>
              | string;
          } else {
            return path;
          }
        }
        return typeof fallback === "string" ? fallback : path;
      }
    }
    return typeof current === "string" ? current : path;
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LocaleContext);
}
