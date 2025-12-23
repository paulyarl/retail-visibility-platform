'use client'

import { useState } from 'react'
import TenantSidebar from './TenantSidebar'
import TenantSwitcher, { TenantOption } from './TenantSwitcher'
import SettingsSwitcher from '../app-shell/SettingsSwitcher'
import Link from 'next/link'
import Image from 'next/image'
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext'
import ContextualBreadcrumbs from '@/components/ContextualBreadcrumbs'

export default function TenantShell({ tenantId, tenantName, tenantLogoUrl, nav, tenants, children }: { tenantId: string; tenantName?: string; tenantLogoUrl?: string; nav: { label: string; href: string }[]; tenants: TenantOption[]; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [startX, setStartX] = useState<number | null>(null)
  const [currentX, setCurrentX] = useState<number | null>(null)
  const { settings } = usePlatformSettings()

  // Handle touch start for swipe gesture
  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX)
  }

  // Handle touch move for swipe gesture
  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX !== null) {
      const currentX = e.touches[0].clientX
      setCurrentX(currentX)

      // If swiping left (closing gesture), update drawer position
      if (currentX < startX) {
        const diff = startX - currentX
        const maxDiff = 320 // Max swipe distance
        const translateX = Math.min(diff, maxDiff)
        // We could add visual feedback here if needed
      }
    }
  }

  // Handle touch end for swipe gesture
  const handleTouchEnd = () => {
    if (startX !== null && currentX !== null) {
      const diff = startX - currentX
      const threshold = 100 // Minimum swipe distance to trigger close

      if (diff > threshold) {
        setOpen(false)
      }
    }

    setStartX(null)
    setCurrentX(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop header */}
      <div className="hidden md:block sticky top-0 z-40 bg-white border-b border-gray-200">
        {/* Main Header Row */}
        <div className="flex items-center justify-between px-6 h-14">
          <Link href="/" className="flex items-center gap-3" aria-label="Platform Dashboard">
            {settings?.logoUrl ? (
              <Image src={settings.logoUrl} alt={settings.platformName || 'Platform Logo'} width={140} height={32} className="h-8 w-auto object-contain" />
            ) : (
              <span className="font-semibold text-gray-900 hover:text-blue-600" suppressHydrationWarning>{settings?.platformName || 'Visible Shelf'}</span>
            )}
          </Link>
        </div>

        {/* Switcher Row */}
        <div className="border-t border-gray-200 bg-gray-50">
          <div className="px-6 py-2 flex items-center justify-end gap-3 overflow-x-auto">
            <TenantSwitcher currentTenantId={tenantId} tenants={tenants} />
            <SettingsSwitcher />
          </div>
        </div>
      </div>

      {/* Mobile/Tablet header */}
      <div className="md:hidden sticky top-0 z-40 bg-white border-b border-gray-200">
        {/* Main Header Row */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-3">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open navigation menu"
            className="flex items-center gap-2 px-4 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation min-h-[44px]"
          >
            <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="text-sm font-medium hidden xs:inline">Menu</span>
          </button>
          <Link
            href="/"
            aria-label="Platform Dashboard"
            className="text-xs sm:text-sm text-gray-700 hover:text-blue-600 font-medium truncate max-w-[120px] sm:max-w-none px-2 py-1 rounded-md hover:bg-gray-50 transition-colors"
            suppressHydrationWarning
          >
            {settings?.platformName || 'Platform'}
          </Link>
          <div className="w-[100px] flex justify-end">
            {/* Capacity indicator for mobile - simplified */}
            <div className="px-2 py-1 rounded-md bg-gray-50 text-xs text-gray-600 flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="hidden sm:inline">OK</span>
            </div>
          </div>
        </div>

        {/* Switcher Row */}
        <div className="border-t border-gray-200 bg-gray-50">
          <div className="px-3 sm:px-4 py-2 flex items-center justify-end gap-3 overflow-x-auto">
            <TenantSwitcher currentTenantId={tenantId} tenants={tenants} />
            <SettingsSwitcher />
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Desktop sidebar */}
        <TenantSidebar tenantId={tenantId} tenantName={tenantName} tenantLogoUrl={tenantLogoUrl} nav={nav} />
        {/* Content */}
        <main className="flex-1">
          {/* Add breadcrumbs for navigation context */}
          <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 px-4 py-3">
            <ContextualBreadcrumbs tenantId={tenantId} />
          </div>
          {children}
        </main>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
          <div
            className="absolute left-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl border-r border-gray-200 animate-in slide-in-from-left duration-300"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div className="font-semibold text-gray-900 text-base">
                {tenantName || 'Location'} Navigation
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-200 transition-colors touch-manipulation"
                aria-label="Close menu"
              >
                <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="h-[calc(100%-60px)] overflow-auto">
              <TenantSidebar tenantId={tenantId} tenantName={tenantName} tenantLogoUrl={tenantLogoUrl} nav={nav} isMobile={true} />
            </div>
            {/* Mobile navigation hint */}
            <div className="absolute bottom-4 left-4 right-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                  </svg>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Swipe left or tap outside to close
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
