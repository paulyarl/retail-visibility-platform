'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner, Button, Select, Textarea, Modal, ModalFooter, ConfirmDialog } from '@/components/ui';
import { crmAdminService } from '@/services/crm/CrmAdminService';
import { adminUsersService, type AdminUser } from '@/services/AdminUsersService';
import { getContrastColor } from '@/lib/color-utils';
import CrmPageShell from '@/components/crm/CrmPageShell';
import type { CrmTicket, CrmTicketMessage, TicketStatus, TicketPriority } from '@/types/crm';

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
  open: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  in_progress: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  waiting: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-gray-100 text-gray-800',
};

export default function CrmTicketDetailPage() {
  const params = useParams();
  const ticketId = params.ticketId as string;
  const [ticket, setTicket] = useState<CrmTicket | null>(null);
  const [messages, setMessages] = useState<CrmTicketMessage[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const isClosed = ticket?.status === 'closed';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ticketRes, messagesRes, adminsRes] = await Promise.allSettled([
        crmAdminService.getTicket(ticketId),
        crmAdminService.listTicketMessages(ticketId),
        adminUsersService.getUsers(),
      ]);
      if (ticketRes.status === 'fulfilled') setTicket(ticketRes.value);
      if (messagesRes.status === 'fulfilled') setMessages(messagesRes.value);
      if (adminsRes.status === 'fulfilled') {
        setAdmins(adminsRes.value.filter(u =>
          ['PLATFORM_ADMIN', 'ADMIN', 'PLATFORM_SUPPORT'].includes(u.role)
        ));
      }
    } catch (err) {
      console.error('[CRM Ticket Detail] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpdateTicket(data: Partial<{ status: TicketStatus; priority: TicketPriority; assigned_to: string; category: string }>) {
    if (!ticket) return;
    if (data.status === 'closed') {
      const confirmed = window.confirm(
        'Are you sure you want to close this ticket?\n\nThis action is final. Once closed, you will not be able to change status, priority, category, or assignment.'
      );
      if (!confirmed) return;
    }
    setUpdating(true);
    try {
      const updated = await crmAdminService.updateTicket(ticketId, data);
      setTicket(updated);
    } catch (err) {
      console.error('[Ticket Detail] Update error:', err);
    } finally {
      setUpdating(false);
    }
  }

  async function handleSendReply() {
    if (!replyContent.trim()) return;
    setSending(true);
    try {
      const message = await crmAdminService.createTicketMessage(ticketId, { content: replyContent.trim(), is_internal: false });
      setMessages(prev => [...prev, message]);
      setReplyContent('');
    } catch (err) {
      console.error('[Ticket Detail] Reply error:', err);
    } finally {
      setSending(false);
    }
  }

  async function handleAddNote() {
    if (!noteContent.trim()) return;
    setSending(true);
    try {
      const message = await crmAdminService.createTicketMessage(ticketId, { content: noteContent.trim(), is_internal: true });
      setMessages(prev => [...prev, message]);
      setNoteContent('');
    } catch (err) {
      console.error('[Ticket Detail] Note error:', err);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <CrmPageShell title="Ticket Not Found" breadcrumbs={[{ label: 'CRM', href: '/settings/admin/crm' }, { label: 'Tickets', href: '/settings/admin/crm/tickets' }, { label: 'Not Found' }]}>
        <Card><CardContent><p className="text-neutral-500 py-8 text-center">The ticket you are looking for does not exist.</p></CardContent></Card>
      </CrmPageShell>
    );
  }

  return (
    <CrmPageShell
      title={ticket.title}
      subtitle={
        <span className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ticket.status] || 'bg-gray-100 text-gray-800'}`}>
            {ticket.status.replace('_', ' ')}
          </span>
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[ticket.priority] || 'bg-gray-100 text-gray-800'}`}>
            {ticket.priority}
          </span>
          {ticket.category && <Badge variant="default">{ticket.category}</Badge>}
        </span>
      }
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'CRM', href: '/settings/admin/crm' },
        { label: 'Tickets', href: '/settings/admin/crm/tickets' },
        { label: ticket.title },
      ]}
      actions={
        <Link href="/settings/admin/crm/tickets" className="text-sm text-amber-600 hover:text-amber-700 dark:text-amber-400">
          Back to Tickets
        </Link>
      }
    >
      <div className="space-y-6">
        {/* Ticket metadata + quick actions */}
        <Card>
          <CardHeader><CardTitle>Ticket Details</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">Status</label>
                <Select
                  value={ticket.status}
                  onChange={(e) => handleUpdateTicket({ status: e.target.value as TicketStatus })}
                  disabled={updating || isClosed}
                  options={STATUS_OPTIONS}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">Priority</label>
                <Select
                  value={ticket.priority}
                  onChange={(e) => handleUpdateTicket({ priority: e.target.value as TicketPriority })}
                  disabled={updating || isClosed}
                  options={PRIORITY_OPTIONS}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">Assigned To</label>
                <Select
                  value={ticket.assigned_to || ''}
                  onChange={(e) => handleUpdateTicket({ assigned_to: e.target.value || undefined })}
                  disabled={updating || isClosed}
                  options={[{ value: '', label: '— Unassigned —' }, ...admins.map(a => ({ value: a.id, label: a.email }))]}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">Category</label>
                <input
                  type="text"
                  value={ticket.category || ''}
                  onChange={(e) => !isClosed && handleUpdateTicket({ category: e.target.value || undefined })}
                  onBlur={(e) => !isClosed && handleUpdateTicket({ category: e.target.value || undefined })}
                  disabled={isClosed}
                  className={`w-full px-3 py-2 border rounded-lg text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${isClosed ? 'bg-neutral-100 cursor-not-allowed' : 'bg-white'}`}
                  placeholder="Category"
                />
              </div>
            </div>
            <div className="mt-4 text-sm text-neutral-500 space-y-1">
              <p><span className="font-medium">Tenant:</span> <Link href={`/settings/admin/crm/tenants/${ticket.tenant_id}`} className="text-amber-600 hover:underline">{ticket.tenant_id}</Link></p>
              <p><span className="font-medium">Created:</span> {new Date(ticket.created_at).toLocaleString()}</p>
              {ticket.first_responded_at && <p><span className="font-medium">First Response:</span> {new Date(ticket.first_responded_at).toLocaleString()}</p>}
              {ticket.resolved_at && <p><span className="font-medium">Resolved:</span> {new Date(ticket.resolved_at).toLocaleString()}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Message Thread */}
        <Card>
          <CardHeader><CardTitle>Conversation</CardTitle></CardHeader>
          <CardContent>
            {messages.length === 0 ? (
              <p className="text-neutral-500 text-center py-6">No messages yet</p>
            ) : (
              <div className="space-y-4">
                {messages.map(m => {
                  const isInternal = m.is_internal;
                  const isPlatform = m.author_type === 'platform';
                  const isCustomer = m.author_type === 'customer';
                  const accentColor = isCustomer ? '#3B82F6' : isPlatform ? '#8B5CF6' : '#F59E0B';
                  const useTintedBubble = !isInternal;
                  return (
                    <div
                      key={m.id}
                      className={`rounded-lg p-4 ${
                        isInternal
                          ? 'bg-amber-50 dark:bg-amber-900/10 border border-dashed border-amber-200 dark:border-amber-800'
                          : isCustomer ? 'ml-8' : 'mr-8'
                      }`}
                      style={useTintedBubble ? {
                        background: accentColor + '1A',
                        border: `1px solid ${accentColor}40`,
                        color: accentColor,
                      } : undefined}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{m.author_name}</span>
                          <Badge variant={isInternal ? 'warning' : isPlatform ? 'info' : 'default'}>
                            {m.author_type}
                          </Badge>
                          {isInternal && <Badge variant="warning">Internal</Badge>}
                        </div>
                        <span className="text-xs text-neutral-400">{new Date(m.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Reply form */}
            <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700">
              <div className="space-y-3">
                <Textarea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Type a public reply visible to the tenant/customer..."
                  className="min-h-[100px]"
                />
                <div className="flex justify-end">
                  <Button onClick={handleSendReply} disabled={sending || !replyContent.trim()}>
                    {sending ? <Spinner size="sm" /> : 'Send Reply'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Internal note form */}
            <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-700">
              <div className="space-y-3">
                <Textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Add an internal note (admin-only)..."
                  className="min-h-[80px] bg-amber-50/30 dark:bg-amber-900/5 border-amber-200 dark:border-amber-800"
                />
                <div className="flex justify-end">
                  <Button variant="outline" onClick={handleAddNote} disabled={sending || !noteContent.trim()}>
                    {sending ? <Spinner size="sm" /> : 'Add Internal Note'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </CrmPageShell>
  );
}
