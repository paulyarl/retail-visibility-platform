"use client";

import { ReactNode, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { NavigationHelpers } from '@/lib/navigation/NavigationHelpers';
import { cn } from '@/lib/utils';

// NavItem type definition
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

interface AdminNavContentProps {
  children: ReactNode;
}

const adminNavItems: NavItem[] = [
  {
    label: 'Admin Dashboard',
    href: '/settings/admin',
    icon: NavigationHelpers.getStandardIcon('PLATFORM_DASHBOARD'),
  },
  {
    label: 'User Management',
    href: '/settings/admin/users',
    icon: NavigationHelpers.getStandardIcon('PLATFORM_USERS'),
    children: [
      {
        label: 'All Users',
        href: '/settings/admin/users'
      },
      {
        label: 'User Groups',
        href: '/settings/admin/users/groups',
        children: [
          {
            label: 'Admin Groups',
            href: '/settings/admin/users/groups/admin',
            children: [
              {
                label: 'Super Admins',
                href: '/settings/admin/users/groups/admin/super'
              },
              {
                label: 'Regular Admins',
                href: '/settings/admin/users/groups/admin/regular'
              }
            ]
          },
          {
            label: 'User Groups',
            href: '/settings/admin/users/groups/users',
            children: [
              {
                label: 'Power Users',
                href: '/settings/admin/users/groups/users/power'
              },
              {
                label: 'Basic Users',
                href: '/settings/admin/users/groups/users/basic'
              }
            ]
          }
        ]
      },
      {
        label: 'Invitations',
        href: '/settings/admin/invitations'
      },
      {
        label: 'Permissions',
        href: '/settings/admin/permissions',
        children: [
          {
            label: 'Role Management',
            href: '/settings/admin/permissions/roles',
            children: [
              {
                label: 'Create Role',
                href: '/settings/admin/permissions/roles/create'
              },
              {
                label: 'Edit Roles',
                href: '/settings/admin/permissions/roles/edit'
              }
            ]
          },
          {
            label: 'Access Control',
            href: '/settings/admin/permissions/access'
          }
        ]
      }
    ]
  },
  {
    label: 'Tenant Management',
    href: '/settings/admin/tenants',
    icon: NavigationHelpers.getStandardIcon('STORE'),
    children: [
      {
        label: 'All Tenants',
        href: '/settings/admin/tenants'
      },
      {
        label: 'Tenant Categories',
        href: '/settings/admin/tenants/categories',
        children: [
          {
            label: 'Active Tenants',
            href: '/settings/admin/tenants/categories/active',
            children: [
              {
                label: 'Premium',
                href: '/settings/admin/tenants/categories/active/premium'
              },
              {
                label: 'Standard',
                href: '/settings/admin/tenants/categories/active/standard'
              }
            ]
          },
          {
            label: 'Inactive Tenants',
            href: '/settings/admin/tenants/categories/inactive'
          }
        ]
      },
      {
        label: 'Tenant Limits',
        href: '/settings/admin/limits'
      },
      {
        label: 'Capacity Overview',
        href: '/settings/admin/capacity'
      }
    ]
  },
  {
    label: 'Security',
    href: '/settings/admin/security',
    icon: NavigationHelpers.getStandardIcon('ADMIN'),
    children: [
      {
        label: 'Security Dashboard',
        href: '/settings/admin/security'
      },
      {
        label: 'Threat Monitor',
        href: '/settings/admin/security#threats',
        children: [
          {
            label: 'Active Threats',
            href: '/settings/admin/security/threats/active'
          },
          {
            label: 'Resolved Threats',
            href: '/settings/admin/security/threats/resolved',
            children: [
              {
                label: 'This Week',
                href: '/settings/admin/security/threats/resolved/week'
              },
              {
                label: 'This Month',
                href: '/settings/admin/security/threats/resolved/month'
              }
            ]
          }
        ]
      },
      {
        label: 'Blocked IPs',
        href: '/settings/admin/security#blocked-ips'
      }
    ]
  },
  {
    label: 'System Settings',
    href: '/settings/admin/system',
    icon: NavigationHelpers.getStandardIcon('PLATFORM_SETTINGS'),
    children: [
      {
        label: 'Platform Settings',
        href: '/settings/admin/platform'
      },
      {
        label: 'Feature Flags',
        href: '/settings/admin/features',
        children: [
          {
            label: 'User Features',
            href: '/settings/admin/features/users',
            children: [
              {
                label: 'Dashboard Features',
                href: '/settings/admin/features/users/dashboard'
              },
              {
                label: 'Profile Features',
                href: '/settings/admin/features/users/profile'
              }
            ]
          },
          {
            label: 'Admin Features',
            href: '/settings/admin/features/admin'
          }
        ]
      },
      {
        label: 'Sentry',
        href: '/settings/admin/sentry'
      },
      {
        label: 'Analytics',
        href: '/settings/admin/analytics'
      }
    ]
  }
];

export function AdminNavContent({ children }: AdminNavContentProps) {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-expand items that contain the current path
  useEffect(() => {
    const itemsToExpand = new Set<string>();
    
    const findExpandedItems = (items: NavItem[], currentPath: string, level = 0): string[] => {
      const expanded: string[] = [];
      
      items.forEach(item => {
        if (item.children && item.children.length > 0) {
          const hasActiveChild = item.children.some(child => 
            child.href && (currentPath === child.href || currentPath.startsWith(child.href + '/'))
          ) || item.children.some(child => {
            if (child.children) {
              return findExpandedItems([child], currentPath, level + 1).length > 0
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
    
    const expanded = findExpandedItems(adminNavItems, pathname)
    setExpandedItems(new Set(expanded))
  }, [pathname])

  // Close sidebar when navigating on mobile
  const handleMobileNavClick = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  // Toggle expand/collapse for nested items
  const toggleExpand = (itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(itemId)) {
        newSet.delete(itemId)
      } else {
        newSet.add(itemId)
      }
      return newSet
    })
  };

  // Recursive component for rendering navigation items
  const NavItemComponent = ({ 
    item, 
    level = 0,
    isMobile = false 
  }: { 
    item: NavItem
    level?: number
    isMobile?: boolean
  }) => {
    const isActive = item.href && (pathname === item.href || pathname.startsWith(item.href + '/'))
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedItems.has(item.href || item.label)
    const indent = level * 16

    if (hasChildren) {
      return (
        <div className={`${isMobile ? 'mb-2' : 'mb-1'}`}>
          <button
            onClick={() => toggleExpand(item.href || item.label)}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              isActive 
                ? 'bg-blue-50 text-blue-700' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
            style={{ paddingLeft: `${12 + indent}px` }}
          >
            {item.icon && (
              <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                {item.icon}
              </span>
            )}
            <span className="flex-1 text-left">{item.label}</span>
            <svg
              className={`w-4 h-4 transition-transform text-gray-400 ${
                isExpanded ? 'rotate-90' : ''
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          
          {isExpanded && (
            <div className="mt-1">
              {item.children!.map((child) => (
                <NavItemComponent
                  key={child.href || child.label}
                  item={child}
                  level={level + 1}
                  isMobile={isMobile}
                />
              ))}
            </div>
          )}
        </div>
      )
    }

    return (
      <a
        href={item.href}
        onClick={handleMobileNavClick}
        className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
          isMobile ? 'mb-2' : 'mb-1'
        } ${
          isActive 
            ? 'bg-blue-50 text-blue-700' 
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        style={{ paddingLeft: `${12 + indent}px` }}
      >
        {item.icon && (
          <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
            {item.icon}
          </span>
        )}
        <span>{item.label}</span>
        {item.badge && (
          <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ml-auto ${
            item.badge.variant === 'default' ? 'bg-gray-100 text-gray-800' :
            item.badge.variant === 'success' ? 'bg-green-100 text-green-800' :
            item.badge.variant === 'warning' ? 'bg-yellow-100 text-yellow-800' :
            item.badge.variant === 'error' ? 'bg-red-100 text-red-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            {item.badge.text}
          </span>
        )}
      </a>
    )
  };

  // Mobile breadcrumb navigation
  const MobileBreadcrumb = () => {
    if (!isMobile) return null;

    const currentItem = adminNavItems.find(item => 
      pathname === item.href || pathname.startsWith(item.href + '/')
    );

    if (!currentItem) return null;

    return (
      <div className="md:hidden bg-white border-b border-neutral-200 px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
            aria-label="Open navigation"
          >
            <svg className="h-5 w-5 text-neutral-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2 text-neutral-600">
            <span>Admin</span>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="font-medium text-neutral-900">{currentItem.label}</span>
          </div>
        </div>
      </div>
    );
  };

  // Mobile overlay sidebar
  const MobileSidebar = () => {
    if (!isMobile || !sidebarOpen) return null;

    return (
      <>
        {/* Overlay */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
        
        {/* Mobile Sidebar */}
        <div className="fixed inset-y-0 left-0 w-80 bg-white shadow-xl z-50 md:hidden transform transition-transform duration-300 ease-in-out">
          <div className="flex items-center justify-between p-4 border-b border-neutral-200">
            <h2 className="text-lg font-semibold text-neutral-900">Admin Navigation</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
              aria-label="Close navigation"
            >
              <svg className="h-5 w-5 text-neutral-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Mobile Navigation Items */}
          <div className="flex-1 overflow-y-auto p-4">
            {adminNavItems.map((item) => (
              <NavItemComponent
                key={item.href || item.label}
                item={item}
                isMobile={true}
              />
            ))}
          </div>
        </div>
      </>
    );
  };

  if (isMobile) {
    // Mobile layout: overlay sidebar + full-width content
    return (
      <div className="min-h-screen bg-neutral-50">
        <MobileSidebar />
        <MobileBreadcrumb />
        <main className="flex-1">
          {children}
        </main>
      </div>
    );
  }

  // Desktop layout: sidebar + content
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
        <div className="p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Admin Navigation</h2>
          <nav className="space-y-1">
            {adminNavItems.map((item) => (
              <NavItemComponent
                key={item.href || item.label}
                item={item}
                isMobile={false}
              />
            ))}
          </nav>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <main className="h-full">
          {children}
        </main>
      </div>
    </div>
  );
}
