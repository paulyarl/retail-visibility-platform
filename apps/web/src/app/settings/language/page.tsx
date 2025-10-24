"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import Protected from '@/components/Protected';
import PageHeader, { Icons } from '@/components/PageHeader';

const LANGUAGES = [
  {
    code: 'en-US',
    name: 'English (US)',
    nativeName: 'English',
    flag: '🇺🇸',
    countries: ['United States', 'Canada', 'United Kingdom', 'Australia'],
  },
  {
    code: 'es-ES',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    countries: ['Spain', 'Mexico', 'Argentina', 'Colombia'],
  },
  {
    code: 'fr-FR',
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
    countries: ['France', 'Canada', 'Belgium', 'Switzerland'],
  },
  {
    code: 'de-DE',
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    countries: ['Germany', 'Austria', 'Switzerland'],
  },
  {
    code: 'zh-CN',
    name: 'Chinese (Simplified)',
    nativeName: '简体中文',
    flag: '🇨🇳',
    countries: ['China', 'Singapore'],
  },
  {
    code: 'ja-JP',
    name: 'Japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
    countries: ['Japan'],
  },
];

const REGIONS = [
  { code: 'us-east-1', name: 'US East (N. Virginia)', flag: '🇺🇸' },
  { code: 'us-west-2', name: 'US West (Oregon)', flag: '🇺🇸' },
  { code: 'eu-west-1', name: 'EU (Ireland)', flag: '🇪🇺' },
  { code: 'ap-southeast-1', name: 'Asia Pacific (Singapore)', flag: '🌏' },
];

export default function LanguageSettingsPage() {
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const [selectedRegion, setSelectedRegion] = useState('us-east-1');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load saved preferences
    const savedLanguage = localStorage.getItem('language');
    const savedRegion = localStorage.getItem('region');
    if (savedLanguage) {
      setSelectedLanguage(savedLanguage);
    }
    if (savedRegion) {
      setSelectedRegion(savedRegion);
    }
  }, []);

  const handleLanguageChange = (code: string) => {
    setSelectedLanguage(code);
    localStorage.setItem('language', code);
    // TODO: Trigger i18n language change
    // i18n.changeLanguage(code);
  };

  const handleRegionChange = (code: string) => {
    setSelectedRegion(code);
    localStorage.setItem('region', code);
  };

  if (!mounted) {
    return null;
  }

  return (
    <Protected>
      <div className="min-h-screen bg-neutral-50">
        <PageHeader
          title="Language & Region"
          description="Choose your preferred language"
          icon={Icons.Language}
          backLink={{
            href: '/settings',
            label: 'Back to Settings'
          }}
        />

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
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{language.flag}</span>
                      <div className="flex-1">
                        <p className="font-medium text-neutral-900">
                          {language.nativeName}
                        </p>
                        <p className="text-sm text-neutral-600">
                          {language.name}
                        </p>
                        <p className="text-xs text-neutral-500 mt-1">
                          {language.countries.join(', ')}
                        </p>
                      </div>
                      {selectedLanguage === language.code && (
                        <svg className="w-5 h-5 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
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
              <div className="mt-6 p-4 bg-neutral-100 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {LANGUAGES.find(l => l.code === selectedLanguage)?.flag}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-neutral-900">Current Language</p>
                    <p className="text-xs text-neutral-600 mt-1">
                      {LANGUAGES.find(l => l.code === selectedLanguage)?.nativeName} ({selectedLanguage})
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Region Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Data Center Region</CardTitle>
              <CardDescription>Select your preferred data center location</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {REGIONS.map((region) => (
                  <button
                    key={region.code}
                    onClick={() => handleRegionChange(region.code)}
                    className={`relative p-4 border-2 rounded-lg transition-all text-left ${
                      selectedRegion === region.code
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{region.flag}</span>
                      <div className="flex-1">
                        <p className="font-medium text-neutral-900">
                          {region.name}
                        </p>
                        <p className="text-xs text-neutral-500 mt-1">
                          {region.code}
                        </p>
                      </div>
                      {selectedRegion === region.code && (
                        <svg className="w-5 h-5 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
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
              <div className="mt-6 p-4 bg-neutral-100 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {REGIONS.find(r => r.code === selectedRegion)?.flag}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-neutral-900">Current Region</p>
                    <p className="text-xs text-neutral-600 mt-1">
                      {REGIONS.find(r => r.code === selectedRegion)?.name}
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
              <div className="space-y-3 text-sm text-neutral-700">
                <p>
                  The platform interface will be displayed in your selected language. This includes menus, buttons, labels, and messages.
                </p>
                <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="font-medium text-blue-900">Translation Status</p>
                    <p className="text-sm text-blue-800 mt-1">
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
