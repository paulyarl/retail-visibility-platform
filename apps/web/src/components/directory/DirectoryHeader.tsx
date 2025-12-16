'use client';

import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import Image from 'next/image';
import Link from 'next/link';
import { Home, Store } from 'lucide-react';

export default function DirectoryHeader() {
  const { settings } = usePlatformSettings();

  return (
    <header className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-b border-white/10">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          {/* Platform Logo & Name */}
          <Link href="/directory" className="flex items-center gap-4 hover:opacity-90 transition-opacity">
            {settings?.logoUrl ? (
              <>
                <div className="relative">
                  <div className="absolute inset-0 bg-white/20 rounded-xl blur-lg"></div>
                  <div className="relative bg-white/10 backdrop-blur-sm border-2 border-white/30 rounded-xl p-3">
                    <Image
                      src={settings.logoUrl}
                      alt={settings.platformName || 'Platform Logo'}
                      width={150}
                      height={60}
                      className="h-10 w-auto object-contain"
                      priority
                    />
                  </div>
                </div>
                {/* Platform Name next to logo */}
                <div className="hidden sm:block">
                  <span className="text-2xl font-bold">
                    {settings.platformName || 'Store Directory'}
                  </span>
                  <p className="text-sm text-white/70">Business Directory</p>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Store className="w-8 h-8" />
                <span className="text-2xl font-bold">
                  {settings?.platformName || 'Store Directory'}
                </span>
              </div>
            )}
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-4">
            <Link
              href="/directory"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors border border-white/20"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Browse All</span>
            </Link>
            
            <Link
              href="/"
              className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <span className="hidden sm:inline">Home</span>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
