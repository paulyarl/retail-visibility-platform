'use client';

import { useState, useEffect, useCallback } from 'react';
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

  return (
    <div className="space-y-4">
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
