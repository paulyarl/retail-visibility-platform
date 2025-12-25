"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-10 w-20 bg-neutral-200 dark:bg-neutral-700 rounded-lg animate-pulse" />
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="relative inline-flex h-10 w-20 items-center rounded-lg bg-neutral-200 dark:bg-neutral-700 transition-colors hover:bg-neutral-300 dark:hover:bg-neutral-600"
      aria-label="Toggle theme"
    >
      <span
        className={`inline-block h-8 w-8 transform rounded-md bg-white dark:bg-neutral-900 shadow-lg transition-transform ${
          theme === "dark" ? "translate-x-11" : "translate-x-1"
        }`}
      >
        {theme === "dark" ? (
          <svg
            className="h-8 w-8 p-1.5 text-yellow-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            />
          </svg>
        ) : (
          <svg
            className="h-8 w-8 p-1.5 text-yellow-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        )}
      </span>
    </button>
  );
}
