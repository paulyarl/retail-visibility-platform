import { ReactNode } from 'react';
import { AdminGuard } from '@/components/admin/AdminGuard';
import ContextualBreadcrumbs from '@/components/ContextualBreadcrumbs';

// Admin sidebar is rendered by SettingsLayoutRouter in the parent settings/layout.tsx
// AdminGuard enforces PLATFORM_ADMIN_ONLY access control for all admin pages
// ContextualBreadcrumbs provides universal breadcrumb navigation for admin pages
export default function AdminSettingsLayout({ children }: { children: ReactNode }) {
  return (
    <AdminGuard>
      <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 px-4 py-3">
        <ContextualBreadcrumbs />
      </div>
      {children}
    </AdminGuard>
  );
}
