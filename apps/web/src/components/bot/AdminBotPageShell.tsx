'use client';

import { ReactNode } from 'react';
import { Group, Title, Text, Breadcrumbs, Anchor, Stack } from '@mantine/core';
import Link from 'next/link';
import AdminBotNavPanel from './AdminBotNavPanel';

interface AdminBotPageShellProps {
  title: string;
  subtitle?: ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  children: ReactNode;
  actions?: ReactNode;
}

export default function AdminBotPageShell({
  title,
  subtitle,
  breadcrumbs,
  children,
  actions,
}: AdminBotPageShellProps) {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Sidebar nav */}
      <aside className="w-full lg:w-56 flex-shrink-0">
        <AdminBotNavPanel />
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 space-y-5">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumbs separator="/" fz="xs" c="dimmed">
            {breadcrumbs.map((crumb, i) =>
              crumb.href ? (
                <Anchor
                  key={i}
                  component={Link}
                  href={crumb.href}
                  c="dimmed"
                  underline="never"
                  style={{ transition: 'color 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--mantine-color-indigo-filled)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '')}
                >
                  {crumb.label}
                </Anchor>
              ) : (
                <Text key={i} size="xs" c="dimmed" fw={500}>
                  {crumb.label}
                </Text>
              )
            )}
          </Breadcrumbs>
        )}

        {/* Page header */}
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Stack gap={2}>
            <Title order={2} fz="h3" fw={700}>
              {title}
            </Title>
            {subtitle && (
              <Text size="sm" c="dimmed">
                {subtitle}
              </Text>
            )}
          </Stack>
          {actions && <div>{actions}</div>}
        </Group>

        {/* Page content */}
        {children}
      </main>
    </div>
  );
}
