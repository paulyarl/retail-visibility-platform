'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

type NavItem = { label: string; href: string }

export default function TenantSidebar({ tenantId, tenantName, tenantLogoUrl, nav, isMobile = false }: { tenantId: string; tenantName?: string; tenantLogoUrl?: string; nav: NavItem[]; isMobile?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const { logout } = useAuth()

  const isActive = (href: string) => {
    if (!pathname) return false
    // Exact match or prefix match for sections
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside className={isMobile ? "w-full bg-white" : "hidden md:block w-64 bg-white border-r border-gray-200 min-h-screen sticky top-0 z-50"}>
      <div className={isMobile ? "p-3 sm:p-4 border-b border-gray-200" : "p-4 border-b border-gray-200"}>
        {tenantLogoUrl && (
          <div className={isMobile ? "mb-2 flex justify-center" : "mb-3 flex justify-center"}>
            <div className={isMobile ? "relative w-16 h-16" : "relative w-24 h-24"}>
              <Image
                src={tenantLogoUrl}
                alt={tenantName || 'Tenant logo'}
                fill
                className="object-contain"
              />
            </div>
          </div>
        )}
        <div className="text-xs sm:text-sm text-gray-500">Tenant</div>
        <div className="text-sm sm:text-base font-semibold text-gray-900 truncate">{tenantName || tenantId}</div>
      </div>
      <nav className={isMobile ? "p-2 space-y-0.5" : "p-2 space-y-1"}>
        {nav.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                isMobile ? 'block px-3 py-3 rounded-md text-base font-medium transition-colors' : 'block px-3 py-2 rounded-md text-sm font-medium transition-colors',
                active ? 'bg-blue-600 text-white' : 'text-gray-700 hover:text-blue-700 hover:bg-blue-50',
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
              className={isMobile ? "block px-3 py-3 rounded-md text-base font-medium text-gray-700 hover:text-blue-700 hover:bg-blue-50 transition-colors" : "block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-700 hover:bg-blue-50 transition-colors"}
            >
              Business Hours
            </Link>
          </>
        )}
        <div className="border-t border-gray-200 my-2" />
        <Link
          href="/"
          className={isMobile ? "block px-3 py-3 rounded-md text-base font-medium text-gray-700 hover:text-blue-700 hover:bg-blue-50 transition-colors" : "block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-700 hover:bg-blue-50 transition-colors"}
        >
          Platform Dashboard
        </Link>
        <button
          onClick={async () => { await logout(); router.push('/'); }}
          className={isMobile ? "w-full text-left block px-3 py-3 rounded-md text-base font-medium text-gray-700 hover:text-blue-700 hover:bg-blue-50 transition-colors" : "w-full text-left block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-700 hover:bg-blue-50 transition-colors"}
        >
          Sign Out
        </button>
      </nav>
    </aside>
  )
}
