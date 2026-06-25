'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Group, Title, Text, Badge, Stack, ThemeIcon, Paper, ActionIcon, Divider, Loader, NavLink, Spoiler } from '@mantine/core';
import { IconTicket, IconInbox, IconPlus, IconChevronRight } from '@tabler/icons-react';
import Link from 'next/link';
import { crmCustomerService } from '@/services/crm/CrmCustomerService';
import { toast } from '@/hooks/use-toast';
import type { CrmTicket, CrmInquiry, CrmAlert } from '@/types/crm';

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

const ALERT_CONFIG: Record<string, { icon: string; color: string; bg: string; border: string }> = {
  milestone: { icon: '🏆', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  subscription: { icon: '🔔', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  welcome: { icon: '👋', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  info: { icon: 'ℹ️', color: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200' },
  warning: { icon: '⚠️', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  congratulations: { icon: '🎉', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  order: { icon: '🛒', color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' },
};

export default function CrmCustomerWidget() {
  const [tickets, setTickets] = useState<CrmTicket[]>([]);
  const [inquiries, setInquiries] = useState<CrmInquiry[]>([]);
  const [alerts, setAlerts] = useState<CrmAlert[]>([]);
  const [unreadAlertCount, setUnreadAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [readStates, setReadStates] = useState<Record<string, string>>({});
  const isFirstLoadRef = useRef(true);
  const prevAlertIdsRef = useRef<Set<string>>(new Set());
  const prevUnreadRef = useRef<number>(0);

  const loadData = useCallback(async () => {
    try {
      const [t, i, a, rs] = await Promise.allSettled([
        crmCustomerService.listTickets({ status: 'open' }),
        crmCustomerService.listInquiries({ status: 'open' }),
        crmCustomerService.listAlerts(),
        crmCustomerService.getReadState(),
      ]);
      if (t.status === 'fulfilled') setTickets(t.value.slice(0, 3));
      if (i.status === 'fulfilled') setInquiries(i.value.slice(0, 3));
      if (rs.status === 'fulfilled') {
        const map: Record<string, string> = {};
        for (const s of rs.value) map[s.scope] = s.last_read_at;
        setReadStates(map);
      }

      let newAlerts: CrmAlert[] = [];
      let newUnreadAlertCount = 0;
      if (a.status === 'fulfilled') {
        newAlerts = a.value.slice(0, 3);
        newUnreadAlertCount = a.value.filter((x: CrmAlert) => !x.is_read && !x.is_dismissed).length;
      }

      // Detect new alerts for toast (skip on first load)
      if (!isFirstLoadRef.current) {
        const prevAlertIds = prevAlertIdsRef.current;
        const prevUnread = prevUnreadRef.current;
        const newAlertItems = newAlerts.filter(x => !prevAlertIds.has(x.id));
        if (newAlertItems.length > 0 && newUnreadAlertCount > prevUnread) {
          toast({
            title: newAlertItems[0].title,
            description: newAlertItems[0].body || 'New alert',
            variant: 'info',
          });
        }
      }

      // Update refs for next diff
      prevAlertIdsRef.current = new Set(newAlerts.map(x => x.id));
      prevUnreadRef.current = newUnreadAlertCount;

      setAlerts(newAlerts);
      setUnreadAlertCount(newUnreadAlertCount);
      isFirstLoadRef.current = false;
    } catch (err) {
      console.error('[CRM Customer Widget] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
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

  const lastReadTickets = readStates['ticket_feed'];
  const lastReadInquiries = readStates['inquiry_feed'];
  const unreadTicketCount = tickets.filter(
    (t) => !lastReadTickets || new Date(t.created_at).getTime() > new Date(lastReadTickets).getTime()
  ).length;
  const unreadInquiryCount = inquiries.filter(
    (i) => !lastReadInquiries || new Date(i.created_at).getTime() > new Date(lastReadInquiries).getTime()
  ).length;

  const totalOpen = unreadTicketCount + unreadInquiryCount + unreadAlertCount;

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
              {totalOpen === 0 ? 'All caught up' : `${totalOpen} item${totalOpen > 1 ? 's' : ''} needing attention`}
            </Text>
          </div>
        </Group>
        <Badge size="sm" color={totalOpen > 0 ? 'amber' : 'green'} variant="light">
          {totalOpen}
        </Badge>
      </Group>

      <Divider my="sm" />

      {/* Alerts */}
      {alerts.length > 0 && (
        <Stack gap="xs" mb="sm">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
              Alerts
            </Text>
            {unreadAlertCount > 0 && (
              <button
                onClick={async () => { await crmCustomerService.markAllAlertsRead(); loadData(); }}
                className="text-xs text-purple-600 hover:text-purple-800 font-medium"
              >
                Mark all read
              </button>
            )}
          </Group>
          {alerts.map(alert => {
            const config = ALERT_CONFIG[alert.type] || ALERT_CONFIG.info;
            return (
              <div
                key={alert.id}
                className={`flex items-start gap-2 p-2 rounded-lg border ${config.bg} ${config.border}`}
              >
                <span className="text-sm flex-shrink-0">{alert.icon || config.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${config.color}`}>{alert.title}</p>
                  {alert.body && (
                    <p className="text-[10px] text-neutral-500 line-clamp-2">{alert.body}</p>
                  )}
                  <p className="text-[10px] text-neutral-400 mt-0.5">
                    {new Date(alert.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-1 shrink-0">
                  {!alert.is_read && (
                    <button
                      onClick={async () => { await crmCustomerService.markAlertRead(alert.id); loadData(); }}
                      className="text-[10px] text-purple-600 hover:text-purple-800 font-medium"
                    >
                      Read
                    </button>
                  )}
                  <button
                    onClick={async () => { await crmCustomerService.dismissAlert(alert.id); loadData(); }}
                    className="text-[10px] text-neutral-400 hover:text-neutral-600"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            );
          })}
        </Stack>
      )}

      {/* Open Tickets */}
      {tickets.length > 0 && (
        <Stack gap="xs" mb="sm">
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
              Open Tickets
            </Text>
            {unreadTicketCount > 0 && (
              <button
                onClick={async () => { await crmCustomerService.setReadState('ticket_feed'); loadData(); }}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Mark read
              </button>
            )}
          </Group>
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
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={600} tt="uppercase">
              Open Inquiries
            </Text>
            {unreadInquiryCount > 0 && (
              <button
                onClick={async () => { await crmCustomerService.setReadState('inquiry_feed'); loadData(); }}
                className="text-xs text-purple-600 hover:text-purple-800 font-medium"
              >
                Mark read
              </button>
            )}
          </Group>
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
      {tickets.length === 0 && inquiries.length === 0 && alerts.length === 0 && (
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
