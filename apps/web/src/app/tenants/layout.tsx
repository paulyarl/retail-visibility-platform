import SettingsFooter from '@/components/SettingsFooter';
import GeneralSidebar from '@/components/GeneralSidebar';
import Link from 'next/link';

export default function TenantsLayout({ children }: { children: React.ReactNode }) {
  const nav = [
    { label: 'Your Tenants', href: '/tenants' },
    { label: 'Onboarding', href: '/onboarding?force=1' },
    { label: 'Manage Categories', href: '/tenants/categories' },
    { label: 'Feed Validation', href: '/tenants/feed-validation' },
    { label: 'Settings', href: '/settings' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="flex flex-1">
        <GeneralSidebar nav={nav} />
        <section className="flex-1 p-6">{children}</section>
      </div>
      <SettingsFooter />
    </div>
  );
}
