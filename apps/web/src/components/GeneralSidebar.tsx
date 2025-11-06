'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

type NavItem = { label: string; href: string }

export default function GeneralSidebar({ nav, isMobile = false }: { nav: NavItem[]; isMobile?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const { logout } = useAuth()
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  return (
    <aside className={isMobile ? "w-full bg-white" : "hidden md:block w-64 bg-white border-r border-gray-200 min-h-screen sticky top-0"}>
      <div className={isMobile ? "p-3 sm:p-4 border-b border-gray-200" : "p-4 border-b border-gray-200"}>
        <div className="text-xs sm:text-sm text-gray-500">Navigation</div>
        <div className="text-sm sm:text-base font-semibold text-gray-900">Workspace</div>
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
                active ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:text-blue-700 hover:bg-blue-50',
              ].join(' ')}
              aria-current={active ? 'page' : undefined}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
      {!isMobile && (
        <div className="m-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
          <div className="text-xs uppercase text-gray-500 tracking-wide mb-2">Recommended</div>
          <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5">
            <li>Finish onboarding for your next tenant</li>
            <li>Review Feed Validation report</li>
            <li>Complete business profile</li>
          </ul>
        </div>
      )}
      <div className={isMobile ? "p-3 border-t border-gray-200 bg-white mt-4" : "absolute bottom-0 left-0 right-0 p-3 border-t border-gray-200 bg-white"}>
        <button
          onClick={handleLogout}
          className={isMobile ? "w-full px-3 py-3 text-base font-medium text-gray-700 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors flex items-center justify-center gap-2" : "w-full px-3 py-2 text-sm font-medium text-gray-700 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors flex items-center justify-center gap-2"}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>
    </aside>
  )
}
