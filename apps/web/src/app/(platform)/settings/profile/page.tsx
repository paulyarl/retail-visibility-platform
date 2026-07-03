"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Card, Title, Text, Badge, Stack, Group, SimpleGrid, Loader, Anchor } from '@mantine/core';
import { platformHomeService } from '@/services/PlatformHomeSingletonService';

export const dynamic = 'force-dynamic';

const BUSINESS_TYPES = [
  { id: 'retail', label: 'Retail Store', icon: '🏪' },
  { id: 'restaurant', label: 'Restaurant/Food Service', icon: '🍽️' },
  { id: 'service', label: 'Service Business', icon: '🔧' },
  { id: 'ecommerce', label: 'E-commerce', icon: '🛒' },
  { id: 'other', label: 'Other', icon: '📦' },
];

interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  businessType?: string;
  phone?: string;
  role: string;
  tenants?: Array<{ id: string; name: string; role: string }>;
  onboardingCompleted?: boolean;
}

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
      return;
    }

    if (user) {
      setProfile({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        businessName: user.businessName,
        businessType: user.businessType,
        phone: user.phone,
        role: user.role,
        tenants: user.tenants,
        onboardingCompleted: user.onboardingCompleted,
      });
      setIsLoading(false);
    }
  }, [user, isAuthenticated, authLoading]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <nav className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mb-4">
            <Link href="/" className="hover:text-neutral-700 dark:hover:text-neutral-200">Dashboard</Link>
            <span>/</span>
            <span className="text-neutral-900 dark:text-neutral-100">Profile</span>
          </nav>
          <Title order={1}>Your Profile</Title>
          <Text c="dimmed" mt="xs">Manage your personal and business information</Text>
        </div>

        {/* Profile Card */}
        <Card withBorder p={0} radius="lg" className="overflow-hidden">
          {/* Personal Info Section */}
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
            <Group justify="space-between" mb="md">
              <Group gap="sm">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <Title order={3}>Personal Information</Title>
              </Group>
              <Anchor component={Link} href="/settings/account" size="sm">
                Edit Account Settings →
              </Anchor>
            </Group>

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" mb={4}>Full Name</Text>
                <Text size="sm" fw={500}>
                  {profile.firstName || profile.lastName 
                    ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim()
                    : 'Not set'}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" mb={4}>Email</Text>
                <Text size="sm" fw={500}>{profile.email}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" mb={4}>Phone</Text>
                <Text size="sm" fw={500}>{profile.phone || 'Not set'}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" mb={4}>Platform Role</Text>
                <Badge color="blue" variant="light">{profile.role}</Badge>
              </div>
            </SimpleGrid>
          </div>

          {/* Business Info Section */}
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
            <Group justify="space-between" mb="md">
              <Group gap="sm">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <Title order={3}>Business Information</Title>
              </Group>
              {!profile.businessName && (
                <Anchor component={Link} href="/onboarding" size="sm">
                  Complete Onboarding →
                </Anchor>
              )}
            </Group>

            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" mb={4}>Business Name</Text>
                <Text size="sm" fw={500}>{profile.businessName || 'Not set'}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" mb={4}>Business Type</Text>
                <Text size="sm" fw={500}>
                  {profile.businessType 
                    ? BUSINESS_TYPES.find(t => t.id === profile.businessType)?.label || profile.businessType
                    : 'Not set'}
                </Text>
              </div>
            </SimpleGrid>
          </div>

          {/* Locations Section */}
          <div className="p-6">
            <Group justify="space-between" mb="md">
              <Group gap="sm">
                <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <Title order={3}>Your Locations</Title>
              </Group>
              <Anchor component={Link} href="/tenants" size="sm">
                Manage All Locations →
              </Anchor>
            </Group>

            {profile.tenants && profile.tenants.length > 0 ? (
              <Stack gap="sm">
                {profile.tenants.map((tenant) => (
                  <Link
                    key={tenant.id}
                    href={`/t/${tenant.id}/dashboard`}
                    className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700/50 transition-colors"
                  >
                    <div>
                      <Text fw={500}>{tenant.name}</Text>
                      <Text size="sm" c="dimmed">Role: {tenant.role}</Text>
                    </div>
                    <Group gap="sm">
                      <Badge color="green" variant="light">Active</Badge>
                      <svg className="w-5 h-5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Group>
                  </Link>
                ))}
              </Stack>
            ) : (
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <Text c="dimmed" mb="md">No locations yet</Text>
                <Link
                  href="/tenants"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Your First Location
                </Link>
              </div>
            )}
          </div>
        </Card>

        {/* Quick Actions */}
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md" mt="md">
          <Link
            href="/settings/account"
            className="flex items-center gap-3 p-4 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all"
          >
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <Text fw={500}>Account Settings</Text>
              <Text size="sm" c="dimmed">Password, email, security</Text>
            </div>
          </Link>

          <Link
            href="/tenants"
            className="flex items-center gap-3 p-4 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all"
          >
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <Text fw={500}>Manage Locations</Text>
              <Text size="sm" c="dimmed">Add, edit, remove stores</Text>
            </div>
          </Link>

          <Link
            href="/settings/subscription"
            className="flex items-center gap-3 p-4 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all"
          >
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <Text fw={500}>Subscription</Text>
              <Text size="sm" c="dimmed">Plans, billing, invoices</Text>
            </div>
          </Link>
        </SimpleGrid>
      </div>
    </div>
  );
}
