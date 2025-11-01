'use client'

import { useState } from 'react'
import TenantSidebar from './TenantSidebar'
import TenantSwitcher, { TenantOption } from './TenantSwitcher'

export default function TenantShell({ tenantId, tenantName, nav, tenants, children }: { tenantId: string; tenantName?: string; nav: { label: string; href: string }[]; tenants: TenantOption[]; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top header (desktop) */}
      <div className="hidden md:flex sticky top-0 z-40 bg-white border-b border-gray-200 items-center justify-between px-6 h-14">
        <div className="font-semibold text-gray-900">Retail Visibility Platform</div>
        <TenantSwitcher currentTenantId={tenantId} tenants={tenants} />
      </div>

      {/* Mobile header */}
      <div className="md:hidden sticky top-0 z-40 bg-white border-b border-gray-200 flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="px-2 py-1 rounded-md border border-gray-300 text-gray-700"
        >
          ☰ Menu
        </button>
        <TenantSwitcher currentTenantId={tenantId} tenants={tenants} />
      </div>

      <div className="flex">
        {/* Desktop sidebar */}
        <TenantSidebar tenantId={tenantId} tenantName={tenantName} nav={nav} />
        {/* Content */}
        <main className="flex-1">{children}</main>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl border-r border-gray-200">
            <div className="p-3 border-b border-gray-200 flex items-center justify-between">
              <div className="font-semibold">Navigation</div>
              <button onClick={() => setOpen(false)} className="text-gray-600">✕</button>
            </div>
            <div className="h-[calc(100%-48px)] overflow-auto">
              <TenantSidebar tenantId={tenantId} nav={nav} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
