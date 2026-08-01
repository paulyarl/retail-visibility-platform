'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Paper, NavLink, Group, Text, Divider, Badge, Box } from '@mantine/core';
import {
  IconLayoutDashboard,
  IconTarget,
  IconMessage,
  IconFiles,
  IconPalette,
  IconFilter,
  IconChartBar,
  IconMail,
  IconFlask,
  IconShield,
} from '@tabler/icons-react';

const NAV_ITEMS = [
  { href: '/settings/admin/marketing-ops', label: 'Dashboard', icon: IconLayoutDashboard, emoji: '📊' },
  { href: '/settings/admin/marketing-ops/campaigns', label: 'Campaigns', icon: IconTarget, emoji: '🎯' },
  { href: '/settings/admin/marketing-ops/recovery', label: 'Recovery', icon: IconShield, emoji: '🛡️' },
  { href: '/settings/admin/marketing-ops/prompts', label: 'Prompts', icon: IconMessage, emoji: '💬' },
  { href: '/settings/admin/marketing-ops/openers', label: 'Openers', icon: IconMail, emoji: '✉️' },
  { href: '/settings/admin/marketing-ops/follow-ups', label: 'Follow-Ups', icon: IconMail, emoji: '📨' },
  { href: '/settings/admin/marketing-ops/split-tests', label: 'Split Tests', icon: IconFlask, emoji: '🧪' },
  { href: '/settings/admin/marketing-ops/deliverable-templates', label: 'Deliverable Templates', icon: IconFiles, emoji: '📄' },
  { href: '/settings/admin/marketing-ops/branding', label: 'Branding', icon: IconPalette, emoji: '🎨' },
  { href: '/settings/admin/marketing-ops/filter-review', label: 'Filter Review', icon: IconFilter, emoji: '🔍' },
  { href: '/settings/admin/marketing-ops/scorecards', label: 'Scorecards', icon: IconChartBar, emoji: '🏆' },
] as const;

interface MarketingOpsNavPanelProps {
  counts?: {
    campaigns?: number;
    prompts?: number;
    deliverableTemplates?: number;
  };
}

export default function MarketingOpsNavPanel({ counts }: MarketingOpsNavPanelProps) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/settings/admin/marketing-ops') return pathname === '/settings/admin/marketing-ops';
    return pathname.startsWith(href);
  }

  return (
    <Paper
      shadow="xs"
      radius="md"
      withBorder
      p="sm"
      style={{ background: 'var(--mantine-color-body)' }}
    >
      <Group px="sm" py="xs" gap="xs">
        <Text size="lg" fw={700} c="var(--mantine-color-violet-filled)">
          Marketing Ops
        </Text>
        <Badge size="xs" variant="light" color="violet">
          Admin
        </Badge>
      </Group>

      <Divider my={4} />

      <Box>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const countKey = (
            item.label === 'Campaigns' ? 'campaigns' :
            item.label === 'Prompts' ? 'prompts' :
            item.label === 'Deliverable Templates' ? 'deliverableTemplates' :
            undefined
          ) as keyof NonNullable<typeof counts> | undefined;
          const count = countKey ? counts?.[countKey] : undefined;

          return (
            <NavLink
              key={item.href}
              component={Link}
              href={item.href}
              label={
                <Group gap="xs" wrap="nowrap">
                  <Text size="sm" fw={active ? 600 : 400}>
                    {item.label}
                  </Text>
                  {count !== undefined && count > 0 && (
                    <Badge size="sm" variant="filled" color="violet" circle>
                      {count > 99 ? '99+' : count}
                    </Badge>
                  )}
                </Group>
              }
              leftSection={
                <Text size="md" style={{ lineHeight: 1 }}>
                  {item.emoji}
                </Text>
              }
              active={active}
              variant="light"
              color="violet"
              style={{ borderRadius: 6, marginBottom: 2 }}
            />
          );
        })}
      </Box>
    </Paper>
  );
}
