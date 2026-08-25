'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Spinner,
  Input,
  Select,
} from '@/components/ui';
import gbpMonitorService, {
  GbpOverviewStats,
  GbpTenantsResponse,
  GbpJobHealth,
  GbpEntitlementSummary,
} from '@/services/GbpMonitorService';

// ── Quick Action Definitions ──────────────────────────────────────────────

interface QuickAction {
  label: string;
  href: string;
  description: string;
  icon: string;
  color: string;
  condition?: (overview: GbpOverviewStats | null, jobs: GbpJobHealth | null) => boolean;
  alert?: (overview: GbpOverviewStats | null, jobs: GbpJobHealth | null) => string | null;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: 'Capability Management',
    href: '/settings/admin/capabilities',
    description: 'View gbp_management capability type, feature keys, and resolver status',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20',
  },
  {
    label: 'Tier & Feature Matrix',
    href: '/settings/admin/tier-system',
    description: 'Verify gbp_management_flexible is assigned to the correct tiers',
    icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2',
    color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20',
  },
  {
    label: 'BSaaS Catalog',
    href: '/settings/admin/bsaas-catalog',
    description: 'Manage GBP feature pricing, trial periods, and catalog visibility',
    icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
    color: 'text-violet-600 bg-violet-50 dark:bg-violet-900/20',
  },
  {
    label: 'Feature Overrides',
    href: '/settings/admin/feature-overrides',
    description: 'Grant complimentary GBP features to individual tenants',
    icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
    color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20',
  },
  {
    label: 'Recovery & Disputes',
    href: '/settings/admin/marketing-ops/recovery',
    description: 'Review GBP review dispute intake submissions from customers',
    icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
  },
  {
    label: 'Presence Seeds',
    href: '/settings/admin/directory/presence-seeds',
    description: 'Manage unclaimed directory listings and send claim invites',
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
  },
  {
    label: 'Campaign Tracker',
    href: '/settings/admin/marketing-ops/campaigns',
    description: 'View prospect campaigns in the pipeline (claim → verify → convert)',
    icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20',
  },
  {
    label: 'Marketing Ops Dashboard',
    href: '/settings/admin/marketing-ops',
    description: 'Campaign pipeline health, conversion metrics, and revenue tracking',
    icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z',
    color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
  },
];

// ── Contextual Alerts ─────────────────────────────────────────────────────

interface ContextualAlert {
  severity: 'warning' | 'error' | 'info';
  message: string;
  action?: { label: string; href: string };
}

function getContextualAlerts(
  overview: GbpOverviewStats | null,
  jobs: GbpJobHealth | null
): ContextualAlert[] {
  const alerts: ContextualAlert[] = [];
  if (!overview) return alerts;

  if (overview.posts.stuckScheduled > 0) {
    alerts.push({
      severity: 'error',
      message: `${overview.posts.stuckScheduled} post(s) stuck in SCHEDULED status past their scheduled time. The post scheduler job may need attention.`,
      action: { label: 'View Job Health', href: '#jobs' },
    });
  }
  if (overview.posts.failed > 0) {
    alerts.push({
      severity: 'warning',
      message: `${overview.posts.failed} failed post(s). Check job logs for GBP API errors (token expiry, media upload failures).`,
      action: { label: 'View Job Health', href: '#jobs' },
    });
  }
  if (overview.locations.unverified > 0) {
    alerts.push({
      severity: 'info',
      message: `${overview.locations.unverified} location(s) connected but not yet verified. Customers need to complete GBP verification.`,
      action: { label: 'View Tenants', href: '#tenants' },
    });
  }
  if (overview.connections > 0 && overview.merchantGates.some((g) => !g.reviewsDisplay || !g.contentDisplay)) {
    const disabledCount = overview.merchantGates
      .filter((g) => !g.reviewsDisplay || !g.contentDisplay)
      .reduce((sum, g) => sum + g.count, 0);
    alerts.push({
      severity: 'info',
      message: `${disabledCount} tenant(s) have disabled GBP public display (merchant gate off). Their reviews/posts will not appear on directory pages.`,
      action: { label: 'View Entitlements', href: '#entitlements' },
    });
  }

  return alerts;
}

type Tab = 'overview' | 'tenants' | 'jobs' | 'entitlements';

