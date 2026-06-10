'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner } from '@/components/ui';
import { crmCustomerService } from '@/services/crm/CrmCustomerService';
import type { CrmTicket, CrmTicketMessage } from '@/types/crm';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-amber-100 text-amber-800',
  waiting: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
};

export default function CustomerTicketDetailPage() {
  const params = useParams();
  const ticketId = params.ticketId as string;
  const [ticket, setTicket] = useState<CrmTicket | null>(null);
  const [messages, setMessages] = useState<CrmTicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [ticketData, messageData] = await Promise.all([
          crmCustomerService.getTicketDetail(ticketId),
          crmCustomerService.listTicketMessages(ticketId),
        ]);
        setTicket(ticketData);
        // Filter out internal notes for customers
        setMessages(messageData.filter(m => !m.is_internal));
      } catch (err) {
        console.error('[Customer Ticket Detail] Load error:', err);
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
      const msg = await crmCustomerService.createTicketMessage(ticketId, {
        content: reply.trim(),
      });
      setMessages(prev => [...prev, msg]);
      setReply('');
    } catch (err) {
      console.error('[Customer Ticket Detail] Reply error:', err);
    } finally {
      setSubmitting(false);
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
      <div className="text-center py-20">
        <p className="text-neutral-500">Ticket not found</p>
        <Link href="/account/support" className="text-amber-600 hover:underline text-sm mt-2 inline-block">
          Back to Support
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/account/support" className="hover:text-amber-600">Support</Link>
        <span>/</span>
        <span className="text-neutral-900 dark:text-white">{ticket.title}</span>
      </div>

      {/* Ticket header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">{ticket.title}</h1>
          <p className="text-sm text-neutral-500 mt-1">
            <span className="inline-flex items-center gap-1.5">
              {ticket.tenant_logo ? (
                <img src={ticket.tenant_logo} alt="" className="w-5 h-5 rounded object-cover" />
              ) : (
                <span className="w-5 h-5 rounded bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[9px] font-bold text-neutral-500">{(ticket.tenant_name || ticket.tenant_id).charAt(0)}</span>
              )}
              {ticket.tenant_name || ticket.tenant_id}
            </span> · Created {new Date(ticket.created_at).toLocaleDateString()}
          </p>
        </div>
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ticket.status] || 'bg-gray-100 text-gray-800'}`}>
          {ticket.status?.replace('_', ' ')}
        </span>
      </div>

      {/* Description */}
      {ticket.description && (
        <Card>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Message thread */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Conversation</h2>
        {messages.map(m => (
          <div
            key={m.id}
            className={`rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 ${
              m.author_type === 'customer' ? 'ml-8 bg-amber-50/50 dark:bg-amber-900/10' : 'mr-8'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium">{m.author_name}</span>
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
      {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
        <Card>
          <CardContent className="space-y-3">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Type your reply..."
              rows={3}
              className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
            />
            <div className="flex justify-end">
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
    </div>
  );
}
