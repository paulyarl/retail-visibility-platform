'use client';

import { ReactNode } from 'react';
import { Group, Title, Text, Breadcrumbs, Anchor, Stack } from '@mantine/core';
import Link from 'next/link';
import CrmNavPanel from './CrmNavPanel';

interface CrmPageShellProps {
  title: string;
  subtitle?: ReactNode;
  /** Breadcrumb segments, e.g. [{ label: 'CRM', href: '/settings/admin/crm' }, { label: 'Tickets' }] */
  breadcrumbs?: { label: string; href?: string }[];
  /** Optional badge counts passed to nav panel */
  navCounts?: {
    tickets?: number;
    tasks?: number;
    requests?: number;
  };
  children: ReactNode;
  /** Right-side action area (buttons, filters, etc.) */
  actions?: ReactNode;
}

export default function CrmPageShell({
  title,
  subtitle,
  breadcrumbs,
  navCounts,
  children,
  actions,
}: CrmPageShellProps) {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Sidebar nav */}
      <aside className="w-full lg:w-56 flex-shrink-0">
        <CrmNavPanel counts={navCounts} />
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
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--mantine-color-amber-filled)')}
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
