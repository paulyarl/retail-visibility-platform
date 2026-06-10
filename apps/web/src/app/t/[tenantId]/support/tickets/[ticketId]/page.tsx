'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner } from '@/components/ui';
import { crmTenantCrmService } from '@/services/crm/CrmTenantCrmService';
import TenantCrmPageShell from '@/components/crm/TenantCrmPageShell';
import type { CrmTicket, CrmTicketMessage, TicketStatus, TicketPriority } from '@/types/crm';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-amber-100 text-amber-800',
  waiting: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
};

const STATUS_OPTIONS: TicketStatus[] = ['open', 'in_progress', 'waiting', 'resolved', 'closed'];
const PRIORITY_OPTIONS: TicketPriority[] = ['low', 'medium', 'high', 'urgent'];

export default function TenantTicketDetailPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const ticketId = params.ticketId as string;

  const [ticket, setTicket] = useState<CrmTicket | null>(null);
  const [messages, setMessages] = useState<CrmTicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [ticketData, messageData] = await Promise.all([
          crmTenantCrmService.listTickets(),
          crmTenantCrmService.listTicketMessages(ticketId),
        ]);
        const found = (ticketData ?? []).find((t: CrmTicket) => t.id === ticketId) ?? null;
        setTicket(found);
        setMessages(messageData ?? []);
      } catch (err) {
        console.error('[Tenant Ticket Detail] Load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [ticketId]);

  async function handleReply() {
    if (!reply.trim()) return;
    setSubmitting(true);
    try {
      const msg = await crmTenantCrmService.createTicketMessage(ticketId, {
        content: reply.trim(),
        is_internal: isInternal,
      });
      setMessages(prev => [...prev, msg]);
      setReply('');
      setIsInternal(false);
    } catch (err) {
      console.error('[Tenant Ticket Detail] Reply error:', err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(newStatus: TicketStatus) {
    if (!ticket) return;
    setUpdating(true);
    setShowStatusDropdown(false);
    try {
      const updated = await crmTenantCrmService.updateTicket(ticketId, { status: newStatus });
      setTicket(updated);
    } catch (err) {
      console.error('[Tenant Ticket Detail] Status change error:', err);
    } finally {
      setUpdating(false);
    }
  }

  async function handlePriorityChange(newPriority: TicketPriority) {
    if (!ticket) return;
    setUpdating(true);
    setShowPriorityDropdown(false);
    try {
      const updated = await crmTenantCrmService.updateTicket(ticketId, { priority: newPriority });
      setTicket(updated);
    } catch (err) {
      console.error('[Tenant Ticket Detail] Priority change error:', err);
    } finally {
      setUpdating(false);
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
      <TenantCrmPageShell
        tenantId={tenantId}
        title="Ticket Not Found"
        breadcrumbs={[
          { label: 'Dashboard', href: `/t/${tenantId}/dashboard` },
          { label: 'Support', href: `/t/${tenantId}/support` },
          { label: 'Tickets', href: `/t/${tenantId}/support/tickets` },
          { label: 'Not Found' },
        ]}
      >
        <div className="text-center py-12">
          <p className="text-neutral-500">Ticket not found</p>
          <Link href={`/t/${tenantId}/support/tickets`} className="text-amber-600 hover:underline text-sm mt-2 inline-block">
            Back to Tickets
          </Link>
        </div>
      </TenantCrmPageShell>
    );
  }

  return (
    <TenantCrmPageShell
      tenantId={tenantId}
      title={ticket.title}
      breadcrumbs={[
        { label: 'Dashboard', href: `/t/${tenantId}/dashboard` },
        { label: 'Support', href: `/t/${tenantId}/support` },
        { label: 'Tickets', href: `/t/${tenantId}/support/tickets` },
        { label: ticket.id },
      ]}
    >
      {/* Ticket header with actions */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{ticket.title}</h2>
          <p className="text-sm text-neutral-500 mt-1">
            {ticket.customer_id ? `Customer: ${ticket.customer_id}` : 'No customer'} · Created {new Date(ticket.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status dropdown */}
          <div className="relative">
            <button
              onClick={() => { setShowStatusDropdown(!showStatusDropdown); setShowPriorityDropdown(false); }}
              disabled={updating}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${STATUS_COLORS[ticket.status] || 'bg-gray-100 text-gray-800'} hover:opacity-80 transition-opacity`}
            >
              {ticket.status?.replace('_', ' ')}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showStatusDropdown && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg py-1 min-w-[140px]">
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 ${s === ticket.status ? 'font-semibold' : ''}`}
                  >
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Priority dropdown */}
          <div className="relative">
            <button
              onClick={() => { setShowPriorityDropdown(!showPriorityDropdown); setShowStatusDropdown(false); }}
              disabled={updating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:opacity-80 transition-opacity"
            >
              {ticket.priority || 'No priority'}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showPriorityDropdown && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg py-1 min-w-[140px]">
                {PRIORITY_OPTIONS.map(p => (
                  <button
                    key={p}
                    onClick={() => handlePriorityChange(p)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 ${p === ticket.priority ? 'font-semibold' : ''}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {ticket.description && (
        <Card>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Conversation */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Conversation</h3>
        {messages.map(m => (
          <div
            key={m.id}
            className={`rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 ${
              m.author_type === 'customer' ? 'bg-blue-50/50 dark:bg-blue-900/10' :
              m.is_internal ? 'bg-yellow-50/50 dark:bg-yellow-900/10 border-dashed' :
              'bg-neutral-50/50 dark:bg-neutral-800/50'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium">{m.author_name}</span>
              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                m.author_type === 'customer' ? 'bg-blue-100 text-blue-700' :
                m.author_type === 'tenant' ? 'bg-amber-100 text-amber-700' :
                'bg-purple-100 text-purple-700'
              }`}>
                {m.author_type}
              </span>
              {m.is_internal && (
                <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-700">Internal</span>
              )}
              <span className="text-xs text-neutral-400">{new Date(m.created_at).toLocaleString()}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{m.content}</p>
          </div>
        ))}
        {messages.length === 0 && (
          <p className="text-sm text-neutral-400 text-center py-4">No messages yet</p>
        )}
      </div>

      {/* Reply composer */}
      {ticket.status !== 'closed' && (
        <Card>
          <CardContent className="space-y-3">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Type your reply..."
              rows={3}
              className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
            />
            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-xs text-neutral-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  className="rounded border-neutral-300"
                />
                Internal note (customer won&apos;t see this)
              </label>
              <button
                onClick={handleReply}
                disabled={!reply.trim() || submitting}
                className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Sending...' : 'Send Reply'}
              </button>
            </div>
          </CardContent>
        </Card>
      )}
    </TenantCrmPageShell>
  );
}
