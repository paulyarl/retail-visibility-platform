"use client";

import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

type ScopeType = 'tenant' | 'admin' | 'universal';

interface ScopeSwitcherProps {
  scope: ScopeType;
  collapsed?: boolean;
  tenantId?: string;
}

const PLATFORM_ROLES = ['PLATFORM_ADMIN', 'PLATFORM_SUPPORT'];

export function ScopeSwitcher({ scope, collapsed = false, tenantId }: ScopeSwitcherProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user) return null;

  const isPlatformAdmin = PLATFORM_ROLES.includes(user.role);
  if (!isPlatformAdmin) return null;

  const links: { label: string; href: string; icon: React.ReactNode; scope: ScopeType }[] = [];

  // Admin link — shown in tenant and universal scopes
  if (scope !== 'admin') {
    links.push({
      label: 'Admin Panel',
      href: '/settings/admin',
      scope: 'admin',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    });
  }

  // Tenant link — shown in admin and universal scopes
  if (scope !== 'tenant') {
    // If we know the current tenantId, link directly to it; otherwise link to /tenants
    const tenantHref = tenantId ? `/t/${tenantId}/dashboard` : '/tenants';
    links.push({
      label: 'Tenant View',
      href: tenantHref,
      scope: 'tenant',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    });
  }

  // Also show "My Locations" in admin scope for quick tenant switching
  if (scope === 'admin') {
    links.push({
      label: 'My Locations',
      href: '/tenants',
      scope: 'tenant',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    });
  }

  if (links.length === 0) return null;

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1 py-2 border-b border-neutral-100 dark:border-neutral-800">
        {links.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
          return (
            <a
              key={link.label}
              href={link.href}
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                isActive
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                  : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200'
              )}
              title={link.label}
            >
              {link.icon}
            </a>
          );
        })}
      </div>
    );
  }

  return (
    <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-800">
      <div className="flex flex-col gap-1">
        {links.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
          return (
            <a
              key={link.label}
              href={link.href}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors',
                isActive
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200'
              )}
            >
              {link.icon}
              <span>{link.label}</span>
              <svg className="w-3 h-3 ml-auto opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </a>
          );
        })}
      </div>
    </div>
  );
}
