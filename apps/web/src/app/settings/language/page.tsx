"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import Protected from '@/components/Protected';

const LANGUAGES = [
  {
    code: 'en-US',
    name: 'English (US)',
    nativeName: 'English',
    flag: '🇺🇸',
  },
  {
    code: 'es-ES',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
  },
  {
    code: 'fr-FR',
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
  },
  {
    code: 'de-DE',
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
  },
  {
    code: 'zh-CN',
    name: 'Chinese (Simplified)',
    nativeName: '简体中文',
    flag: '🇨🇳',
  },
  {
    code: 'ja-JP',
    name: 'Japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
  },
];

export default function LanguageSettingsPage() {
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load saved language preference
    const saved = localStorage.getItem('language');
    if (saved) {
      setSelectedLanguage(saved);
    }
  }, []);

  const handleLanguageChange = (code: string) => {
    setSelectedLanguage(code);
    localStorage.setItem('language', code);
    // TODO: Trigger i18n language change
    // i18n.changeLanguage(code);
  };

  if (!mounted) {
    return null;
  }

  return (
    <Protected>
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
        {/* Header */}
        <div className="bg-white dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">Language & Region</h1>
                <p className="text-neutral-600 dark:text-neutral-400 mt-1">
                  Choose your preferred language
                </p>
              </div>
              <Link
                href="/settings"
                className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-sm font-medium flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Settings
              </Link>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* Language Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Display Language</CardTitle>
              <CardDescription>Select your preferred language for the interface</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {LANGUAGES.map((language) => (
                  <button
                    key={language.code}
                    onClick={() => handleLanguageChange(language.code)}
                    className={`relative p-4 border-2 rounded-lg transition-all text-left ${
                      selectedLanguage === language.code
                        ? 'border-primary-600 dark:border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{language.flag}</span>
                      <div className="flex-1">
                        <p className="font-medium text-neutral-900 dark:text-white">
                          {language.nativeName}
                        </p>
                        <p className="text-sm text-neutral-600 dark:text-neutral-400">
                          {language.name}
                        </p>
                      </div>
                      {selectedLanguage === language.code && (
                        <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Current Selection Info */}
              <div className="mt-6 p-4 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {LANGUAGES.find(l => l.code === selectedLanguage)?.flag}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">Current Language</p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                      {LANGUAGES.find(l => l.code === selectedLanguage)?.nativeName} ({selectedLanguage})
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>About Translations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-neutral-600 dark:text-neutral-400">
                <p>
                  The platform interface will be displayed in your selected language. This includes menus, buttons, labels, and messages.
                </p>
                <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="font-medium text-blue-900 dark:text-blue-100">Translation Status</p>
                    <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                      Currently, only English (US) is fully supported. Other languages are coming soon.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Protected>
  );
}
