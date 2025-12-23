import SettingsFooter from '@/components/SettingsFooter';
import ContextualBreadcrumbs from '@/components/ContextualBreadcrumbs';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">
        {/* Add breadcrumbs for navigation context */}
        <div className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 px-4 py-3">
          <ContextualBreadcrumbs />
        </div>
        {children}
      </div>
      <SettingsFooter />
    </div>
  );
}
