"use client";

import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, AnimatedCard } from '@/components/ui';
import PageHeader from '@/components/PageHeader';
import { ProtectedCard } from '@/lib/auth/ProtectedCard';
import { AccessPresets } from '@/lib/auth/useAccessControl';
import TenantLimitBadge from '@/components/tenant/TenantLimitBadge';

type SettingCard = {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
  badge?: string;
  accessOptions?: any;
};

type SettingsGroup = {
  title: string;
  description: string;
  cards: SettingCard[];
};

export default function PlatformSettings() {
  const router = useRouter();

  const settingsGroups: SettingsGroup[] = [
    {
      title: 'Account & Preferences',
      description: 'Personalize your experience',
      cards: [
        {
          title: 'My Account',
          description: 'View your role, privileges, and account information',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          ),
          href: '/settings/account',
          color: 'bg-blue-500',
        },
        {
          title: 'Appearance',
          description: 'Customize theme and visual preferences',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          ),
          href: '/settings/appearance',
          color: 'bg-indigo-500',
        },
        {
          title: 'Language & Region',
          description: 'Choose your preferred language',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
          ),
          href: '/settings/language',
          color: 'bg-teal-500',
        },
      ],
    },
    {
      title: 'Subscription & Billing',
      description: 'Manage your plan and services',
      cards: [
        {
          title: 'Platform Offerings',
          description: 'View all subscription tiers, managed services, and benefits',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          ),
          href: '/settings/offerings',
          color: 'bg-emerald-500',
          badge: 'Explore',
        },
      ],
    },
    {
      title: 'Tenant Management',
      description: 'Manage your business locations',
      cards: [
        {
          title: 'Tenant Settings',
          description: 'Manage your business locations',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          ),
          href: '/tenants',
          color: 'bg-blue-500',
        },
        {
          title: 'Location Limits',
          description: 'View your tenant creation limits and upgrade options',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
          href: '/settings/limits',
          color: 'bg-purple-500',
        },
      ],
    },
    {
      title: 'User Administration',
      description: 'Manage platform users and permissions',
      cards: [
        {
          title: 'Test User Management',
          description: 'Create and manage platform users for testing',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          ),
          href: '/admin/users',
          color: 'bg-blue-500',
          accessOptions: AccessPresets.PLATFORM_STAFF,
        },
        {
          title: 'Platform User Maintenance',
          description: 'View users, roles, and permissions (Support: read-only)',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ),
          href: '/settings/admin/users',
          color: 'bg-orange-500',
          accessOptions: AccessPresets.PLATFORM_STAFF,
        },
      ],
    },
    {
      title: 'Platform Administration',
      description: 'Platform-level tools, analytics, and system controls',
      cards: [
        {
          title: 'Admin Dashboard',
          description: 'Organizations, permissions, analytics (Support: read-only)',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
          href: '/settings/admin',
          color: 'bg-purple-500',
          accessOptions: AccessPresets.PLATFORM_STAFF,
        },
      ],
    },
    {
      title: 'Support & Help',
      description: 'Get assistance and contact our team',
      cards: [
        {
          title: 'Contact Us',
          description: 'Get in touch with our team for help or questions',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          ),
          href: '/settings/contact',
          color: 'bg-pink-500',
          badge: 'Help',
        },
      ],
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="Platform Settings"
        description="Manage platform-wide settings and administration"
      />

      <div className="space-y-12">
        {/* Tenant Limits Badge - Prominent Display */}
        <div className="mb-8">
          <TenantLimitBadge variant="full" showUpgrade={true} />
        </div>

        {settingsGroups.map((group) => (
          <div key={group.title}>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {group.title}
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {group.description}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {group.cards.map((card) => (
                <ProtectedCard
                  key={card.title}
                  accessOptions={card.accessOptions}
                >
                  <AnimatedCard
                    onClick={() => router.push(card.href)}
                    className="cursor-pointer h-full"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className={`${card.color} p-3 rounded-lg text-white`}>
                          {card.icon}
                        </div>
                        {card.badge && (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200">
                            {card.badge}
                          </span>
                        )}
                      </div>
                      <CardTitle className="mt-4">{card.title}</CardTitle>
                      <CardDescription>{card.description}</CardDescription>
                    </CardHeader>
                  </AnimatedCard>
                </ProtectedCard>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
