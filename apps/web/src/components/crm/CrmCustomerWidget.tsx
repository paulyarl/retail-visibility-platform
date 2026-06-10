'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, Group, Title, Text, Badge, Stack, ThemeIcon, Paper, ActionIcon, Divider, Loader, NavLink, Spoiler } from '@mantine/core';
import { IconTicket, IconInbox, IconPlus, IconChevronRight } from '@tabler/icons-react';
import Link from 'next/link';
import { crmCustomerService } from '@/services/crm/CrmCustomerService';
import type { CrmTicket, CrmInquiry } from '@/types/crm';

const STATUS_COLORS: Record<string, string> = {
  open: 'blue',
  in_progress: 'amber',
  waiting: 'yellow',
  resolved: 'green',
  closed: 'gray',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'red',
  high: 'orange',
  medium: 'amber',
  low: 'gray',
};

export default function CrmCustomerWidget() {
  const [tickets, setTickets] = useState<CrmTicket[]>([]);
  const [inquiries, setInquiries] = useState<CrmInquiry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [t, i] = await Promise.allSettled([
        crmCustomerService.listTickets({ status: 'open' }),
        crmCustomerService.listInquiries({ status: 'open' }),
      ]);
      if (t.status === 'fulfilled') setTickets(t.value.slice(0, 3));
      if (i.status === 'fulfilled') setInquiries(i.value.slice(0, 3));
    } catch (err) {
      console.error('[CRM Customer Widget] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="center" py="md">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">Loading support...</Text>
        </Group>
      </Card>
    );
  }

  const totalOpen = tickets.length + inquiries.length;

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      {/* Header */}
      <Group justify="space-between" mb="sm">
        <Group>
          <ThemeIcon size="lg" radius="md" variant="light" color="amber">
            <IconInbox style={{ width: 20, height: 20 }} />
          </ThemeIcon>
          <div>
            <Title order={4}>Support</Title>
            <Text size="xs" c="dimmed">
              {totalOpen === 0 ? 'All caught up' : `${totalOpen} open item${totalOpen > 1 ? 's' : ''}`}
            </Text>
          </div>
        </Group>
        <Badge size="sm" color={totalOpen > 0 ? 'amber' : 'green'} variant="light">
          {totalOpen}
        </Badge>
      </Group>

      <Divider my="sm" />

      {/* Open Tickets */}
      {tickets.length > 0 && (
        <Stack gap="xs" mb="sm">
          <Text size="xs" c="dimmed" fw={600} tt="uppercase">
            Open Tickets
          </Text>
          {tickets.map((t) => (
            <NavLink
              key={t.id}
              component={Link}
              href={`/account/support/${t.id}`}
              label={
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm" truncate>{t.title}</Text>
                  <Group gap="xs" wrap="nowrap">
                    {t.priority && (
                      <Badge size="xs" color={PRIORITY_COLORS[t.priority] || 'gray'} variant="light">
                        {t.priority}
                      </Badge>
                    )}
                    <Badge size="xs" color={STATUS_COLORS[t.status] || 'gray'} variant="light">
                      {t.status?.replace('_', ' ')}
                    </Badge>
                  </Group>
                </Group>
              }
              rightSection={<IconChevronRight size={14} stroke={1.5} />}
              p="xs"

              style={{ border: '1px solid var(--mantine-color-gray-2)' }}
            />
          ))}
        </Stack>
      )}

      {/* Open Inquiries */}
      {inquiries.length > 0 && (
        <Stack gap="xs" mb="sm">
          <Text size="xs" c="dimmed" fw={600} tt="uppercase">
            Open Inquiries
          </Text>
          {inquiries.map((i) => (
            <NavLink
              key={i.id}
              component={Link}
              href={`/account/support/inquiries/${i.id}`}
              label={
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm" truncate>{i.subject}</Text>
                  <Badge size="xs" color={STATUS_COLORS[i.status] || 'gray'} variant="light">
                    {i.status?.replace('_', ' ')}
                  </Badge>
                </Group>
              }
              rightSection={<IconChevronRight size={14} stroke={1.5} />}
              p="xs"

              style={{ border: '1px solid var(--mantine-color-gray-2)' }}
            />
          ))}
        </Stack>
      )}

      {/* Empty state */}
      {tickets.length === 0 && inquiries.length === 0 && (
        <Paper p="md" radius="md" bg="green.0">
          <Group>
            <Text size="sm" c="green.8" fw={500}>
              No open support items
            </Text>
          </Group>
        </Paper>
      )}

      <Divider my="sm" />

      {/* Quick actions */}
      <Group justify="space-between">
        <NavLink
          component={Link}
          href="/account/support"
          label="View all"
          leftSection={<IconInbox size={16} stroke={1.5} />}
          rightSection={<IconChevronRight size={14} stroke={1.5} />}
          p="xs"
          color="amber"
          variant="light"
        />
        <NavLink
          component={Link}
          href="/account/support/new"
          label="New ticket"
          leftSection={<IconPlus size={16} stroke={1.5} />}
          p="xs"
          color="amber"
          variant="light"
        />
      </Group>
    </Card>
  );
}