export default function GbpMonitorClient() {
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<GbpOverviewStats | null>(null);
  const [tenants, setTenants] = useState<GbpTenantsResponse | null>(null);
  const [jobs, setJobs] = useState<GbpJobHealth | null>(null);
  const [entitlements, setEntitlements] = useState<GbpEntitlementSummary | null>(null);
  const [search, setSearch] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      const data = await gbpMonitorService.getOverview();
      setOverview(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load overview');
    }
  }, []);

  const fetchTenants = useCallback(async () => {
    try {
      const data = await gbpMonitorService.getTenants({
        page,
        limit: 50,
        search,
        verification: verificationFilter,
      });
      setTenants(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load tenants');
    }
  }, [page, search, verificationFilter]);

  const fetchJobs = useCallback(async () => {
    try {
      const data = await gbpMonitorService.getJobHealth();
      setJobs(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load job health');
    }
  }, []);

  const fetchEntitlements = useCallback(async () => {
    try {
      const data = await gbpMonitorService.getEntitlements();
      setEntitlements(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load entitlements');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    if (tab === 'overview') fetchOverview().finally(() => setLoading(false));
    else if (tab === 'tenants') fetchTenants().finally(() => setLoading(false));
    else if (tab === 'jobs') fetchJobs().finally(() => setLoading(false));
    else if (tab === 'entitlements') fetchEntitlements().finally(() => setLoading(false));
  }, [tab, fetchOverview, fetchTenants, fetchJobs, fetchEntitlements]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'tenants', label: 'Tenants' },
    { key: 'jobs', label: 'Job Health' },
    { key: 'entitlements', label: 'Entitlements' },
  ];

  const contextualAlerts = getContextualAlerts(overview, jobs);

  return (
    <div className="space-y-4">
      {/* Contextual Alerts */}
      {contextualAlerts.length > 0 && (
        <div className="space-y-2">
          {contextualAlerts.map((alert, i) => {
            const colors = {
              error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300',
              warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
              info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
            };
            return (
              <div key={i} className={`border rounded-lg p-3 text-sm flex items-start justify-between gap-3 ${colors[alert.severity]}`}>
                <span>{alert.message}</span>
                {alert.action && (
                  <button
                    onClick={() => {
                      if (alert.action!.href.startsWith('#')) {
                        const tabKey = alert.action!.href.slice(1) as Tab;
                        setTab(tabKey);
                      } else {
                        window.location.href = alert.action!.href;
                      }
                    }}
                    className="text-xs font-medium underline whitespace-nowrap"
                  >
                    {alert.action.label}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="group flex flex-col gap-2 p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${action.color}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={action.icon} />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  {action.label}
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {action.description}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-700">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* Overview Tab */}
          {tab === 'overview' && overview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="GBP Connections" value={overview.connections} color="text-blue-600" />
                <StatCard
                  label="Verified Locations"
                  value={`${overview.locations.verified} / ${overview.locations.total}`}
                  color="text-green-600"
                />
                <StatCard label="Total Reviews" value={overview.reviews.total} color="text-amber-600" />
                <StatCard label="Total Posts" value={overview.posts.total} color="text-purple-600" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Reviews (7d)" value={overview.reviews.last7Days} color="text-amber-500" />
                <StatCard label="Total Media" value={overview.media.total} color="text-cyan-600" />
                <StatCard
                  label="Stuck Posts"
                  value={overview.posts.stuckScheduled}
                  color={overview.posts.stuckScheduled > 0 ? 'text-red-600' : 'text-green-600'}
                />
                <StatCard
                  label="Failed Posts"
                  value={overview.posts.failed}
                  color={overview.posts.failed > 0 ? 'text-red-600' : 'text-green-600'}
                />
              </div>

              {/* Merchant Gate Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Merchant Gate Settings</CardTitle>
                  <CardDescription>How tenants have configured their GBP display preferences</CardDescription>
                </CardHeader>
                <CardContent>
                  {overview.merchantGates.length === 0 ? (
                    <p className="text-sm text-neutral-500">No tenants have configured merchant gate settings yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {overview.merchantGates.map((g, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-lg border border-neutral-200 dark:border-neutral-700 p-3"
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant={g.reviewsDisplay ? 'default' : 'secondary'}>
                              Reviews: {g.reviewsDisplay ? 'On' : 'Off'}
                            </Badge>
                            <Badge variant={g.contentDisplay ? 'default' : 'secondary'}>
                              Content: {g.contentDisplay ? 'On' : 'Off'}
                            </Badge>
                          </div>
                          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                            {g.count} tenant{g.count !== 1 ? 's' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tenants Tab */}
          {tab === 'tenants' && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Input
                  placeholder="Search tenants..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="max-w-xs"
                />
                <Select
                  value={verificationFilter}
                  onChange={(e) => {
                    setVerificationFilter(e.target.value);
                    setPage(1);
                  }}
                  className="max-w-xs"
                >
                  <option value="">All Verification States</option>
                  <option value="verified">Verified Only</option>
                  <option value="unverified">Unverified Only</option>
                </Select>
              </div>

              {tenants && (
                <>
                  <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <table className="w-full text-sm">
                      <thead className="bg-neutral-50 dark:bg-neutral-800">
                        <tr>
                          <th className="text-left p-3 font-medium">Tenant</th>
                          <th className="text-left p-3 font-medium">Verification</th>
                          <th className="text-left p-3 font-medium">Rating</th>
                          <th className="text-left p-3 font-medium">Reviews</th>
                          <th className="text-left p-3 font-medium">Posts</th>
                          <th className="text-left p-3 font-medium">Media</th>
                          <th className="text-left p-3 font-medium">Gates</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                        {tenants.tenants.map((t) => (
                          <tr key={t.tenantId} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                            <td className="p-3">
                              <div className="font-medium">{t.tenantName}</div>
                              <div className="text-xs text-neutral-500">{t.tenantId}</div>
                            </td>
                            <td className="p-3">
                              <Badge
                                variant={t.verificationState === 'VERIFIED' ? 'default' : 'secondary'}
                              >
                                {t.verificationState}
                              </Badge>
                            </td>
                            <td className="p-3">
                              {t.cachedRating ? (
                                <span className="font-medium">{t.cachedRating.toFixed(1)}★</span>
                              ) : (
                                <span className="text-neutral-400">—</span>
                              )}
                            </td>
                            <td className="p-3">{t.reviewCount}</td>
                            <td className="p-3">{t.postCount}</td>
                            <td className="p-3">{t.mediaCount}</td>
                            <td className="p-3">
                              <div className="flex gap-1">
                                <Badge variant={t.merchantGate.reviewsDisplay ? 'default' : 'secondary'}>
                                  R:{t.merchantGate.reviewsDisplay ? 'On' : 'Off'}
                                </Badge>
                                <Badge variant={t.merchantGate.contentDisplay ? 'default' : 'secondary'}>
                                  C:{t.merchantGate.contentDisplay ? 'On' : 'Off'}
                                </Badge>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {tenants.pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-neutral-500">
                        Page {tenants.pagination.page} of {tenants.pagination.totalPages} ({tenants.pagination.total} total)
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page <= 1}
                          className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setPage((p) => Math.min(tenants.pagination.totalPages, p + 1))}
                          disabled={page >= tenants.pagination.totalPages}
                          className="px-3 py-1 text-sm border rounded disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Job Health Tab */}
          {tab === 'jobs' && jobs && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label="Reviews (1h)"
                  value={jobs.reviewIngestion.reviewsLastHour}
                  color="text-amber-600"
                />
                <StatCard
                  label="Awaiting Reply"
                  value={jobs.reviewIngestion.reviewsAwaitingReply}
                  color="text-orange-600"
                />
                <StatCard
                  label="Published (15m)"
                  value={jobs.postScheduler.publishedLast15Min}
                  color="text-green-600"
                />
                <StatCard
                  label="Stuck Scheduled"
                  value={jobs.postScheduler.stuckCount}
                  color={jobs.postScheduler.stuckCount > 0 ? 'text-red-600' : 'text-green-600'}
                />
              </div>

              {/* Stuck Scheduled Posts */}
              {jobs.postScheduler.stuckScheduled.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-red-600">Stuck Scheduled Posts</CardTitle>
                    <CardDescription>
                      Posts past their scheduled_for time but still in SCHEDULED status — check post scheduler job
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {jobs.postScheduler.stuckScheduled.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between rounded-lg border border-red-200 dark:border-red-800 p-3"
                        >
                          <div>
                            <div className="font-medium text-sm">{p.summary || p.topic_type || 'Untitled'}</div>
                            <div className="text-xs text-neutral-500">
                              Tenant: {p.tenant_id} · Scheduled: {p.scheduled_for}
                            </div>
                          </div>
                          <Badge variant="destructive">{p.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Failed Posts */}
              {jobs.postScheduler.failed.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-red-600">Failed Posts</CardTitle>
                    <CardDescription>Posts that failed to publish — check job logs for API errors</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {jobs.postScheduler.failed.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between rounded-lg border border-red-200 dark:border-red-800 p-3"
                        >
                          <div>
                            <div className="font-medium text-sm">{p.summary || p.topic_type || 'Untitled'}</div>
                            <div className="text-xs text-neutral-500">
                              Tenant: {p.tenant_id} · Created: {p.created_at}
                            </div>
                          </div>
                          <Badge variant="destructive">{p.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {jobs.postScheduler.stuckScheduled.length === 0 &&
                jobs.postScheduler.failed.length === 0 && (
                  <Card>
                    <CardContent className="py-8 text-center text-neutral-500">
                      All GBP jobs are healthy — no stuck or failed posts.
                    </CardContent>
                  </Card>
                )}
            </div>
          )}

          {/* Entitlements Tab */}
          {tab === 'entitlements' && entitlements && (
            <div className="space-y-4">
              {/* Tier Entitlements */}
              <Card>
                <CardHeader>
                  <CardTitle>Tier Entitlements</CardTitle>
                  <CardDescription>Tiers with GBP feature keys assigned</CardDescription>
                </CardHeader>
                <CardContent>
                  {entitlements.tierEntitlements.length === 0 ? (
                    <p className="text-sm text-neutral-500">No tier entitlements found.</p>
                  ) : (
                    <div className="space-y-2">
                      {entitlements.tierEntitlements.map((t, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-lg border border-neutral-200 dark:border-neutral-700 p-3"
                        >
                          <div>
                            <span className="font-medium text-sm">{t.tierName}</span>
                            <span className="text-xs text-neutral-500 ml-2">({t.tierKey})</span>
                          </div>
                          <Badge>{t.featureKey}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* BSaaS Purchases */}
              <Card>
                <CardHeader>
                  <CardTitle>BSaaS Purchases</CardTitle>
                  <CardDescription>Active GBP feature purchases by tenants</CardDescription>
                </CardHeader>
                <CardContent>
                  {entitlements.bsaasPurchases.length === 0 ? (
                    <p className="text-sm text-neutral-500">No BSaaS purchases found.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-neutral-50 dark:bg-neutral-800">
                          <tr>
                            <th className="text-left p-3 font-medium">Tenant</th>
                            <th className="text-left p-3 font-medium">Feature</th>
                            <th className="text-left p-3 font-medium">Source</th>
                            <th className="text-left p-3 font-medium">Expires</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                          {entitlements.bsaasPurchases.map((p, i) => (
                            <tr key={i}>
                              <td className="p-3 font-mono text-xs">{p.tenantId}</td>
                              <td className="p-3">{p.featureKey}</td>
                              <td className="p-3">
                                <Badge variant="secondary">{p.source}</Badge>
                              </td>
                              <td className="p-3 text-neutral-500">{p.expiresAt || 'Never'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Feature Grants */}
              <Card>
                <CardHeader>
                  <CardTitle>Feature Grants</CardTitle>
                  <CardDescription>Admin complimentary GBP feature grants</CardDescription>
                </CardHeader>
                <CardContent>
                  {entitlements.featureGrants.length === 0 ? (
                    <p className="text-sm text-neutral-500">No feature grants found.</p>
                  ) : (
                    <div className="space-y-2">
                      {entitlements.featureGrants.map((g, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-lg border border-neutral-200 dark:border-neutral-700 p-3"
                        >
                          <div>
                            <div className="font-mono text-xs">{g.tenantId}</div>
                            <div className="text-xs text-neutral-500">
                              Granted by {g.grantedBy} · {g.reason}
                            </div>
                          </div>
                          <Badge>{g.featureKey}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Merchant Gate Disabled */}
              <Card>
                <CardHeader>
                  <CardTitle>Merchant Gate Disabled</CardTitle>
                  <CardDescription>Tenants that have turned off GBP public display</CardDescription>
                </CardHeader>
                <CardContent>
                  {entitlements.merchantGateDisabled.length === 0 ? (
                    <p className="text-sm text-neutral-500">All tenants have default merchant gate settings.</p>
                  ) : (
                    <div className="space-y-2">
                      {entitlements.merchantGateDisabled.map((m, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-lg border border-neutral-200 dark:border-neutral-700 p-3"
                        >
                          <span className="font-mono text-xs">{m.tenantId}</span>
                          <div className="flex gap-1">
                            <Badge variant={m.reviewsDisplay ? 'default' : 'secondary'}>
                              Reviews: {m.reviewsDisplay ? 'On' : 'Off'}
                            </Badge>
                            <Badge variant={m.contentDisplay ? 'default' : 'secondary'}>
                              Content: {m.contentDisplay ? 'On' : 'Off'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
