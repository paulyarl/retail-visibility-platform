'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Card, Title, Text, Badge, Group, Select as MantineSelect, Loader, Button,
  Textarea, Stack, Modal,
} from '@mantine/core';
import { useAuth } from '@/contexts/AuthContext';
import { personalCrmService } from '@/services/crm/PersonalCrmService';
import { RichContentEditor } from '@/components/products/RichContentEditor';
import { RichContentRenderer } from '@/components/products/RichContentRenderer';
import { DEFAULT_CONTENT_BLOCKS, type ContentBlocks } from '@/components/products/content-blocks';
import type { CrmTicket, CrmTicketMessage, TicketStatus, TicketPriority } from '@/types/crm';
import { clientLogger } from '@/lib/client-logger';

export const dynamic = 'force-dynamic';

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const STATUS_COLORS: Record<string, string> = {
  open: 'blue',
  in_progress: 'violet',
  waiting: 'orange',
  resolved: 'green',
  closed: 'gray',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'gray',
  medium: 'blue',
  high: 'orange',
  urgent: 'red',
};

export default function PersonalCrmTicketDetailPage() {
  const params = useParams();
  const ticketId = params.ticketId as string;
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [ticket, setTicket] = useState<CrmTicket | null>(null);
  const [messages, setMessages] = useState<CrmTicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState<ContentBlocks>(DEFAULT_CONTENT_BLOCKS);
  const [replyKey, setReplyKey] = useState(0);
  const [noteContent, setNoteContent] = useState('');
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const isClosed = ticket?.status === 'closed';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ticketRes, messagesRes] = await Promise.allSettled([
        personalCrmService.getTicket(ticketId),
        personalCrmService.listTicketMessages(ticketId),
      ]);
      if (ticketRes.status === 'fulfilled') setTicket(ticketRes.value);
      if (messagesRes.status === 'fulfilled') setMessages(messagesRes.value);
    } catch (err) {
      clientLogger.error('[Personal CRM Ticket Detail] Load error:', { detail: err });
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      if (typeof window !== 'undefined') window.location.href = '/auth/login';
      return;
    }
    if (isAuthenticated) load();
  }, [authLoading, isAuthenticated, load]);

  async function handleUpdateTicket(data: Partial<{ status: TicketStatus; priority: TicketPriority; category: string }>) {
    if (!ticket) return;
    if (data.status === 'closed') {
      const confirmed = window.confirm(
        'Are you sure you want to close this ticket?\n\nThis action is final. Once closed, you will not be able to change status, priority, or category.'
      );
      if (!confirmed) return;
    }
    setUpdating(true);
    try {
      const updated = await personalCrmService.updateTicket(ticketId, data);
      setTicket(updated);
    } catch (err) {
      clientLogger.error('[Personal CRM Ticket Detail] Update error:', { detail: err });
    } finally {
      setUpdating(false);
    }
  }

  async function handleSendReply() {
    if (replyContent.blocks.length === 0) return;
    setSending(true);
    try {
      const message = await personalCrmService.createTicketMessage(ticketId, { content_blocks: replyContent, is_internal: false });
      setMessages(prev => [...prev, message]);
      setReplyContent(DEFAULT_CONTENT_BLOCKS);
      setReplyKey(prev => prev + 1);
    } catch (err) {
      clientLogger.error('[Personal CRM Ticket Detail] Reply error:', { detail: err });
    } finally {
      setSending(false);
    }
  }

  async function handleAddNote() {
    if (!noteContent.trim()) return;
    setSending(true);
    try {
      const message = await personalCrmService.createTicketMessage(ticketId, { content: noteContent.trim(), is_internal: true });
      setMessages(prev => [...prev, message]);
      setNoteContent('');
    } catch (err) {
      clientLogger.error('[Personal CRM Ticket Detail] Note error:', { detail: err });
    } finally {
      setSending(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card withBorder p="xl"><Text c="dimmed" ta="center" py="md">Ticket not found.</Text></Card>
        </div>
      </div>
    );
  }

  const backUrl = ticket.project_id ? `/settings/crm/projects/${ticket.project_id}` : '/settings/crm';

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mb-4 flex-wrap">
          <Link href="/" className="hover:text-neutral-700 dark:hover:text-neutral-200">Dashboard</Link>
          <span>/</span>
          <Link href="/settings/crm" className="hover:text-neutral-700 dark:hover:text-neutral-200">CRM Hub</Link>
          {ticket.project_id && (
            <>
              <span>/</span>
              <Link href="/settings/crm/projects" className="hover:text-neutral-700 dark:hover:text-neutral-200">Projects</Link>
              <span>/</span>
              <Link href={`/settings/crm/projects/${ticket.project_id}`} className="hover:text-neutral-700 dark:hover:text-neutral-200">Project</Link>
            </>
          )}
          <span>/</span>
          <span className="text-neutral-900 dark:text-neutral-100">{ticket.title}</span>
        </nav>

        {/* Header */}
        <Group justify="space-between" mb="md">
          <div>
            <Title order={1}>{ticket.title}</Title>
            <Group gap="xs" mt="xs">
              <Badge variant="light" color={STATUS_COLORS[ticket.status] || 'gray'}>{ticket.status.replace('_', ' ')}</Badge>
              <Badge variant="light" color={PRIORITY_COLORS[ticket.priority] || 'gray'}>{ticket.priority}</Badge>
              {ticket.category && <Badge variant="light">{ticket.category}</Badge>}
            </Group>
          </div>
          <Link href={backUrl} className="text-sm text-blue-600 hover:underline">Back</Link>
        </Group>

        {/* Ticket Details Card */}
        <Card withBorder p="lg" mb="md">
          <Title order={3} mb="md">Ticket Details</Title>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Text size="xs" c="dimmed" mb={4}>Status</Text>
              <MantineSelect
                value={ticket.status}
                onChange={(v) => v && handleUpdateTicket({ status: v as TicketStatus })}
                disabled={updating || isClosed}
                data={STATUS_OPTIONS}
                size="sm"
              />
            </div>
            <div>
              <Text size="xs" c="dimmed" mb={4}>Priority</Text>
              <MantineSelect
                value={ticket.priority}
                onChange={(v) => v && handleUpdateTicket({ priority: v as TicketPriority })}
                disabled={updating || isClosed}
                data={PRIORITY_OPTIONS}
                size="sm"
              />
            </div>
            <div>
              <Text size="xs" c="dimmed" mb={4}>Category</Text>
              <input
                type="text"
                value={ticket.category || ''}
                onChange={(e) => !isClosed && handleUpdateTicket({ category: e.target.value || undefined })}
                disabled={isClosed}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-sm"
                placeholder="Category"
              />
            </div>
          </div>
          <div className="mt-4 text-sm space-y-1">
            <Text size="xs" c="dimmed">Created: {new Date(ticket.created_at).toLocaleString()}</Text>
            {ticket.first_responded_at && <Text size="xs" c="dimmed">First Response: {new Date(ticket.first_responded_at).toLocaleString()}</Text>}
            {ticket.resolved_at && <Text size="xs" c="dimmed">Resolved: {new Date(ticket.resolved_at).toLocaleString()}</Text>}
          </div>
        </Card>

        {/* Conversation Card */}
        <Card withBorder p="lg">
          <Title order={3} mb="md">Conversation</Title>

          {messages.length === 0 ? (
            <Text c="dimmed" ta="center" py="md">No messages yet.</Text>
          ) : (
            <Stack gap="md">
              {messages.map(m => {
                const isInternal = m.is_internal;
                const isPlatform = m.author_type === 'platform';
                const isCustomer = m.author_type === 'customer';
                const accentColor = isCustomer ? '#3B82F6' : isPlatform ? '#8B5CF6' : '#F59E0B';
                return (
                  <div
                    key={m.id}
                    className={`rounded-lg p-4 ${
                      isInternal
                        ? 'bg-amber-50 dark:bg-amber-900/10 border border-dashed border-amber-200 dark:border-amber-800'
                        : ''
                    }`}
                    style={!isInternal ? {
                      background: accentColor + '1A',
                      border: `1px solid ${accentColor}40`,
                    } : undefined}
                  >
                    <Group justify="space-between" mb="xs">
                      <Group gap="xs">
                        <Text size="sm" fw={500}>{m.author_name}</Text>
                        <Badge size="xs" variant="light" color={isPlatform ? 'violet' : isCustomer ? 'blue' : 'orange'}>{m.author_type}</Badge>
                        {isInternal && <Badge size="xs" variant="light" color="orange">Internal</Badge>}
                      </Group>
                      <Text size="xs" c="dimmed">{new Date(m.created_at).toLocaleString()}</Text>
                    </Group>
                    {m.content_blocks ? (
                      <RichContentRenderer content={m.content_blocks as ContentBlocks} />
                    ) : (
                      <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{m.content}</Text>
                    )}
                  </div>
                );
              })}
            </Stack>
          )}

          {/* Reply form */}
          <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700">
            <Stack gap="sm">
              <RichContentEditor
                key={replyKey}
                value={replyContent}
                onChange={setReplyContent}
                tenantId={ticket?.tenant_id || undefined}
                className="min-h-[160px]"
              />
              <Group justify="flex-end">
                <Button onClick={handleSendReply} loading={sending} disabled={replyContent.blocks.length === 0}>
                  Send Reply
                </Button>
              </Group>
            </Stack>
          </div>

          {/* Internal note form */}
          <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700">
            <Stack gap="sm">
              <Textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Add an internal note..."
                minRows={3}
                className="bg-amber-50/30 dark:bg-amber-900/5"
              />
              <Group justify="flex-end">
                <Button variant="outline" onClick={handleAddNote} loading={sending} disabled={!noteContent.trim()}>
                  Add Internal Note
                </Button>
              </Group>
            </Stack>
          </div>
        </Card>
      </div>
    </div>
  );
}
