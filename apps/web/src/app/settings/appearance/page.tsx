"use client";

import { useTheme } from "next-themes";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, ThemeToggle } from "@/components/ui";
import Protected from "@/components/Protected";
import PageHeader, { Icons } from '@/components/PageHeader';

export default function AppearanceSettingsPage() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme, systemTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = theme === "system" ? systemTheme : theme;

  return (
    <Protected>
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
        <PageHeader
          title="Appearance"
          description="Customize how the platform looks and feels"
          icon={Icons.Appearance}
          backLink={{
            href: '/settings',
            label: 'Back to Settings'
          }}
        />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* Theme Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Theme</CardTitle>
              <CardDescription>Select your preferred theme</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Theme Options */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Light Theme */}
                  <button
                    onClick={() => setTheme("light")}
                    className={`relative p-4 border-2 rounded-lg transition-all ${
                      theme === "light"
                        ? "border-primary-600 dark:border-primary-400 bg-primary-50 dark:bg-primary-900/20"
                        : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-full h-20 bg-white border border-neutral-200 rounded-md flex items-center justify-center">
                        <svg className="w-8 h-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                          />
                        </svg>
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-neutral-900 dark:text-white">Light</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">Bright and clear</p>
                      </div>
                      {theme === "light" && (
                        <div className="absolute top-2 right-2">
                          <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Dark Theme */}
                  <button
                    onClick={() => setTheme("dark")}
                    className={`relative p-4 border-2 rounded-lg transition-all ${
                      theme === "dark"
                        ? "border-primary-600 dark:border-primary-400 bg-primary-50 dark:bg-primary-900/20"
                        : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-full h-20 bg-neutral-900 border border-neutral-700 rounded-md flex items-center justify-center">
                        <svg className="w-8 h-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                          />
                        </svg>
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-neutral-900 dark:text-white">Dark</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">Easy on the eyes</p>
                      </div>
                      {theme === "dark" && (
                        <div className="absolute top-2 right-2">
                          <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>

                  {/* System Theme */}
                  <button
                    onClick={() => setTheme("system")}
                    className={`relative p-4 border-2 rounded-lg transition-all ${
                      theme === "system"
                        ? "border-primary-600 dark:border-primary-400 bg-primary-50 dark:bg-primary-900/20"
                        : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-full h-20 bg-gradient-to-r from-white to-neutral-900 border border-neutral-300 rounded-md flex items-center justify-center">
                        <svg className="w-8 h-8 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-neutral-900 dark:text-white">System</p>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">Match your device</p>
                      </div>
                      {theme === "system" && (
                        <div className="absolute top-2 right-2">
                          <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>
                </div>

                {/* Current Theme Info */}
                {mounted && (
                  <div className="mt-6 p-4 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-neutral-900 dark:text-white">Current Theme</p>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                          {theme === "system"
                            ? `System (currently ${currentTheme})`
                            : theme ? theme.charAt(0).toUpperCase() + theme.slice(1) : 'Light'}
                        </p>
                      </div>
                      <ThemeToggle />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>See how your theme looks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg">
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">Sample Card</h3>
                  <p className="text-neutral-600 dark:text-neutral-400 text-sm mb-4">
                    This is how your content will look with the selected theme.
                  </p>
                  <button className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors">
                    Sample Button
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Protected>
  );
}
