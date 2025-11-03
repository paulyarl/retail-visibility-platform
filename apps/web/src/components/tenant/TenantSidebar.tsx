'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = { label: string; href: string }

export default function TenantSidebar({ tenantId, tenantName, nav }: { tenantId: string; tenantName?: string; nav: NavItem[] }) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (!pathname) return false
    // Exact match or prefix match for sections
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside className="hidden md:block w-64 bg-white border-r border-gray-200 min-h-screen sticky top-0 z-50">
      <div className="p-4 border-b border-gray-200">
        <div className="text-sm text-gray-500">Tenant</div>
        <div className="text-base font-semibold text-gray-900 truncate">{tenantName || tenantId}</div>
      </div>
      <nav className="p-2 space-y-1">
        {nav.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'block px-3 py-2 rounded-md text-sm font-medium transition-colors',
                active ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:text-blue-700 hover:bg-blue-50',
              ].join(' ')}
              aria-current={active ? 'page' : undefined}
            >
              {item.label}
            </Link>
          )
        })}
        {/* Page-specific quick links */}
        {pathname && pathname.startsWith(`/t/${tenantId}/profile-completeness`) && (
          <>
            <div className="border-t border-gray-200 my-2" />
            <Link
              href={`/t/${tenantId}/settings/hours`}
              className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-700 hover:bg-blue-50 transition-colors"
            >
              Business Hours
            </Link>
          </>
        )}
      </nav>
    </aside>
  )
}
