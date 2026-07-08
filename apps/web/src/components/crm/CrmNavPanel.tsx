'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Paper, NavLink, Group, Title, Text, Divider, Badge, Box } from '@mantine/core';
import {
  IconLayoutDashboard,
  IconUsers,
  IconTicket,
  IconChecklist,
  IconInbox,
  IconBroadcast,
} from '@tabler/icons-react';

const NAV_ITEMS = [
  { href: '/settings/admin/crm', label: 'Dashboard', icon: IconLayoutDashboard, emoji: '📊' },
  { href: '/settings/admin/crm/tenants', label: 'Tenants', icon: IconUsers, emoji: '🏢' },
  { href: '/settings/admin/crm/tickets', label: 'Tickets', icon: IconTicket, emoji: '🎫' },
  { href: '/settings/admin/crm/tasks', label: 'Tasks', icon: IconChecklist, emoji: '✅' },
  { href: '/settings/admin/crm/requests', label: 'Requests', icon: IconInbox, emoji: '📥' },
  { href: '/settings/admin/crm/broadcast', label: 'Broadcast', icon: IconBroadcast, emoji: '📢' },
] as const;

interface CrmNavPanelProps {
  /** Optional badge counts to display next to nav items */
  counts?: {
    tickets?: number;
    tasks?: number;
    requests?: number;
  };
}

export default function CrmNavPanel({ counts }: CrmNavPanelProps) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/settings/admin/crm') return pathname === '/settings/admin/crm';
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
      {/* Branding header */}
      <Group px="sm" py="xs" gap="xs">
        <Text size="lg" fw={700} c="var(--mantine-color-amber-filled)">
          CRM
        </Text>
        <Badge size="xs" variant="light" color="amber">
          Admin
        </Badge>
      </Group>

      <Divider my={4} />

      {/* Navigation links */}
      <Box>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const countKey = item.label.toLowerCase() as keyof NonNullable<typeof counts>;
          const count = counts?.[countKey];

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
                    <Badge size="sm" variant="filled" color="amber" circle>
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
              color="amber"
              style={{ borderRadius: 6, marginBottom: 2 }}
            />
          );
        })}
      </Box>
    </Paper>
  );
}
