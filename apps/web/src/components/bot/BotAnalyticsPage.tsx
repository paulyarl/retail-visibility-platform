'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { toast } from '@/hooks/use-toast';
import { botService } from '@/services/BotService';
import { useChatbotOptionsCapability } from '@/hooks/tenant-access/useCapabilityAccess';

interface BotAnalyticsPageProps {
  tenantId: string;
}

interface AnalyticsData {
  totalConversations?: number;
  activeConversations?: number;
  escalatedConversations?: number;
  closedConversations?: number;
  archivedConversations?: number;
  totalMessages?: number;
  avgRating?: number | null;
  resolutionBreakdown?: { faq: number; skill: number; fallback: number };
  topIntents?: { intent: string; count: number }[];
  dailyCounts?: { date: string; count: number }[];
}

export default function BotAnalyticsPage({ tenantId }: BotAnalyticsPageProps) {
  const { data: chatbotCaps } = useChatbotOptionsCapability(tenantId, { forTenant: true });
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const data = await botService.getAnalytics(tenantId);
      setAnalytics(data);
    } catch (err: any) {
      toast({ title: 'Failed to load analytics', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (chatbotCaps && !chatbotCaps.enabled) {
    return (
      <div className="p-6 text-center">
        <div className="text-4xl mb-3">🤖</div>
        <h3 className="text-lg font-semibold text-gray-900">Chatbot Not Available</h3>
        <p className="text-sm text-gray-500 mt-1">Your current plan does not include the chatbot feature.</p>
        <Link href={`/t/${tenantId}/settings/subscription`} className="mt-4 inline-block text-sm text-indigo-600 hover:underline">
          Upgrade your plan →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Conversations" value={analytics?.totalConversations ?? 0} icon="💬" />
        <StatCard label="Active" value={analytics?.activeConversations ?? 0} icon="🟢" />
        <StatCard label="Escalated" value={analytics?.escalatedConversations ?? 0} icon="⚠️" />
        <StatCard label="Closed" value={analytics?.closedConversations ?? 0} icon="✅" />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Archived" value={analytics?.archivedConversations ?? 0} icon="📦" />
        <StatCard label="Total Messages" value={analytics?.totalMessages ?? 0} icon="📨" />
        <StatCard
          label="Avg Rating"
          value={analytics?.avgRating !== null && analytics?.avgRating !== undefined ? `${(analytics.avgRating * 100).toFixed(0)}%` : 'N/A'}
          icon="⭐"
        />
        <StatCard
          label="FAQ Resolution"
          value={analytics?.resolutionBreakdown?.faq ?? 0}
          icon="📚"
        />
      </div>

      {/* Resolution Breakdown */}
      {analytics?.resolutionBreakdown && (
        <Card>
          <CardHeader><CardTitle>Resolution Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              <ResolutionBar label="FAQ" value={analytics.resolutionBreakdown.faq} total={analytics.totalConversations || 1} color="bg-blue-500" />
              <ResolutionBar label="Skills" value={analytics.resolutionBreakdown.skill} total={analytics.totalConversations || 1} color="bg-purple-500" />
              <ResolutionBar label="Fallback" value={analytics.resolutionBreakdown.fallback} total={analytics.totalConversations || 1} color="bg-gray-400" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Intents */}
      {analytics?.topIntents && analytics.topIntents.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Top Intents</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.topIntents.map((item, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-700">{item.intent}</span>
                  <span className="text-sm font-medium text-gray-900">{item.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Activity */}
      {analytics?.dailyCounts && analytics.dailyCounts.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Daily Activity</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.dailyCounts.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-24">{item.date}</span>
                  <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded" style={{ width: `${Math.min((item.count / Math.max(...(analytics.dailyCounts ?? []).map(d => d.count), 1)) * 100, 100)}%` }} />
                  </div>
                  <span className="text-xs text-gray-600 w-8 text-right">{item.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!analytics && (
        <Card>
          <CardContent className="p-8 text-center text-gray-400">
            No analytics data available yet.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <div>
            <div className="text-xl font-bold text-gray-900">{value}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        </div>
      </CardContent>
    </Card>
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
