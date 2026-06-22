'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Paper, NavLink, Group, Text, Divider, Box } from '@mantine/core';

const NAV_ITEMS = [
  { href: '/bot', label: 'Dashboard', emoji: '📊' },
  { href: '/bot/conversations', label: 'Conversations', emoji: '💬' },
  { href: '/bot/config', label: 'Config', emoji: '⚙️' },
  { href: '/bot/options', label: 'Options', emoji: '🔧' },
  { href: '/bot/skills', label: 'Skills', emoji: '⚡' },
  { href: '/bot/analytics', label: 'Analytics', emoji: '📈' },
  { href: '/bot/widget', label: 'Widget', emoji: '🧩' },
] as const;

interface TenantBotNavPanelProps {
  tenantId: string;
}

export default function TenantBotNavPanel({ tenantId }: TenantBotNavPanelProps) {
  const pathname = usePathname();

  function isActive(href: string) {
    const fullPath = `/t/${tenantId}${href}`;
    if (href === '/bot') return pathname === fullPath;
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
        <div className="w-6 h-6 rounded bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.72v.78h3c1.1 0 2 .9 2 2v8c0 1.1-.9 2-2 2H7c-1.1 0-2-.9-2-2v-8c0-1.1.9-2 2-2h3v-.78c-.6-.34-1-.98-1-1.72a2 2 0 0 1 2-2z"/>
            <path d="M9 18v1a3 3 0 0 0 6 0v-1"/>
          </svg>
        </div>
        <Text size="sm" fw={700} c="var(--mantine-color-indigo-filled)">
          Bot Hub
        </Text>
      </Group>

      <Divider my={4} />

      {/* Navigation links */}
      <Box>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);

          return (
            <NavLink
              key={item.href}
              component={Link}
              href={`/t/${tenantId}${item.href}`}
              label={
                <Text size="sm" fw={active ? 600 : 400}>
                  {item.label}
                </Text>
              }
              leftSection={
                <Text size="md" style={{ lineHeight: 1 }}>
                  {item.emoji}
                </Text>
              }
              active={active}
              variant="light"
              color="indigo"
              style={{ borderRadius: 6, marginBottom: 2 }}
            />
          );
        })}
      </Box>
    </Paper>
  );
}
