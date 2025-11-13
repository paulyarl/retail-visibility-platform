'use client';

import Link from 'next/link';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';

export default function SettingsFooter() {
  const { settings } = usePlatformSettings();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-neutral-200 mt-auto py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-sm text-neutral-600">
            <span>© {currentYear} {settings?.platformName || 'Visible Shell'}</span>
            <span className="hidden sm:inline">•</span>
            <span className="text-xs bg-neutral-100 px-2 py-1 rounded">v3.5.0</span>
          </div>
          
          <div className="flex items-center gap-6 text-sm">
            <Link href="/settings/contact" className="text-neutral-600 hover:text-neutral-900 transition-colors">
              Support
            </Link>
            <a href="#" className="text-neutral-600 hover:text-neutral-900 transition-colors">
              Docs
            </a>
            <Link href="/" className="text-neutral-600 hover:text-neutral-900 transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
