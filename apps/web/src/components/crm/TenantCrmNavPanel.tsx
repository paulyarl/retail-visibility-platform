'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Paper, NavLink, Group, Text, Divider, Badge, Box } from '@mantine/core';

const NAV_ITEMS = [
  { href: '/support', label: 'Dashboard', emoji: '📊' },
  { href: '/support/alerts', label: 'Alerts', emoji: '🔔' },
  { href: '/support/tickets', label: 'Tickets', emoji: '🎫' },
  { href: '/support/tasks', label: 'Tasks', emoji: '✅' },
  { href: '/support/contacts', label: 'Contacts', emoji: '👥' },
  { href: '/support/inquiries', label: 'Inquiries', emoji: '❓' },
] as const;

interface TenantCrmNavPanelProps {
  tenantId: string;
  counts?: {
    tickets?: number;
    tasks?: number;
    inquiries?: number;
    alerts?: number;
  };
}

export default function TenantCrmNavPanel({ tenantId, counts }: TenantCrmNavPanelProps) {
  const pathname = usePathname();

  function isActive(href: string) {
    const fullPath = `/t/${tenantId}${href}`;
    if (href === '/support') return pathname === fullPath;
    return pathname.startsWith(fullPath);
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
        <div className="w-6 h-6 rounded bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <Text size="sm" fw={700} c="var(--mantine-color-amber-filled)">
          Support Hub
        </Text>
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
              href={`/t/${tenantId}${item.href}`}
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
