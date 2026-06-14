'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner } from '@/components/ui';
import { crmTenantCrmService } from '@/services/crm/CrmTenantCrmService';
import { tenantUserService, User } from '@/services/TenantUserService';
import { useAuth } from '@/contexts/AuthContext';
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
const CATEGORY_OPTIONS = ['support', 'billing', 'technical', 'sales', 'general', 'bug', 'feature_request', 'account'];

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
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [tenantUsers, setTenantUsers] = useState<User[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const { user } = useAuth();
  const isClosed = ticket?.status === 'closed';

  useEffect(() => {
    async function load() {
      try {
        const [ticketData, messageData, users] = await Promise.all([
          crmTenantCrmService.listTickets(),
          crmTenantCrmService.listTicketMessages(ticketId),
          tenantUserService.getTenantUsers(tenantId),
        ]);
        const found = (ticketData ?? []).find((t: CrmTicket) => t.id === ticketId) ?? null;
        setTicket(found);
        setMessages(messageData ?? []);
        setTenantUsers(users ?? []);
        // Load activities related to this ticket
        const activityList = await crmTenantCrmService.listActivities({ limit: 50 });
        const related = (activityList ?? []).filter((a: any) => a.ticket_id === ticketId);
        setActivities(related);
      } catch (err) {
        console.error('[Tenant Ticket Detail] Load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [ticketId, tenantId]);

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

  async function refreshActivities() {
    try {
      const activityList = await crmTenantCrmService.listActivities({ limit: 50 });
      const related = (activityList ?? []).filter((a: any) => a.ticket_id === ticketId);
      setActivities(related);
    } catch (err) {
      console.error('[Tenant Ticket Detail] Activity refresh error:', err);
    }
  }

  async function handleStatusChange(newStatus: TicketStatus) {
    if (!ticket) return;
    if (newStatus === 'closed') {
      const confirmed = window.confirm(
        'Are you sure you want to close this ticket?\n\nThis action is final. Once closed, you will not be able to change status, priority, category, or assignment.'
      );
      if (!confirmed) return;
    }
    setUpdating(true);
    setShowStatusDropdown(false);
    try {
      const updated = await crmTenantCrmService.updateTicket(ticketId, { status: newStatus });
      setTicket(updated);
      await refreshActivities();
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
      await refreshActivities();
    } catch (err) {
      console.error('[Tenant Ticket Detail] Priority change error:', err);
    } finally {
      setUpdating(false);
    }
  }

  async function handleAssignChange(userId: string | null) {
    if (!ticket) return;
    setUpdating(true);
    setShowAssignDropdown(false);
    try {
      const updated = await crmTenantCrmService.updateTicket(ticketId, { assigned_to: userId ?? undefined });
      setTicket(updated);
      await refreshActivities();
    } catch (err) {
      console.error('[Tenant Ticket Detail] Assign change error:', err);
    } finally {
      setUpdating(false);
    }
  }

  async function handleCategoryChange(newCategory: string) {
    if (!ticket) return;
    setUpdating(true);
    setShowCategoryDropdown(false);
    try {
      const updated = await crmTenantCrmService.updateTicket(ticketId, { category: newCategory });
      setTicket(updated);
      await refreshActivities();
    } catch (err) {
      console.error('[Tenant Ticket Detail] Category change error:', err);
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
              onClick={() => { if (isClosed) return; setShowStatusDropdown(!showStatusDropdown); setShowPriorityDropdown(false); setShowCategoryDropdown(false); setShowAssignDropdown(false); }}
              disabled={updating || isClosed}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${STATUS_COLORS[ticket.status] || 'bg-gray-100 text-gray-800'} hover:opacity-80 transition-opacity ${isClosed ? 'opacity-60 cursor-not-allowed' : ''}`}
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

          {/* Category dropdown */}
          <div className="relative">
            <button
              onClick={() => { if (isClosed) return; setShowCategoryDropdown(!showCategoryDropdown); setShowStatusDropdown(false); setShowPriorityDropdown(false); setShowAssignDropdown(false); }}
              disabled={updating || isClosed}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 hover:opacity-80 transition-opacity ${isClosed ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {ticket.category || 'No category'}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showCategoryDropdown && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg py-1 min-w-[140px]">
                <button
                  onClick={() => handleCategoryChange('')}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 ${!ticket.category ? 'font-semibold' : ''}`}
                >
                  No category
                </button>
                {CATEGORY_OPTIONS.map(c => (
                  <button
                    key={c}
                    onClick={() => handleCategoryChange(c)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 ${c === ticket.category ? 'font-semibold' : ''}`}
                  >
                    {c.replace('_', ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Priority dropdown */}
          <div className="relative">
            <button
              onClick={() => { if (isClosed) return; setShowPriorityDropdown(!showPriorityDropdown); setShowStatusDropdown(false); setShowCategoryDropdown(false); setShowAssignDropdown(false); }}
              disabled={updating || isClosed}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:opacity-80 transition-opacity ${isClosed ? 'opacity-60 cursor-not-allowed' : ''}`}
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

          {/* Assign dropdown */}
          {tenantUsers.length > 0 && (
            <div className="relative">
              <button
                onClick={() => { if (isClosed) return; setShowAssignDropdown(!showAssignDropdown); setShowStatusDropdown(false); setShowPriorityDropdown(false); setShowCategoryDropdown(false); }}
                disabled={updating || isClosed}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:opacity-80 transition-opacity ${isClosed ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {ticket.assigned_to ? tenantUsers.find(u => u.id === ticket.assigned_to)?.name || 'Assigned' : 'Assign'}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showAssignDropdown && (
                <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg py-1 min-w-[180px] max-h-48 overflow-y-auto">
                  <button
                    onClick={() => handleAssignChange(null)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 ${!ticket.assigned_to ? 'font-semibold' : ''}`}
                  >
                    Unassigned
                  </button>
                  {tenantUsers.map(u => (
                    <button
                      key={u.id}
                      onClick={() => handleAssignChange(u.id)}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 ${u.id === ticket.assigned_to ? 'font-semibold' : ''}`}
                    >
                      {u.name || u.email}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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

      {/* Metadata */}
      <Card>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-neutral-500 text-xs">Customer</p>
              <p className="font-medium">{ticket.customer_id || '—'}</p>
            </div>
            <div>
              <p className="text-neutral-500 text-xs">Assigned To</p>
              <p className="font-medium">{ticket.assigned_to ? tenantUsers.find(u => u.id === ticket.assigned_to)?.name || ticket.assigned_to : 'Unassigned'}</p>
            </div>
            <div>
              <p className="text-neutral-500 text-xs">Priority</p>
              <p className="font-medium">{ticket.priority || '—'}</p>
            </div>
            <div>
              <p className="text-neutral-500 text-xs">Category</p>
              <p className="font-medium">{ticket.category || '—'}</p>
            </div>
            <div>
              <p className="text-neutral-500 text-xs">Created</p>
              <p className="font-medium">{new Date(ticket.created_at).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-neutral-500 text-xs">Updated</p>
              <p className="font-medium">{new Date(ticket.updated_at).toLocaleString()}</p>
            </div>
            {ticket.resolved_at && (
              <div>
                <p className="text-neutral-500 text-xs">Resolved</p>
                <p className="font-medium">{new Date(ticket.resolved_at).toLocaleString()}</p>
              </div>
            )}
            {ticket.inquiry_id && (
              <div>
                <p className="text-neutral-500 text-xs">Source Inquiry</p>
                <Link href={`/t/${tenantId}/support/inquiries/${ticket.inquiry_id}`} className="font-medium text-amber-600 hover:underline">
                  View Inquiry →
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
              <span className="text-xs font-medium">{m.author_type === 'tenant' ? (tenantUsers.find(u => u.id === m.author_id)?.name || m.author_name) : m.author_name}</span>
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

      {/* Activity History */}
      <Card>
        <CardContent>
          <h3 className="text-sm font-semibold mb-3">Activity History</h3>
          {activities.length === 0 ? (
            <p className="text-sm text-neutral-500">No activity recorded for this ticket.</p>
          ) : (
            <div className="space-y-3">
              {activities.map((a) => {
                const actorUser = tenantUsers.find(u => u.id === a.actor_id);
                const currentUserName = user?.firstName || user?.lastName
                  ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                  : null;
                const displayName = actorUser?.name || (a.actor_id === user?.id ? currentUserName : null) || a.actor_name;
                return (
                  <div key={a.id} className="flex gap-3 py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{a.content || a.activity_type}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {displayName} · {a.activity_type} · {new Date(a.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
