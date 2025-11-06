/**
 * Reusable Access Denied Component
 * 
 * Displays a consistent access denied message across the platform
 */

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';

export interface AccessDeniedProps {
  title?: string;
  message?: string;
  userRole?: string | null;
  backLink?: {
    href: string;
    label: string;
  };
  showPageHeader?: boolean;
  pageTitle?: string;
  pageDescription?: string;
}

export default function AccessDenied({
  title = 'Access Restricted',
  message = 'You do not have permission to access this resource.',
  userRole,
  backLink = { href: '/tenants', label: 'Back to Dashboard' },
  showPageHeader = true,
  pageTitle = 'Access Denied',
  pageDescription = 'Permission required',
}: AccessDeniedProps) {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {showPageHeader && (
        <PageHeader
          title={pageTitle}
          description={pageDescription}
          icon={Icons.Admin}
          backLink={backLink}
        />
      )}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <svg 
                className="w-16 h-16 text-amber-400 mx-auto mb-4" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
                />
              </svg>
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                {title}
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400 mb-2">
                {message}
              </p>
              {userRole && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
                  Your current role: <strong className="text-neutral-700 dark:text-neutral-300">{userRole}</strong>
                </p>
              )}
              <Link 
                href={backLink.href} 
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
              >
                {backLink.label}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
