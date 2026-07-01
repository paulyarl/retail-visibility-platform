"use client";

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Card as MantineCard, Group, Badge, Text, Title, Box, Tooltip } from '@mantine/core';
import PageHeader from '@/components/PageHeader';
import { ProtectedCard } from '@/lib/auth/ProtectedCard';
import { CachedProtectedCard } from '@/lib/auth/CachedProtectedCard';
import SettingsSearch from '@/components/SettingsSearch';
import { Loader2, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTenantBehaviorAccess } from '@/hooks/tenant-access/useTenantBehaviorAccess';


// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export type UnifiedSettingCard = {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
  badge?: string;
  accessOptions?: any;
  secondaryLink?: {
    label: string;
    href: string;
    icon?: string;
  };
};


export type UnifiedSettingsGroup = {
  title: string;
  description: string;
  cards: UnifiedSettingCard[];
  accessOptions?: any; // Group-level access control
};


export type UnifiedSettingsConfig = {
  title: string;
  description: string;
  groups: UnifiedSettingsGroup[];
  showLimits?: boolean; // For platform settings
  tenantId?: string; // For tenant-scoped settings
};

interface UnifiedSettingsProps {
  config: UnifiedSettingsConfig;
}


export default function UnifiedSettings({ config }: UnifiedSettingsProps) {
  const router = useRouter();
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const { canEdit } = useTenantBehaviorAccess(config.tenantId || '');

  const handleCardClick = async (href: string) => {
    setNavigatingTo(href);
    try {
      await router.push(href);
    } finally {
      // Small delay to show loading state even for fast navigation
      setTimeout(() => setNavigatingTo(null), 500);
    }
  };

  const handleSecondaryLinkClick = async (e: React.MouseEvent, href: string) => {
    e.stopPropagation();
    setNavigatingTo(href);
    try {
      await router.push(href);
    } finally {
      setTimeout(() => setNavigatingTo(null), 500);
    }
  };

  // Prepare search data from config
  const searchSettings = config.groups.map(group => ({
    title: group.title,
    description: group.description,
    href: `#${group.title.toLowerCase().replace(/\s+/g, '-')}`,
    items: group.cards.map(card => ({
      title: card.title,
      description: card.description,
      href: card.href
    }))
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title={config.title}
        description={config.description}
      />

      {/* Settings Search */}
      <div className="mb-8">
        <SettingsSearch
          settings={searchSettings}
          onResultClick={async (href) => {
            if (href.startsWith('#')) {
              // Scroll to section
              const element = document.querySelector(href);
              element?.scrollIntoView({ behavior: 'smooth' });
            } else {
              setNavigatingTo(href);
              try {
                await router.push(href);
              } finally {
                setTimeout(() => setNavigatingTo(null), 500);
              }
            }
          }}
        />
      </div>

      <div className="space-y-12">
        {/* Platform-specific elements */}
        {config.showLimits && (
          <div className="mb-8">
            {/* TenantLimitBadge would go here */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Tenant limits and upgrade options would be displayed here
              </p>
            </div>
          </div>
        )}

        {config.groups.map((group, index) => (
          <div
            key={group.title}
            id={group.title.toLowerCase().replace(/\s+/g, '-')}
            className="scroll-mt-8"
          >
            <CachedProtectedCard accessOptions={group.accessOptions} tenantId={config.tenantId}>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {group.title}
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {group.description}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {group.cards.map((card, index) => {
                  const cardRequiresAdmin = card.accessOptions?.roles?.includes('admin');
                  const isCardDisabled = !canEdit && cardRequiresAdmin;

                  return (
                  <CachedProtectedCard
                    key={`${card.title}-${index}`}
                    accessOptions={card.accessOptions}
                    tenantId={config.tenantId}
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.3 }}
                    >
                      <Tooltip label="Admin access required" disabled={!isCardDisabled} position="top">
                        <MantineCard
                          onClick={isCardDisabled ? undefined : () => handleCardClick(card.href)}
                          className={`${isCardDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} h-full relative group transition-all duration-200 ${isCardDisabled ? '' : 'hover:shadow-lg hover:border-primary-300 dark:hover:border-primary-600'}`}
                          padding="lg"
                          radius="md"
                          style={navigatingTo === card.href ? { opacity: 0.75 } : undefined}
                        >
                          {navigatingTo === card.href && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 rounded-md z-10">
                              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                            </div>
                          )}

                          <Group justify="space-between" align="flex-start" gap="md">
                            <div className={`${card.color} p-3 rounded-lg text-white flex-shrink-0 shadow-sm ${isCardDisabled ? 'opacity-50' : ''}`}>
                              {card.icon}
                            </div>
                            {isCardDisabled ? (
                              <Badge
                                variant="light"
                                color="gray"
                                size="sm"
                                leftSection={<Lock className="w-3 h-3" />}
                              >
                                Admin
                              </Badge>
                            ) : card.badge ? (
                              <Badge
                                variant="light"
                                color="primary"
                                size="sm"
                              >
                                {card.badge}
                              </Badge>
                            ) : null}
                          </Group>

                          <Box mt="md">
                            <Title
                              order={4}
                              className={`text-lg font-semibold text-gray-900 dark:text-white ${isCardDisabled ? '' : 'group-hover:text-primary-600 dark:group-hover:text-primary-400'} transition-colors`}
                            >
                              {card.title}
                            </Title>
                            <Text
                              size="sm"
                              c="dimmed"
                              mt={8}
                              className="text-gray-600 dark:text-gray-400"
                            >
                              {card.description}
                            </Text>
                          </Box>

                          {card.secondaryLink && !isCardDisabled && (
                            <Box mt="md" pt="md" className="border-t border-gray-200 dark:border-gray-700">
                              <button
                                onClick={(e) => handleSecondaryLinkClick(e, card.secondaryLink!.href)}
                                className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50 transition-colors"
                                disabled={navigatingTo === card.secondaryLink!.href}
                              >
                                {navigatingTo === card.secondaryLink!.href ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                )}
                                {card.secondaryLink.label}
                              </button>
                            </Box>
                          )}
                        </MantineCard>
                      </Tooltip>
                    </motion.div>
                  </CachedProtectedCard>
                  );
                })}
              </div>
            </CachedProtectedCard>
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper function to create tenant-scoped hrefs

export const createTenantHref = (tenantId: string, path: string) => {
  return path.replace('[tenantId]', tenantId);
};

// Helper function to transform legacy settings config to unified format

export const transformToUnifiedConfig = (
  legacyGroups: any[],
  config: Partial<UnifiedSettingsConfig>
): UnifiedSettingsConfig => {
  return {
    title: config.title || 'Settings',
    description: config.description || 'Manage your settings',
    groups: legacyGroups.map(group => ({
      title: group.title,
      description: group.description,
      cards: group.cards.map((card: any) => ({
        ...card,
        href: config.tenantId ? card.href.replace('[tenantId]', config.tenantId) : card.href
      }))
    })),
    ...config
  };
};
