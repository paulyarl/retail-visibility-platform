'use client'

import { useState } from 'react'
import TenantSidebar from './TenantSidebar'
import TenantSwitcher, { TenantOption } from './TenantSwitcher'
import SettingsSwitcher from '../app-shell/SettingsSwitcher'
import Link from 'next/link'
import Image from 'next/image'
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext'

export default function TenantShell({ tenantId, tenantName, tenantLogoUrl, nav, tenants, children }: { tenantId: string; tenantName?: string; tenantLogoUrl?: string; nav: { label: string; href: string }[]; tenants: TenantOption[]; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const { settings } = usePlatformSettings()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top header (desktop) */}
      <div className="hidden md:flex sticky top-0 z-40 bg-white border-b border-gray-200 items-center justify-between px-6 h-14">
        <Link href="/" className="flex items-center gap-3" aria-label="Platform Dashboard">
          {settings?.logoUrl ? (
            <Image src={settings.logoUrl} alt={settings.platformName || 'Platform Logo'} width={140} height={32} className="h-8 w-auto object-contain" />
          ) : (
            <span className="font-semibold text-gray-900 hover:text-blue-600">{settings?.platformName || 'Visible Shelf'}</span>
          )}
        </Link>
        <div className="flex items-center gap-3">
          <TenantSwitcher currentTenantId={tenantId} tenants={tenants} />
          <SettingsSwitcher />
        </div>
      </div>

      {/* Mobile header */}
      <div className="md:hidden sticky top-0 z-40 bg-white border-b border-gray-200 flex items-center justify-between px-3 sm:px-4 py-3">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="text-sm font-medium">Menu</span>
        </button>
        <Link href="/" aria-label="Platform Dashboard" className="text-xs sm:text-sm text-gray-700 hover:text-blue-600 font-medium truncate max-w-[100px] sm:max-w-none">
          {settings?.platformName || 'Platform'}
        </Link>
        <TenantSwitcher currentTenantId={tenantId} tenants={tenants} />
      </div>

      <div className="flex">
        {/* Desktop sidebar */}
        <TenantSidebar tenantId={tenantId} tenantName={tenantName} tenantLogoUrl={tenantLogoUrl} nav={nav} />
        {/* Content */}
        <main className="flex-1">{children}</main>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl border-r border-gray-200 animate-in slide-in-from-left duration-300">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="font-semibold text-gray-900 text-base">Navigation</div>
              <button 
                onClick={() => setOpen(false)} 
                className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
                aria-label="Close menu"
              >
                <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="h-[calc(100%-60px)] overflow-auto">
              <div className="p-4 space-y-2 border-b border-gray-200">
                <TenantSwitcher currentTenantId={tenantId} tenants={tenants} />
                <SettingsSwitcher />
              </div>
              <TenantSidebar tenantId={tenantId} tenantName={tenantName} tenantLogoUrl={tenantLogoUrl} nav={nav} isMobile={true} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
