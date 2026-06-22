'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { botService } from '@/services/BotService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-blue-100 text-blue-800',
  closed: 'bg-gray-100 text-gray-600',
  archived: 'bg-gray-100 text-gray-400',
  escalated: 'bg-amber-100 text-amber-800',
};

const STATUS_ACTIONS: { label: string; value: 'active' | 'closed' | 'archived'; color: string }[] = [
  { label: 'Activate', value: 'active', color: 'text-blue-600 hover:bg-blue-50' },
  { label: 'Close', value: 'closed', color: 'text-gray-600 hover:bg-gray-100' },
  { label: 'Archive', value: 'archived', color: 'text-gray-400 hover:bg-gray-50' },
];

function relativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

interface BotConversationsPageProps {
  tenantId: string;
}

export default function BotConversationsPage({ tenantId }: BotConversationsPageProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [escalateModalOpen, setEscalateModalOpen] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  const [escalateSummary, setEscalateSummary] = useState('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: convData, isLoading } = useQuery({
    queryKey: ['bot', 'conversations', tenantId, { limit: 50, status: statusFilter }],
    queryFn: () => botService.listConversations(tenantId, {
      limit: 50,
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    }),
    enabled: !!tenantId,
    staleTime: 30 * 1000,
    retry: 0,
  });

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['bot', 'conversation', tenantId, selectedId],
    queryFn: () => botService.getConversation(tenantId, selectedId!),
    enabled: !!selectedId,
    staleTime: 10 * 1000,
    retry: 0,
  });

  const statusMutation = useMutation({
    mutationFn: ({ convId, status }: { convId: string; status: 'active' | 'closed' | 'archived' }) =>
      botService.updateConversationStatus(tenantId, convId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot', 'conversations', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['bot', 'conversation', tenantId, selectedId] });
      queryClient.invalidateQueries({ queryKey: ['bot', 'dashboard', tenantId] });
      setActionMessage({ type: 'success', text: 'Conversation status updated.' });
      setTimeout(() => setActionMessage(null), 3000);
    },
    onError: (err: Error) => {
      setActionMessage({ type: 'error', text: err.message || 'Failed to update status.' });
      setTimeout(() => setActionMessage(null), 5000);
    },
  });

  const escalateMutation = useMutation({
    mutationFn: ({ convId, reason, summary }: { convId: string; reason: string; summary?: string }) =>
      botService.escalateConversation(tenantId, convId, reason, summary),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bot', 'conversations', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['bot', 'conversation', tenantId, selectedId] });
      queryClient.invalidateQueries({ queryKey: ['bot', 'dashboard', tenantId] });
      setEscalateModalOpen(false);
      setEscalateReason('');
      setEscalateSummary('');
      setActionMessage({ type: 'success', text: `Escalated to CRM ticket: ${data.ticketTitle}` });
      setTimeout(() => setActionMessage(null), 5000);
    },
    onError: (err: Error) => {
      setActionMessage({ type: 'error', text: err.message || 'Failed to escalate conversation.' });
      setTimeout(() => setActionMessage(null), 5000);
    },
  });

  const conversations = convData?.conversations ?? [];
  const currentStatus = detailData?.conversation.status;
  const isEscalated = currentStatus === 'escalated';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status filter */}
      <div className="flex gap-2">
        {['all', 'active', 'escalated', 'closed', 'archived'].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setSelectedId(null); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === s
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {actionMessage && (
        <div className={`px-4 py-2 rounded-lg text-sm ${
          actionMessage.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {actionMessage.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Conversation list */}
        <Card>
          <CardHeader>
            <CardTitle>Conversations ({conversations.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {conversations.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-400">
                No conversations found.
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedId(conv.id)}
                    className={`w-full text-left flex items-center justify-between p-3 border rounded-lg transition-colors ${
                      selectedId === conv.id
                        ? 'border-indigo-300 bg-indigo-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[conv.status] || 'bg-gray-100'}`}>
                          {conv.status}
                        </span>
                        <span className="text-xs text-gray-400">{conv.source}</span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1 truncate">
                        {conv.customerEmail || conv.customerPhone || 'Anonymous'}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 ml-2 flex-shrink-0">
                      {relativeTime(conv.createdAt)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conversation detail */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Messages</CardTitle>
              {selectedId && detailData && !isEscalated && (
                <button
                  onClick={() => setEscalateModalOpen(true)}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
                >
                  Convert to Ticket
                </button>
              )}
              {selectedId && detailData && isEscalated && (
                <span className="px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg border border-amber-200">
                  Escalated to Ticket
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedId ? (
              <div className="text-center py-8 text-sm text-gray-400">
                Select a conversation to view messages.
              </div>
            ) : detailLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
              </div>
            ) : detailData ? (
              <div className="space-y-3">
                {/* Conversation header with status + actions */}
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[detailData.conversation.status] || 'bg-gray-100'}`}>
                      {detailData.conversation.status}
                    </span>
                    <span className="text-xs text-gray-500 truncate">
                      {detailData.conversation.customerEmail || detailData.conversation.customerPhone || 'Anonymous'}
                    </span>
                    {detailData.conversation.resolvedBy && (
                      <span className="text-xs text-gray-400">Resolved by {detailData.conversation.resolvedBy}</span>
                    )}
                  </div>
                  {/* Status action buttons */}
                  {!isEscalated && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {STATUS_ACTIONS.filter(a => a.value !== currentStatus).map((action) => (
                        <button
                          key={action.value}
                          onClick={() => statusMutation.mutate({ convId: selectedId, status: action.value })}
                          disabled={statusMutation.isPending}
                          className={`px-2 py-1 text-xs font-medium rounded transition-colors disabled:opacity-50 ${action.color}`}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Messages */}
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {detailData.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                          msg.role === 'user'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-indigo-50 text-gray-800'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-400">{relativeTime(msg.createdAt)}</span>
                          {msg.responseType && msg.responseType !== 'normal' && (
                            <span className="text-xs text-indigo-400">{msg.responseType}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-gray-400">
                Failed to load conversation.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Escalate to Ticket Modal */}
      {escalateModalOpen && selectedId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full mx-4 p-6 space-y-4">
            <h3 className="text-lg font-semibold">Convert Conversation to CRM Ticket</h3>
            <p className="text-sm text-gray-500">
              This will create a support ticket with the full conversation log attached. The conversation will be marked as escalated.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                <input
                  type="text"
                  value={escalateReason}
                  onChange={(e) => setEscalateReason(e.target.value)}
                  placeholder="e.g., Customer complaint, Refund request, Product question"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  maxLength={200}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Summary (optional)</label>
                <textarea
                  value={escalateSummary}
                  onChange={(e) => setEscalateSummary(e.target.value)}
                  placeholder="Brief summary of the issue..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  rows={3}
                  maxLength={1000}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setEscalateModalOpen(false); setEscalateReason(''); setEscalateSummary(''); }}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => escalateMutation.mutate({ convId: selectedId, reason: escalateReason, summary: escalateSummary || undefined })}
                disabled={!escalateReason.trim() || escalateMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {escalateMutation.isPending ? 'Creating...' : 'Create Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
