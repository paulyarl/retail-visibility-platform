'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

type NavItem = { 
  label: string
  href: string
  icon?: React.ReactNode
  badge?: {
    text: string
    variant: 'default' | 'success' | 'warning' | 'error' | 'org'
  }
  children?: NavItem[]
  accessLevel?: 'public' | 'user' | 'admin' | 'owner'
}

interface SidebarItemProps {
  item: NavItem
  level: number
  pathname: string
  isCollapsed: boolean
  expandedItems: Set<string>
  onToggleExpand: (itemId: string) => void
  onMobileNavClick?: () => void
}

function BadgeComponent({ badge }: { badge: NavItem['badge'] }) {
  if (!badge) return null
  
  const variantClasses = {
    default: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    org: 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white'
  }
  
  return (
    <span className={cn(
      'text-[10px] px-1.5 py-0.5 rounded font-semibold ml-2',
      variantClasses[badge.variant]
    )}>
      {badge.text}
    </span>
  )
}

function SidebarItemComponent({ 
  item, 
  level, 
  pathname, 
  isCollapsed, 
  expandedItems, 
  onToggleExpand,
  onMobileNavClick
}: SidebarItemProps) {
  const hasChildren = item.children && item.children.length > 0
  const isExpanded = expandedItems.has(item.href || item.label)
  const isActive = item.href && (pathname === item.href || pathname.startsWith(item.href + '/'))
  
  const handleClick = useCallback(() => {
    if (hasChildren) {
      onToggleExpand(item.href || item.label)
    }
  }, [hasChildren, item.href, item.label, onToggleExpand])

  if (hasChildren) {
    return (
      <div className="w-full">
        <button
          onClick={handleClick}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors',
            'hover:bg-gray-100 dark:hover:bg-gray-800',
            isActive && 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50',
            isCollapsed && 'justify-center'
          )}
        >
          {item.icon && (
            <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
              {item.icon}
            </span>
          )}
          {!isCollapsed && (
            <>
              <span className="flex-1 text-left font-medium text-gray-900 dark:text-gray-100">{item.label}</span>
              <BadgeComponent badge={item.badge} />
              <svg
                className={cn(
                  'w-4 h-4 transition-transform text-gray-400 dark:text-gray-500',
                  isExpanded ? 'rotate-90' : ''
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
        
        {isExpanded && !isCollapsed && (
          <div className={cn(
            'mt-1 space-y-1',
            level > 0 && 'ml-2',
            'bg-gray-50 dark:bg-gray-800/50 rounded-lg p-1 border border-gray-100 dark:border-gray-700'
          )}>
            {item.children!.map((child) => (
              <SidebarItemComponent
                key={child.href || child.label}
                item={child}
                level={level + 1}
                pathname={pathname}
                isCollapsed={isCollapsed}
                expandedItems={expandedItems}
                onToggleExpand={onToggleExpand}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  if (item.href) {
    return (
      <Link
        href={item.href}
        onClick={onMobileNavClick}
        className={cn(
          'flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors',
          'hover:bg-gray-100 dark:hover:bg-gray-800',
          isActive && 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50',
          isCollapsed && 'justify-center'
        )}
      >
        {item.icon && (
          <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
            {item.icon}
          </span>
        )}
        {!isCollapsed && (
          <>
            <span className="flex-1 font-medium text-gray-900 dark:text-gray-100">{item.label}</span>
            <BadgeComponent badge={item.badge} />
          </>
        )}
      </Link>
    )
  }

  return null
}

export default function GeneralSidebar({ 
  nav, 
  isMobile = false,
  collapsible = false,
  scope = 'workspace',
  onMobileNavClick
}: { 
  nav: NavItem[]
  isMobile?: boolean
  collapsible?: boolean
  scope?: 'workspace' | 'tenant' | 'admin' | 'platform'
  onMobileNavClick?: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { logout } = useAuth()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  const handleCollapseToggle = useCallback(() => {
    setIsCollapsed(prev => !prev)
  }, [])

  const handleToggleExpand = useCallback((itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  }, [])

  // Auto-expand items that contain the current path
  useEffect(() => {
    if (!collapsible) return
    
    const itemsToExpand = new Set<string>()
    
    const findExpandedItems = (items: NavItem[], currentPath: string): string[] => {
      const expanded: string[] = []
      
      items.forEach(item => {
        if (item.children && item.children.length > 0) {
          const hasActiveChild = item.children.some(child => 
            child.href && (currentPath === child.href || currentPath.startsWith(child.href + '/'))
          ) || item.children.some(child => {
            if (child.children) {
              return findExpandedItems([child], currentPath).length > 0
            }
            return false
          })
          
          if (hasActiveChild) {
            expanded.push(item.href || item.label)
          }
        }
      })
      
      return expanded
    }
    
    const expanded = findExpandedItems(nav, pathname)
    setExpandedItems(new Set(expanded))
  }, [nav, pathname, collapsible])

  const sidebarWidth = isCollapsed && collapsible ? 'w-16' : isMobile ? 'w-full' : 'w-64'
  const headerTitle = scope === 'tenant' ? 'Location' : scope === 'admin' ? 'Admin' : scope === 'platform' ? 'Platform' : 'Workspace'
  const footerText = scope === 'tenant' ? 'Location Management' : scope === 'admin' ? 'System Administration' : scope === 'platform' ? 'Platform Navigation' : 'Workspace Navigation'

  return (
    <aside className={cn(
      'bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700',
      isMobile ? 'w-full' : `${sidebarWidth} min-h-screen sticky top-0`,
      'transition-all duration-300 ease-in-out'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        {!isCollapsed && (
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Navigation</div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">{headerTitle}</div>
          </div>
        )}
        {collapsible && !isMobile && (
          <button
            onClick={handleCollapseToggle}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg
              className={cn(
                'w-5 h-5 transition-transform text-gray-600 dark:text-gray-800',
                isCollapsed ? 'rotate-180' : ''
              )}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className={cn(
        'p-2 space-y-1',
        isMobile ? 'space-y-0.5' : 'space-y-1'
      )}>
        {nav.map((item) => {
          if (collapsible) {
            return (
              <SidebarItemComponent
                key={item.href || item.label}
                item={item}
                level={0}
                pathname={pathname}
                isCollapsed={isCollapsed}
                expandedItems={expandedItems}
                onToggleExpand={handleToggleExpand}
                onMobileNavClick={onMobileNavClick}
              />
            )
          }
          
          // Legacy rendering for non-collapsible mode
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileNavClick}
              className={cn(
                isMobile 
                  ? 'block px-3 py-3 rounded-md text-base font-medium transition-colors' 
                  : 'block px-3 py-2 rounded-md text-sm font-medium transition-colors',
                active ? 'bg-blue-600 text-white' : 'text-gray-700 hover:text-blue-700 hover:bg-blue-50',
                'flex items-center gap-3'
              )}
              aria-current={active ? 'page' : undefined}
            >
              {item.icon && (
                <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                  {item.icon}
                </span>
              )}
              <span className="flex-1">{item.label}</span>
              <BadgeComponent badge={item.badge} />
            </Link>
          )
        })}
      </nav>

      {/* Recommended Section - Only show when not collapsed */}
      {!isMobile && !isCollapsed && (
        <div className="m-3 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
          <div className="text-xs uppercase text-gray-500 dark:text-gray-400 tracking-wide mb-2">Recommended</div>
          <ul className="text-sm text-gray-700 dark:text-gray-800 space-y-1 list-disc pl-5">
            <li>Finish onboarding for your next tenant</li>
            <li>Review Feed Validation report</li>
            <li>Complete business profile</li>
          </ul>
        </div>
      )}

      {/* Footer */}
      <div className={cn(
        'border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900',
        isMobile ? 'p-3 mt-4' : isCollapsed ? 'p-2' : 'p-3',
        isMobile ? '' : 'absolute bottom-0 left-0 right-0'
      )}>
        <button
          onClick={handleLogout}
          className={cn(
            'font-medium transition-colors flex items-center justify-center gap-2 rounded-md',
            isMobile 
              ? 'w-full px-3 py-3 text-base text-gray-700 dark:text-gray-200 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20' 
              : isCollapsed
                ? 'w-full p-2 text-sm text-gray-700 dark:text-gray-200 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 justify-center'
                : 'w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
          )}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!isCollapsed && 'Logout'}
        </button>
        {!isCollapsed && !isMobile && (
          <div className="text-xs text-gray-500 dark:text-gray-400 px-3 py-2 mt-2">
            {footerText}
          </div>
        )}
      </div>
    </aside>
  )
}
