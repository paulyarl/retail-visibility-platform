"use client";

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Card, Title, Text, Badge, Stack, Group, SimpleGrid, Loader, Tabs,
  Button, Textarea, Select, Modal, ScrollArea, Divider,
} from '@mantine/core';
import { useAuth } from '@/contexts/AuthContext';
import { personalCrmService } from '@/services/crm/PersonalCrmService';
import type {
  PersonalCrmDashboard, PersonalCrmTicket, PersonalCrmTask,
  PersonalCrmAlert, PersonalCrmActivity,
} from '@/services/crm/PersonalCrmService';
import type { CrmTicketMessage } from '@/types/crm';
import { clientLogger } from '@/lib/client-logger';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  open: 'blue',
  in_progress: 'violet',
  waiting: 'orange',
  resolved: 'green',
  closed: 'gray',
  pending: 'blue',
  completed: 'green',
  cancelled: 'gray',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'gray',
  medium: 'blue',
  high: 'orange',
  urgent: 'red',
};

export default function PersonalCrmPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const [dashboard, setDashboard] = useState<PersonalCrmDashboard | null>(null);
  const [tickets, setTickets] = useState<PersonalCrmTicket[]>([]);
  const [tasks, setTasks] = useState<PersonalCrmTask[]>([]);
  const [alerts, setAlerts] = useState<PersonalCrmAlert[]>([]);
  const [activities, setActivities] = useState<PersonalCrmActivity[]>([]);

  // New platform ticket modal
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTicket, setNewTicket] = useState({ title: '', description: '', category: 'general', priority: 'medium' });
  const [creatingTicket, setCreatingTicket] = useState(false);

  // Ticket detail modal
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketMessages, setTicketMessages] = useState<CrmTicketMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const data = await personalCrmService.getDashboard();
      setDashboard(data);
    } catch (e) { clientLogger.error('Failed to load dashboard:', { detail: e }); }
  }, []);

  const loadTickets = useCallback(async () => {
    try {
      const data = await personalCrmService.listTickets();
      setTickets(data);
    } catch (e) { clientLogger.error('Failed to load tickets:', { detail: e }); }
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      const data = await personalCrmService.listTasks();
      setTasks(data);
    } catch (e) { clientLogger.error('Failed to load tasks:', { detail: e }); }
  }, []);

  const loadAlerts = useCallback(async () => {
    try {
      const data = await personalCrmService.listAlerts();
      setAlerts(data);
    } catch (e) { clientLogger.error('Failed to load alerts:', { detail: e }); }
  }, []);

  const loadActivities = useCallback(async () => {
    try {
      const data = await personalCrmService.listActivities();
      setActivities(data);
    } catch (e) { clientLogger.error('Failed to load activities:', { detail: e }); }
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
      return;
    }
    if (isAuthenticated) {
      Promise.all([loadDashboard(), loadTickets(), loadTasks(), loadAlerts(), loadActivities()])
        .finally(() => setLoading(false));
    }
  }, [authLoading, isAuthenticated, loadDashboard, loadTickets, loadTasks, loadAlerts, loadActivities]);

  const handleCreateTicket = async () => {
    if (!newTicket.title.trim()) return;
    setCreatingTicket(true);
    try {
      await personalCrmService.createPlatformTicket(newTicket);
      setShowNewTicket(false);
      setNewTicket({ title: '', description: '', category: 'general', priority: 'medium' });
      await Promise.all([loadDashboard(), loadTickets()]);
    } catch (e) {
      clientLogger.error('Failed to create ticket:', { detail: e });
    } finally {
      setCreatingTicket(false);
    }
  };

  const handleOpenTicket = async (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setLoadingMessages(true);
    try {
      const msgs = await personalCrmService.listTicketMessages(ticketId);
      setTicketMessages(msgs);
    } catch (e) {
      clientLogger.error('Failed to load messages:', { detail: e });
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedTicketId || !replyText.trim()) return;
    setSendingReply(true);
    try {
      await personalCrmService.createTicketMessage(selectedTicketId, { content: replyText });
      setReplyText('');
      const msgs = await personalCrmService.listTicketMessages(selectedTicketId);
      setTicketMessages(msgs);
    } catch (e) {
      clientLogger.error('Failed to send reply:', { detail: e });
    } finally {
      setSendingReply(false);
    }
  };

  const handleMarkAlertRead = async (alertId: string) => {
    try {
      await personalCrmService.markAlertRead(alertId);
      await Promise.all([loadAlerts(), loadDashboard()]);
    } catch (e) { clientLogger.error('Failed to mark alert read:', { detail: e }); }
  };

  const handleDismissAlert = async (alertId: string) => {
    try {
      await personalCrmService.dismissAlert(alertId);
      await Promise.all([loadAlerts(), loadDashboard()]);
    } catch (e) { clientLogger.error('Failed to dismiss alert:', { detail: e }); }
  };

  const handleMarkAllAlertsRead = async () => {
    try {
      await personalCrmService.markAllAlertsRead();
      await Promise.all([loadAlerts(), loadDashboard()]);
    } catch (e) { clientLogger.error('Failed to mark all alerts read:', { detail: e }); }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <nav className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mb-4">
            <Link href="/" className="hover:text-neutral-700 dark:hover:text-neutral-200">Dashboard</Link>
            <span>/</span>
            <Link href="/settings/profile" className="hover:text-neutral-700 dark:hover:text-neutral-200">Profile</Link>
            <span>/</span>
            <span className="text-neutral-900 dark:text-neutral-100">CRM Hub</span>
          </nav>
          <Group justify="space-between">
            <div>
              <Title order={1}>My CRM Hub</Title>
              <Text c="dimmed" mt="xs">Your tickets, tasks, alerts, and activities across all locations</Text>
            </div>
            <Button leftSection={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>} onClick={() => setShowNewTicket(true)}>
              New Support Ticket
            </Button>
          </Group>
        </div>

        {/* Stat Cards */}
        {dashboard && (
          <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md" className="mb-6">
            <StatCard label="Assigned Tickets" value={dashboard.assigned_ticket_count} color="blue" icon="🎫" />
            <StatCard label="Pending Tasks" value={dashboard.pending_task_count} color="violet" icon="📋" />
            <StatCard label="Unread Alerts" value={dashboard.unread_alert_count} color="orange" icon="🔔" />
            <StatCard label="Platform Tickets" value={dashboard.platform_ticket_count} color="teal" icon="🏢" />
          </SimpleGrid>
        )}

        {/* Tabs */}
        <Card withBorder radius="lg" p="lg">
          <Tabs value={activeTab} onChange={(v) => setActiveTab(v || 'overview')}>
            <Tabs.List className="mb-4">
              <Tabs.Tab value="overview" leftSection={<span>📊</span>}>Overview</Tabs.Tab>
              <Tabs.Tab value="tickets" leftSection={<span>🎫</span>}>Tickets ({tickets.length})</Tabs.Tab>
              <Tabs.Tab value="tasks" leftSection={<span>📋</span>}>Tasks ({tasks.length})</Tabs.Tab>
              <Tabs.Tab value="alerts" leftSection={<span>🔔</span>}>Alerts ({alerts.length})</Tabs.Tab>
            </Tabs.List>

            {/* Overview Tab */}
            <Tabs.Panel value="overview">
              <Stack gap="md">
                {/* Recent Activities */}
                <div>
                  <Group justify="space-between" mb="sm">
                    <Title order={4}>Recent Activity</Title>
                    <Button variant="subtle" size="xs" onClick={() => setActiveTab('tickets')}>View all →</Button>
                  </Group>
                  {activities.length === 0 ? (
                    <Text c="dimmed" size="sm" py="md">No recent activities</Text>
                  ) : (
                    <Stack gap="xs">
                      {activities.slice(0, 5).map((a) => (
                        <div key={a.id} className="flex items-start gap-3 p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                          <div className="flex-1">
                            <Text size="sm" fw={500}>{a.content || a.activity_type}</Text>
                            <Group gap="xs" mt={4}>
                              <Badge size="xs" variant="light">{a.activity_type.replace(/_/g, ' ')}</Badge>
                              {a.tenant_name && <Badge size="xs" variant="light" color="gray">{a.tenant_name}</Badge>}
                              <Text size="xs" c="dimmed">{new Date(a.created_at).toLocaleString()}</Text>
                            </Group>
                          </div>
                        </div>
                      ))}
                    </Stack>
                  )}
                </div>

                <Divider />

                {/* Your Tenants */}
                {dashboard && dashboard.tenants.length > 0 && (
                  <div>
                    <Title order={4} mb="sm">Your Locations</Title>
                    <Group gap="xs">
                      {dashboard.tenants.map((t) => (
                        <Link key={t.id} href={`/t/${t.id}/support`}>
                          <Badge variant="light" color="blue" size="lg" className="cursor-pointer hover:bg-blue-100">
                            {t.name}
                          </Badge>
                        </Link>
                      ))}
                    </Group>
                  </div>
                )}
              </Stack>
            </Tabs.Panel>

            {/* Tickets Tab */}
            <Tabs.Panel value="tickets">
              {tickets.length === 0 ? (
                <Text c="dimmed" size="sm" py="md">No tickets assigned to you</Text>
              ) : (
                <Stack gap="xs">
                  {tickets.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700/50 transition-colors"
                      onClick={() => handleOpenTicket(t.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <Group gap="sm" mb={4}>
                          <Text fw={500} size="sm" truncate>{t.title}</Text>
                          {t.is_platform_ticket && <Badge size="xs" color="teal" variant="light">Platform</Badge>}
                        </Group>
                        <Group gap="xs">
                          <Badge size="xs" variant="light" color={STATUS_COLORS[t.status] || 'gray'}>
                            {t.status.replace(/_/g, ' ')}
                          </Badge>
                          <Badge size="xs" variant="light" color={PRIORITY_COLORS[t.priority] || 'gray'}>
                            {t.priority}
                          </Badge>
                          {t.tenant_name && !t.is_platform_ticket && (
                            <Text size="xs" c="dimmed">{t.tenant_name}</Text>
                          )}
                          <Text size="xs" c="dimmed">{new Date(t.created_at).toLocaleDateString()}</Text>
                        </Group>
                      </div>
                      <svg className="w-5 h-5 text-neutral-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  ))}
                </Stack>
              )}
            </Tabs.Panel>

            {/* Tasks Tab */}
            <Tabs.Panel value="tasks">
              {tasks.length === 0 ? (
                <Text c="dimmed" size="sm" py="md">No tasks assigned to you</Text>
              ) : (
                <Stack gap="xs">
                  {tasks.map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <Text fw={500} size="sm" truncate>{t.title}</Text>
                        <Group gap="xs" mt={4}>
                          <Badge size="xs" variant="light" color={STATUS_COLORS[t.status] || 'gray'}>
                            {t.status.replace(/_/g, ' ')}
                          </Badge>
                          <Badge size="xs" variant="light" color={PRIORITY_COLORS[t.priority] || 'gray'}>
                            {t.priority}
                          </Badge>
                          {t.tenant_name && <Text size="xs" c="dimmed">{t.tenant_name}</Text>}
                          {t.due_date && <Text size="xs" c="dimmed">Due: {new Date(t.due_date).toLocaleDateString()}</Text>}
                        </Group>
                      </div>
                    </div>
                  ))}
                </Stack>
              )}
            </Tabs.Panel>

            {/* Alerts Tab */}
            <Tabs.Panel value="alerts">
              <Group justify="flex-end" mb="sm">
                <Button variant="subtle" size="xs" onClick={handleMarkAllAlertsRead}>Mark all read</Button>
              </Group>
              {alerts.length === 0 ? (
                <Text c="dimmed" size="sm" py="md">No alerts</Text>
              ) : (
                <Stack gap="xs">
                  {alerts.map((a) => (
                    <div key={a.id} className={`flex items-start gap-3 p-4 rounded-lg ${a.is_read ? 'bg-neutral-50 dark:bg-neutral-800/30' : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'}`}>
                      <div className="text-2xl">{a.icon || '📋'}</div>
                      <div className="flex-1">
                        <Text fw={500} size="sm">{a.title}</Text>
                        {a.body && <Text size="xs" c="dimmed" mt={4}>{a.body}</Text>}
                        <Group gap="xs" mt={4}>
                          {a.tenant_name && <Badge size="xs" variant="light" color="gray">{a.tenant_name}</Badge>}
                          <Badge size="xs" variant="light">{a.type}</Badge>
                          <Text size="xs" c="dimmed">{new Date(a.created_at).toLocaleString()}</Text>
                        </Group>
                      </div>
                      <Group gap="xs">
                        {!a.is_read && (
                          <Button variant="subtle" size="xs" onClick={() => handleMarkAlertRead(a.id)}>Read</Button>
                        )}
                        <Button variant="subtle" size="xs" color="gray" onClick={() => handleDismissAlert(a.id)}>Dismiss</Button>
                      </Group>
                    </div>
                  ))}
                </Stack>
              )}
            </Tabs.Panel>
          </Tabs>
        </Card>

        {/* New Ticket Modal */}
        <Modal opened={showNewTicket} onClose={() => setShowNewTicket(false)} title="New Platform Support Ticket" size="md">
          <Stack gap="md">
            <div>
              <Text size="sm" fw={500} mb={4}>Subject</Text>
              <input
                type="text"
                value={newTicket.title}
                onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
                placeholder="Brief description of your issue"
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm"
              />
            </div>
            <div>
              <Text size="sm" fw={500} mb={4}>Category</Text>
              <Select
                value={newTicket.category}
                onChange={(v) => setNewTicket({ ...newTicket, category: v || 'general' })}
                data={[
                  { value: 'general', label: 'General' },
                  { value: 'billing', label: 'Billing' },
                  { value: 'technical', label: 'Technical' },
                  { value: 'feature_request', label: 'Feature Request' },
                  { value: 'bug', label: 'Bug Report' },
                ]}
              />
            </div>
            <div>
              <Text size="sm" fw={500} mb={4}>Priority</Text>
              <Select
                value={newTicket.priority}
                onChange={(v) => setNewTicket({ ...newTicket, priority: v || 'medium' })}
                data={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                  { value: 'urgent', label: 'Urgent' },
                ]}
              />
            </div>
            <div>
              <Text size="sm" fw={500} mb={4}>Description</Text>
              <Textarea
                value={newTicket.description}
                onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                placeholder="Describe your issue in detail..."
                minRows={4}
              />
            </div>
            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setShowNewTicket(false)}>Cancel</Button>
              <Button onClick={handleCreateTicket} loading={creatingTicket} disabled={!newTicket.title.trim()}>
                Create Ticket
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Ticket Detail Modal */}
        <Modal
          opened={!!selectedTicketId}
          onClose={() => { setSelectedTicketId(null); setTicketMessages([]); setReplyText(''); }}
          title="Ticket Conversation"
          size="lg"
        >
          {loadingMessages ? (
            <div className="flex justify-center py-8"><Loader /></div>
          ) : (
            <Stack gap="md">
              <ScrollArea.Autosize mah={400}>
                <Stack gap="sm">
                  {ticketMessages.length === 0 ? (
                    <Text c="dimmed" size="sm" py="md">No messages yet</Text>
                  ) : (
                    ticketMessages.map((msg) => (
                      <div key={msg.id} className={`p-3 rounded-lg ${msg.is_internal ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-neutral-50 dark:bg-neutral-800/50'}`}>
                        <Group justify="space-between" mb={4}>
                          <Text size="xs" fw={500}>{msg.author_name}</Text>
                          <Group gap="xs">
                            {msg.is_internal && <Badge size="xs" color="amber" variant="light">Internal</Badge>}
                            <Badge size="xs" variant="light">{msg.author_type}</Badge>
                            <Text size="xs" c="dimmed">{new Date(msg.created_at).toLocaleString()}</Text>
                          </Group>
                        </Group>
                        <Text size="sm">{msg.content}</Text>
                      </div>
                    ))
                  )}
                </Stack>
              </ScrollArea.Autosize>
              <Divider />
              <div>
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your reply..."
                  minRows={3}
                />
                <Group justify="flex-end" mt="sm">
                  <Button onClick={handleSendReply} loading={sendingReply} disabled={!replyText.trim()}>
                    Send Reply
                  </Button>
                </Group>
              </div>
            </Stack>
          )}
        </Modal>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <Card withBorder p="md" radius="lg">
      <Group justify="space-between" mb="xs">
        <Text size="xs" c="dimmed" tt="uppercase">{label}</Text>
        <span className="text-xl">{icon}</span>
      </Group>
      <Text size="xl" fw={700} c={color}>{value}</Text>
    </Card>
  );
}
