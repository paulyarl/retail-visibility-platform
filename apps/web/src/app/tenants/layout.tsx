'use client';

import { useState } from 'react';
import SettingsFooter from '@/components/SettingsFooter';
import GeneralSidebar from '@/components/GeneralSidebar';
import Link from 'next/link';

export default function TenantsLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const nav = [
    { label: 'Your Tenants', href: '/tenants' },
    { label: 'Platform Dashboard', href: '/' },
    { label: 'Settings', href: '/settings' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Mobile Header */}
      <div className="md:hidden sticky top-0 z-40 bg-white border-b border-gray-200 flex items-center justify-between px-3 sm:px-4 py-3">
        <button
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open menu"
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="text-sm font-medium">Menu</span>
        </button>
        <Link href="/" className="text-xs sm:text-sm text-gray-700 hover:text-blue-600 font-medium">
          Platform Dashboard
        </Link>
      </div>

      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <GeneralSidebar nav={nav} />
        
        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <div className="absolute left-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl border-r border-gray-200 animate-in slide-in-from-left duration-300">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                <div className="font-semibold text-gray-900 text-base">Navigation</div>
                <button 
                  onClick={() => setMobileMenuOpen(false)} 
                  className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
                  aria-label="Close menu"
                >
                  <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="h-[calc(100%-60px)] overflow-auto" onClick={() => setMobileMenuOpen(false)}>
                <GeneralSidebar nav={nav} isMobile={true} />
              </div>
            </div>
          </div>
        )}
        
        <section className="flex-1 p-3 sm:p-4 md:p-6">{children}</section>
      </div>
      <SettingsFooter />
    </div>
  );
}
