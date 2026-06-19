'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner } from '@/components/ui';
import { botPlatformAdminService, type BotDashboardStats } from '@/services/bot/BotPlatformAdminService';

export default function BotDashboardPage() {
  const [stats, setStats] = useState<BotDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await botPlatformAdminService.getDashboardStats();
        setStats(data);
      } catch (err) {
        console.error('[Bot Dashboard] Load error:', err);
        setError('Failed to load dashboard stats');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bot Platform Dashboard</h1>
        <p className="text-sm text-neutral-500 mt-1">Global chatbot overview and health</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Active Bots" value={stats?.activeConfigs ?? 0} href="/settings/admin/bot/tenants" color="green" />
        <StatCard label="Total Bots" value={stats?.totalConfigs ?? 0} color="blue" />
        <StatCard label="Conversations (7d)" value={stats?.recentConversations ?? 0} color="purple" />
        <StatCard label="Total Messages" value={stats?.totalMessages ?? 0} color="amber" />
        <StatCard label="Active Skills" value={stats?.activeSkills ?? 0} href="/settings/admin/bot/skills" color="blue" />
        <StatCard label="Total Skills" value={stats?.totalSkills ?? 0} color="blue" />
        <StatCard label="Active Guardrails" value={stats?.activeGuardrailRules ?? 0} href="/settings/admin/bot/guardrails" color="red" />
        <StatCard label="Total Intents" value={stats?.totalIntents ?? 0} href="/settings/admin/bot/intents" color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Resolution breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Resolution Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {(!stats?.resolutionStats || stats.resolutionStats.length === 0) ? (
              <p className="text-sm text-neutral-500">No resolution data yet</p>
            ) : (
              <div className="space-y-2">
                {stats.resolutionStats.map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                    <span className="text-sm font-medium capitalize">{r.resolved_by || 'unresolved'}</span>
                    <Badge>{r.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top intents */}
        <Card>
          <CardHeader>
            <CardTitle>Top Detected Intents</CardTitle>
          </CardHeader>
          <CardContent>
            {(!stats?.topIntents || stats.topIntents.length === 0) ? (
              <p className="text-sm text-neutral-500">No intent data yet</p>
            ) : (
              <div className="space-y-2">
                {stats.topIntents.map((t: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                    <span className="text-sm font-medium capitalize">{t.intent}</span>
                    <Badge variant="default">{t.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-3">
        <Link href="/settings/admin/bot/guardrails" className="px-4 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-sm font-medium transition-colors">
          Manage Guardrails
        </Link>
        <Link href="/settings/admin/bot/intents" className="px-4 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-sm font-medium transition-colors">
          Manage Intents
        </Link>
        <Link href="/settings/admin/bot/skills" className="px-4 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-sm font-medium transition-colors">
          Manage Skills
        </Link>
        <Link href="/settings/admin/bot/knowledge" className="px-4 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-sm font-medium transition-colors">
          Knowledge Base
        </Link>
      </div>
    </div>
  );
}

function StatCard({ label, value, href, color }: { label: string; value: number | string; href?: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    red: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    green: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    purple: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  };

  const content = (
    <div className={`rounded-lg p-4 ${colorMap[color] || colorMap.blue}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}
