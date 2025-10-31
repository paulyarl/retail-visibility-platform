"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  const pathname = usePathname();
  
  // Auto-generate breadcrumbs from pathname if not provided
  const breadcrumbItems = items || generateBreadcrumbs(pathname);
  
  if (breadcrumbItems.length === 0) return null;
  
  return (
    <nav className={`flex items-center space-x-2 text-sm text-neutral-600 ${className}`} aria-label="Breadcrumb">
      {breadcrumbItems.map((item, index) => (
        <div key={index} className="flex items-center">
          {index > 0 && (
            <svg className="h-4 w-4 mx-2 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
          {item.href ? (
            <Link 
              href={item.href}
              className="hover:text-primary-600 transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-neutral-900 font-medium">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}

// Auto-generate breadcrumbs from pathname
function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [{ label: 'Home', href: '/' }];
  
  let currentPath = '';
  
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === segments.length - 1;
    
    // Format segment label
    let label = segment
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
    
    // Special cases
    if (segment === 't') label = 'Tenant';
    if (segment === 'items') label = 'Inventory';
    if (segment === 'products') label = 'Products';
    if (segment === 'tenants') label = 'Locations';
    
    // Don't add href for last item (current page)
    breadcrumbs.push({
      label,
      href: isLast ? undefined : currentPath,
    });
  });
  
  return breadcrumbs;
}

export default Breadcrumbs;
