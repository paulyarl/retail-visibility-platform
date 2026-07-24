'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner } from '@/components/ui';
import { crmCustomerService } from '@/services/crm/CrmCustomerService';
import { getContrastColor } from '@/lib/color-utils';
import { RichContentEditor } from '@/components/products/RichContentEditor';
import { RichContentRenderer } from '@/components/products/RichContentRenderer';
import { DEFAULT_CONTENT_BLOCKS, type ContentBlocks } from '@/components/products/content-blocks';
import type { CrmTicket, CrmTicketMessage } from '@/types/crm';
import { clientLogger } from '@/lib/client-logger';

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
  const [reply, setReply] = useState<ContentBlocks>(DEFAULT_CONTENT_BLOCKS);
  const [replyKey, setReplyKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      } catch (err: any) {
        clientLogger.error('[Customer Ticket Detail] Load error:', { detail: err });
        const msg = err?.message || '';
        if (msg.includes('crm_disabled') || msg.includes('not enabled')) {
          setError('Support tickets are not available for this store.');
        } else if (msg.includes('access_denied')) {
          setError('You do not have access to this ticket.');
        } else {
          setError('Failed to load ticket details. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [ticketId]);

  async function handleReply() {
    if (reply.blocks.length === 0) return;
    setSubmitting(true);
    try {
      const msg = await crmCustomerService.createTicketMessage(ticketId, {
        content_blocks: reply,
        is_internal: false,
      });
      setMessages(prev => [...prev, msg]);
      setReply(DEFAULT_CONTENT_BLOCKS);
      setReplyKey(prev => prev + 1);
    } catch (err) {
      clientLogger.error('[Customer Ticket Detail] Reply error:', { detail: err });
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

  if (!ticket || error) {
    return (
      <div className="text-center py-20">
        <p className="text-neutral-500">{error || 'Ticket not found'}</p>
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
                <span className="w-5 h-5 rounded bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[9px] font-bold text-neutral-500">{(ticket.tenant_name || ticket.tenant_id || '?').charAt(0)}</span>
              )}
              {ticket.tenant_name || ticket.tenant_id || 'Unknown'}
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
        {messages.map(m => {
          const isCustomer = m.author_type === 'customer';
          const accentColor = '#F59E0B';
          return (
          <div
            key={m.id}
            className={`rounded-lg p-4 ${isCustomer ? 'ml-8' : 'mr-8 border border-neutral-200 dark:border-neutral-700'}`}
            style={isCustomer ? {
              background: accentColor + '1A',
              border: `1px solid ${accentColor}40`,
              color: accentColor,
            } : undefined}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium">{m.author_name}</span>
              <span className="text-xs text-neutral-400">{new Date(m.created_at).toLocaleString()}</span>
            </div>
            {m.content_blocks ? (
              <RichContentRenderer content={m.content_blocks as ContentBlocks} />
            ) : (
              <p className="text-sm whitespace-pre-wrap">{m.content}</p>
            )}
          </div>
          );
        })}
        {messages.length === 0 && (
          <p className="text-sm text-neutral-400 text-center py-4">No messages yet</p>
        )}
      </div>

      {/* Reply composer */}
      {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
        <Card>
          <CardContent className="space-y-3">
            <RichContentEditor
              key={replyKey}
              value={reply}
              onChange={setReply}
              tenantId={ticket?.tenant_id || undefined}
              className="min-h-[160px]"
            />
            <div className="flex justify-end">
              <button
                onClick={handleReply}
                disabled={reply.blocks.length === 0 || submitting}
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
