"use client";

import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, AnimatedCard } from '@/components/ui';
import ProtectedRoute from '@/components/ProtectedRoute';
import PageHeader, { Icons } from '@/components/PageHeader';
import { ProtectedCard } from '@/lib/auth/ProtectedCard';
import { AccessPresets } from '@/lib/auth/useAccessControl';
import { AccessControlOptions } from '@/lib/auth/access-control';

type SettingCard = {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
  badge?: string;
  // Legacy boolean flags (will be replaced with accessOptions)
  adminOnly?: boolean;
  platformAdminOnly?: boolean;
  personalOnly?: boolean;
  // New centralized access control
  accessOptions?: AccessControlOptions;
  fetchOrganization?: boolean;
};

type SettingsGroup = {
  title: string;
  description: string;
  adminOnly?: boolean;
  cards: SettingCard[];
};

export default function SettingsPage({ hideAdmin = false, tenantId }: { hideAdmin?: boolean; tenantId?: string } = {}) {
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
          personalOnly: true,
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
          personalOnly: true,
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
        {
          title: 'My Subscription',
          description: 'Manage your plan, view features, and request changes',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          ),
          href: '/settings/subscription',
          color: 'bg-primary-500',
          badge: 'Manage',
        },
      ],
    },
    // Organization Management (only when tenantId is provided and user is in an org)
    ...(tenantId ? [{
      title: 'Organization Management',
      description: 'Manage your chain organization and multi-location features',
      cards: [
        {
          title: 'Chain Analytics',
          description: 'View chain-wide SKU usage and location breakdown',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/organization`,
          color: 'bg-orange-500',
          badge: 'Chain',
        },
        {
          title: 'Propagation Control Panel',
          description: 'Manage multi-location propagation for chains',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/propagation`,
          color: 'bg-indigo-500',
          badge: 'Chain',
        },
      ] as SettingCard[],
    }] : []),
    {
      title: tenantId ? 'Store Settings' : 'Tenant Management',
      description: tenantId ? 'Configure your store profile and settings' : 'Manage your business locations',
      cards: [
        {
          title: tenantId ? 'Store Profile' : 'Tenant Settings',
      description: tenantId ? 'Edit store identity and contact details' : 'Manage your business locations',
      icon: (
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      href: tenantId ? `/t/${tenantId}/settings/tenant` : '/tenants',
      color: 'bg-blue-500',
    },
        {
          title: 'Organization Dashboard',
          description: 'Manage multi-location chains and propagation',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          ),
          href: tenantId ? `/t/${tenantId}/settings/organization` : '/settings/organization',
          color: 'bg-amber-500',
          accessOptions: AccessPresets.ORGANIZATION_MEMBER,
          fetchOrganization: true,
        },
        ...(tenantId ? [{
          title: 'Business Profile',
          description: 'Edit store identity and contact details',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/tenant`,
          color: 'bg-teal-500',
        },
        {
          title: 'Branding',
          description: 'Customize your store logo and visual identity',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/branding`,
          color: 'bg-purple-500',
        }] as SettingCard[] : []),
        // Tenant Administration cards (only when tenantId is provided)
        ...(tenantId ? [
          {
            title: 'Feature Flags',
            description: 'Control per-tenant features',
            icon: (
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
              </svg>
            ),
            href: `/t/${tenantId}/settings/admin/flags`,
            color: 'bg-purple-500',
            accessOptions: AccessPresets.PLATFORM_ADMIN_ONLY,
            badge: 'Admin',
          },
        ] : []) as SettingCard[],
      ],
    },
    {
      title: tenantId ? 'Team' : 'Team Management',
      description: tenantId ? 'Manage your store team members' : 'Manage your store team and access levels',
      cards: [
        {
          title: tenantId ? 'Team Members' : 'Tenant Users',
          description: tenantId ? 'Invite and manage your store team' : 'Manage users across all your locations',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ),
          href: tenantId ? `/t/${tenantId}/settings/users` : '/tenants/users',
          color: 'bg-cyan-500',
        },
      ],
    },
    // Google Business Profile (only when tenantId is provided)
    ...(tenantId ? [{
      title: 'Google Business Profile',
      description: 'Manage your Google Business Profile integration',
      cards: [
        {
          title: 'Business Hours',
          description: 'Manage hours and special days (syncs to Google)',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/hours`,
          color: 'bg-green-500',
          badge: 'Auto-Sync',
        },
        {
          title: 'Business Category',
          description: 'Set your Google Business Profile category',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          ),
          href: `/t/${tenantId}/settings/gbp-category`,
          color: 'bg-amber-500',
          badge: 'M3',
        },
        {
          title: 'Product Categories',
          description: 'Manage product categories for your inventory',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          ),
          href: `/t/${tenantId}/categories`,
          color: 'bg-indigo-500',
        },
      ] as SettingCard[],
    }] : []),
    {
      title: 'User Administration',
      description: 'Manage platform users and permissions',
      adminOnly: true,
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
          accessOptions: AccessPresets.PLATFORM_ADMIN_ONLY,
        },
        {
          title: 'Platform User Maintenance',
          description: 'Manage users, roles, and permissions',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ),
          href: '/settings/admin/users',
          color: 'bg-orange-500',
          accessOptions: AccessPresets.PLATFORM_ADMIN_ONLY,
        },
      ],
    },
    {
      title: 'Platform Administration',
      description: 'Platform-level tools, analytics, and system controls',
      adminOnly: true,
      cards: [
        {
          title: 'Admin Dashboard',
          description: 'Organizations, permissions, analytics, and developer tools',
          icon: (
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
          href: '/settings/admin',
          color: 'bg-purple-500',
          accessOptions: AccessPresets.PLATFORM_ADMIN_ONLY,
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

  // No manual filtering needed - ProtectedCard handles visibility
  const displayGroups = settingsGroups
    .filter(g => hideAdmin ? !g.adminOnly : true)
    .filter(group => group.cards.length > 0); // Remove empty groups

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
        <PageHeader
          title="Settings"
          description="Manage your account and preferences"
          icon={Icons.Settings}
          backLink={{
            href: '/tenants',
            label: 'Back to Dashboard'
          }}
        />

        {/* Settings Groups */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
          {displayGroups.map((group, groupIndex) => (
            <div key={group.title}>
              {/* Group Header */}
              <div className="mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                    {group.title}
                  </h2>
                  {group.adminOnly && (
                    <span className="px-3 py-1 text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 rounded-full">
                      Admin Only
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  {group.description}
                </p>
              </div>

              {/* Group Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {group.cards.map((setting, cardIndex) => {
                  return (
                    <ProtectedCard
                      key={setting.href}
                      tenantId={tenantId || null}
                      accessOptions={setting.accessOptions}
                      fetchOrganization={setting.fetchOrganization}
                    >
                      <AnimatedCard
                        delay={(groupIndex * group.cards.length + cardIndex) * 0.05}
                        onClick={() => {
                      // Special handling for tenant-specific pages
                      if (setting.href === '/settings/tenant' || setting.href === '/tenants/users') {
                        const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;
                        if (tenantId) {
                          if (setting.href === '/tenants/users') {
                            router.push(`/tenants/${tenantId}/users`);
                          } else {
                            router.push(`/t/${tenantId}/settings`);
                          }
                        } else {
                          router.push('/tenants');
                        }
                      } else {
                        router.push(setting.href);
                      }
                    }}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                  >
                    <CardHeader>
                      <div className="flex items-start gap-4">
                        <div className={`${setting.color} p-3 rounded-lg text-white shadow-sm`}>
                          {setting.icon}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle>{setting.title}</CardTitle>
                            {setting.badge && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded">
                                {setting.badge}
                              </span>
                            )}
                          </div>
                          <CardDescription className="mt-1">
                            {setting.description}
                          </CardDescription>
                        </div>
                        <svg
                          className="h-5 w-5 text-neutral-400 flex-shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </CardHeader>
                  </AnimatedCard>
                    </ProtectedCard>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Quick Actions */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common settings tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => {
                    const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;
                    if (tenantId) {
                      router.push(`/t/${tenantId}/settings`);
                    } else {
                      router.push('/tenants');
                    }
                  }}
                  className="flex items-center gap-3 p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors text-left"
                >
                  <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-neutral-900">Tenant Settings</div>
                    <div className="text-sm text-neutral-500">Update business profile</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;
                    if (tenantId) {
                      router.push(`/t/${tenantId}/onboarding?force=1&step=profile`);
                    } else {
                      router.push('/tenants');
                    }
                  }}
                  className="flex items-center gap-3 p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors text-left"
                >
                  <div className="h-10 w-10 bg-teal-100 rounded-lg flex items-center justify-center">
                    <svg className="h-5 w-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-neutral-900">Business Profile</div>
                    <div className="text-sm text-neutral-500">Edit store identity</div>
                  </div>
                </button>

                <button
                  onClick={() => router.push('/tenants')}
                  className="flex items-center gap-3 p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors text-left"
                >
                  <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-neutral-900">View All Tenants</div>
                    <div className="text-sm text-neutral-500">Browse all business locations</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    // For admins, go to items page which will prompt for tenant selection
                    // This maintains consistency with "View All Tenants" approach
                    router.push('/items');
                  }}
                  className="flex items-center gap-3 p-4 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors text-left"
                >
                  <div className="h-10 w-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <svg className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium text-neutral-900">Manage Inventory</div>
                    <div className="text-sm text-neutral-500">View products across tenants</div>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}
