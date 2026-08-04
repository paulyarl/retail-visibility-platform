'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send } from 'lucide-react';
import marketingCustomerService, { SupportTicket, TicketMessage } from '@/services/MarketingCustomerService';

function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TicketDetailPage() {
  const params = useParams();
  const ticketId = (params?.ticketId as string) || '';

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await marketingCustomerService.getTicket(ticketId);
        setTicket(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load ticket');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [ticketId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.crm_ticket_messages]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      const msg = await marketingCustomerService.replyToTicket(ticketId, reply.trim());
      if (ticket) {
        setTicket({
          ...ticket,
          crm_ticket_messages: [...(ticket.crm_ticket_messages || []), msg],
        });
      }
      setReply('');
    } catch (err: any) {
      setError(err.message || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Link href="/account/marketing/support" className="text-gray-400 hover:text-gray-600 flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" /> Back to Support
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error || 'Ticket not found'}
        </div>
      </div>
    );
  }

  const messages = ticket.crm_ticket_messages || [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/account/marketing/support" className="text-gray-400 hover:text-gray-600 flex items-center gap-2">
        <ArrowLeft className="w-5 h-5" /> Back to Support
      </Link>

      {/* Ticket header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{ticket.title}</h1>
            <p className="text-sm text-gray-500 mt-1">Opened {formatDate(ticket.created_at)}</p>
            {ticket.description && <p className="text-sm text-gray-700 mt-3">{ticket.description}</p>}
          </div>
          <span className={`text-xs px-2 py-1 rounded ${
            ticket.status === 'open' ? 'bg-blue-50 text-blue-700' :
            ticket.status === 'resolved' ? 'bg-green-50 text-green-700' :
            'bg-gray-50 text-gray-700'
          }`}>
            {ticket.status || 'open'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Conversation</h2>
        </div>
        <div className="p-6 space-y-4 min-h-[200px]">
          {messages.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No messages yet. Start the conversation below.</p>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.author_type === 'customer' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[70%] rounded-lg p-3 ${
                  msg.author_type === 'customer'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}>
                  <p className="text-xs opacity-70 mb-1">{msg.author_name}</p>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className="text-xs opacity-50 mt-1">{formatDate(msg.created_at)}</p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Reply box */}
        <form onSubmit={handleReply} className="p-6 border-t border-gray-200">
          <div className="flex gap-3">
            <input
              type="text"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Type your reply..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={sending || !reply.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              <Send className="w-4 h-4" /> {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
