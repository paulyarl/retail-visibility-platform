'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = { label: string; href: string }

export default function GeneralSidebar({ nav }: { nav: NavItem[] }) {
  const pathname = usePathname()
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <aside className="hidden md:block w-64 bg-white border-r border-gray-200 min-h-screen sticky top-0">
      <div className="p-4 border-b border-gray-200">
        <div className="text-sm text-gray-500">Navigation</div>
        <div className="text-base font-semibold text-gray-900">Workspace</div>
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
      </nav>
      <div className="m-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
        <div className="text-xs uppercase text-gray-500 tracking-wide mb-2">Recommended</div>
        <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5">
          <li>Finish onboarding for your next tenant</li>
          <li>Review Feed Validation report</li>
          <li>Complete business profile</li>
        </ul>
      </div>
    </aside>
  )
}
