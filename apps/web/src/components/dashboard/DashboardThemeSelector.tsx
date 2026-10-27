"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, Palette } from "lucide-react";

/**
 * DashboardThemeSelector — per-user page-theme picker for the tenant dashboard.
 *
 * Applies a background scheme to the dashboard canvas (the area behind the
 * white panels). Persisted to localStorage — a viewing preference, not a
 * tenant attribute, so it follows the user across tenants.
 */

export interface DashboardTheme {
  key: string;
  label: string;
  /** Classes applied to the dashboard root container. Must stay literal for Tailwind JIT. */
  classes: string;
  /** Classes for the small color dot in the picker. */
  swatch: string;
}

export const DASHBOARD_THEMES: DashboardTheme[] = [
  { key: "default", label: "Default", classes: "bg-gray-50", swatch: "bg-gray-300" },
  { key: "slate", label: "Slate", classes: "bg-slate-100", swatch: "bg-slate-400" },
  { key: "sky", label: "Sky", classes: "bg-sky-50", swatch: "bg-sky-400" },
  { key: "violet", label: "Violet", classes: "bg-violet-50", swatch: "bg-violet-400" },
  { key: "emerald", label: "Emerald", classes: "bg-emerald-50", swatch: "bg-emerald-400" },
  { key: "amber", label: "Amber", classes: "bg-amber-50", swatch: "bg-amber-400" },
  { key: "rose", label: "Rose", classes: "bg-rose-50", swatch: "bg-rose-400" },
  {
    key: "dusk",
    label: "Dusk",
    classes: "bg-gradient-to-br from-slate-100 via-violet-50 to-sky-50",
    swatch: "bg-gradient-to-br from-slate-300 to-violet-300",
  },
  {
    key: "meadow",
    label: "Meadow",
    classes: "bg-gradient-to-br from-emerald-50 via-teal-50 to-sky-50",
    swatch: "bg-gradient-to-br from-emerald-300 to-sky-300",
  },
];

const STORAGE_KEY = "rvp_dashboard_theme";

export function useDashboardTheme() {
  const [theme, setThemeState] = useState<string>("default");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && DASHBOARD_THEMES.some((t) => t.key === saved)) {
      setThemeState(saved);
    }
  }, []);

  const setTheme = (key: string) => {
    setThemeState(key);
    try {
      window.localStorage.setItem(STORAGE_KEY, key);
    } catch {
      // localStorage unavailable — theme still applies for the session
    }
  };

  const themeClasses =
    DASHBOARD_THEMES.find((t) => t.key === theme)?.classes ?? "bg-gray-50";

  return { theme, setTheme, themeClasses };
}

interface DashboardThemeSelectorProps {
  theme: string;
  onChange: (key: string) => void;
}

export default function DashboardThemeSelector({ theme, onChange }: DashboardThemeSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Dashboard theme"
      >
        <Palette className="w-3 h-3" />
        Theme
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Dashboard theme"
          className="absolute right-0 z-30 mt-1 w-44 rounded-xl border border-gray-100 bg-white p-1.5 shadow-lg"
        >
          {DASHBOARD_THEMES.map((t) => {
            const selected = t.key === theme;
            return (
              <button
                key={t.key}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(t.key);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                  selected ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span className={`h-3.5 w-3.5 rounded-full ${t.swatch} border border-black/5 flex-shrink-0`} />
                <span className="flex-1">{t.label}</span>
                {selected && <Check className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
