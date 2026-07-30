'use client';

import { ReactNode } from 'react';
import { Group, Title, Text, Breadcrumbs, Anchor, Stack } from '@mantine/core';
import Link from 'next/link';
import MarketingOpsNavPanel from './MarketingOpsNavPanel';

interface MarketingOpsPageShellProps {
  title: string;
  subtitle?: ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  navCounts?: {
    campaigns?: number;
    prompts?: number;
    deliverableTemplates?: number;
  };
  children: ReactNode;
  actions?: ReactNode;
}

export default function MarketingOpsPageShell({
  title,
  subtitle,
  breadcrumbs,
  navCounts,
  children,
  actions,
}: MarketingOpsPageShellProps) {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <aside className="w-full lg:w-56 flex-shrink-0">
        <MarketingOpsNavPanel counts={navCounts} />
      </aside>

      <main className="flex-1 min-w-0 space-y-5">
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
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--mantine-color-violet-filled)')}
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

        {children}
      </main>
    </div>
  );
}
