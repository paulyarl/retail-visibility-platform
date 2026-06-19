'use client';

import { useState, useEffect, useCallback } from 'react';
import { botService, type BotConfig, type BotDashboardStats, type BotConversation } from '@/services/BotService';
import { useChatbotOptionsCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import { toast } from '@/hooks/use-toast';

interface BotTenantWidgetProps {
  tenantId: string;
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  paused: 'bg-yellow-100 text-yellow-800',
  disabled: 'bg-red-100 text-red-800',
};

const CONVERSATION_STATUS_BADGE: Record<string, string> = {
  active: 'bg-blue-100 text-blue-800',
  closed: 'bg-gray-100 text-gray-600',
  archived: 'bg-gray-100 text-gray-400',
};

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

export default function BotTenantWidget({ tenantId }: BotTenantWidgetProps) {
  const { data: chatbotCaps } = useChatbotOptionsCapability(tenantId, { forTenant: true });
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [stats, setStats] = useState<BotDashboardStats | null>(null);
  const [conversations, setConversations] = useState<BotConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'conversations'>('overview');

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const [cfg, dashboardStats, convs] = await Promise.all([
        botService.getConfig(tenantId),
        botService.getDashboardStats(tenantId),
        botService.listConversations(tenantId, { limit: 5 }),
      ]);
      setConfig(cfg);
      setStats(dashboardStats);
      setConversations(convs.conversations);
    } catch (err: any) {
      setError(err?.message || 'Failed to load bot data');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleStatus = async () => {
    if (!config || !tenantId) return;
    const newStatus = config.status === 'active' ? 'paused' : 'active';
    try {
      const updated = await botService.updateConfig(tenantId, { status: newStatus });
      setConfig(updated);
      toast({ title: newStatus === 'active' ? 'Bot activated' : 'Bot paused' });
    } catch (err: any) {
      toast({ title: 'Failed to update bot status', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600 text-sm">{error}</p>
        <button onClick={fetchData} className="mt-2 text-sm text-indigo-600 hover:underline">
          Try again
        </button>
      </div>
    );
  }

  // Capability gate: chatbot not enabled
  if (chatbotCaps && !chatbotCaps.enabled) {
    return (
      <div className="p-6 text-center">
        <div className="text-4xl mb-3">🤖</div>
        <h3 className="text-lg font-semibold text-gray-900">Chatbot Not Available</h3>
        <p className="text-sm text-gray-500 mt-1">
          Your current plan does not include the chatbot feature.
        </p>
        <a href="/dashboard/billing" className="mt-4 inline-block text-sm text-indigo-600 hover:underline">
          Upgrade your plan →
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-xl">
            🤖
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{config?.botName || 'Chatbot'}</h3>
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[config?.status || 'active']}`}>
              {config?.status || 'active'}
            </span>
          </div>
        </div>
        <button
          onClick={handleToggleStatus}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            config?.status === 'active'
              ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
              : 'bg-green-50 text-green-700 hover:bg-green-100'
          }`}
        >
          {config?.status === 'active' ? 'Pause' : 'Activate'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'overview'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('conversations')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'conversations'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Recent Conversations
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && stats && (
        <div className="space-y-4">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Chats" value={stats.totalConversations} icon="💬" />
            <StatCard label="Active" value={stats.activeConversations} icon="🟢" />
            <StatCard label="FAQ Resolved" value={stats.resolvedByFaq} icon="📚" />
            <StatCard label="Skill Resolved" value={stats.resolvedBySkill} icon="⚡" />
          </div>

          {/* Resolution Breakdown */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Resolution Breakdown</h4>
            <div className="space-y-2">
              <ResolutionBar label="FAQ" value={stats.resolvedByFaq} total={stats.totalConversations} color="bg-blue-500" />
              <ResolutionBar label="Skills" value={stats.resolvedBySkill} total={stats.totalConversations} color="bg-purple-500" />
              <ResolutionBar label="Fallback" value={stats.resolvedByFallback} total={stats.totalConversations} color="bg-gray-400" />
            </div>
          </div>

          {/* Rating */}
          {stats.avgRating !== null && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">Avg Rating:</span>
              <span className="font-medium text-gray-900">
                {(stats.avgRating * 100).toFixed(0)}% positive
              </span>
            </div>
          )}

          {/* Widget Setup Preview */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Widget Preview</h4>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                style={{ background: config?.widgetColor || '#4F46E5' }}
              >
                💬
              </div>
              <div>
                <div>Position: {config?.widgetPosition || 'bottom-right'}</div>
                <div>Greeting: &ldquo;{config?.greeting || 'Hi! How can I help?'}&rdquo;</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Conversations Tab */}
      {activeTab === 'conversations' && (
        <div className="space-y-2">
          {conversations.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">
              No conversations yet.
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${CONVERSATION_STATUS_BADGE[conv.status] || 'bg-gray-100'}`}>
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
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <div>
          <div className="text-xl font-bold text-gray-900">{value}</div>
          <div className="text-xs text-gray-500">{label}</div>
        </div>
      </div>
    </div>
  );
}

function ResolutionBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 w-16">{label}</span>
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-600 w-8 text-right">{value}</span>
    </div>
  );
}
