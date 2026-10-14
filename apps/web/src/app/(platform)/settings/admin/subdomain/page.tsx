'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { isPlatformAdmin } from '@/lib/auth/access-control';
import {
  platformHomeService,
  type AdminCustomDomainStats,
  type AdminRateLimits,
  type AdminSubdomainRow,
  type SubdomainStats,
} from '@/services/PlatformHomeSingletonService';
import { describeRateLimit } from '@/lib/rate-limit-format';
import AdminCustomDomainsSection from '@/admin/components/AdminCustomDomainsSection';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Modal, ModalFooter } from '@/components/ui';
import { Badge } from '@/components/ui/Badge';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import PageHeader, { Icons } from '@/components/PageHeader';
import {
  TrendingUp,
  Users,
  Globe,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowUpRight,
  Trash2,
  Search,
} from 'lucide-react';
import { clientLogger } from '@/lib/client-logger';

const PAGE_SIZE = 20;

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function AdminSubdomainPage() {
  const { user } = useAuth();

  const [stats, setStats] = useState<SubdomainStats | null>(null);
  const [domainStats, setDomainStats] = useState<AdminCustomDomainStats | null>(null);
  const [rateLimits, setRateLimits] = useState<AdminRateLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const [rows, setRows] = useState<AdminSubdomainRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [listLoading, setListLoading] = useState(false);

  // Remove modal
  const [removeTarget, setRemoveTarget] = useState<AdminSubdomainRow | null>(null);
  const [removeReason, setRemoveReason] = useState('');
  const [removing, setRemoving] = useState(false);

  const hasAccess = user && isPlatformAdmin(user);

  const [platformUrl, setPlatformUrl] = useState<string>('visibleshelf.com');

  useEffect(() => {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : 'visibleshelf.com';
    const port = typeof window !== 'undefined' ? window.location.port : '';

    if (hostname.endsWith('.visibleshelf.com')) {
      setPlatformUrl('visibleshelf.com');
    } else if (hostname.endsWith('.visibleshelf.store')) {
      setPlatformUrl('visibleshelf.store');
    } else if (hostname.endsWith('.localhost') || hostname === 'localhost') {
      setPlatformUrl(port ? `localhost:${port}` : 'localhost');
    } else {
      setPlatformUrl('visibleshelf.com');
    }
  }, []);

  const fetchSubdomainStats = useCallback(async () => {
    try {
      const data = await platformHomeService.getAdminSubdomainStats();
      setStats(data);
    } catch (err) {
      clientLogger.error('Failed to fetch subdomain stats:', { detail: err });
      setError('Failed to load subdomain statistics');
    }
  }, []);

  // Read the enforced limits from the backend — the panel used to hardcode them
  // while claiming they came from the server, so any config change silently made
  // the dashboard wrong.
  const fetchRateLimits = useCallback(async () => {
    try {
      setRateLimits(await platformHomeService.getAdminRateLimits());
    } catch (err) {
      clientLogger.error('Failed to fetch rate limits:', { detail: err });
    }
  }, []);

  // Custom-domain adoption — the subdomain-stats endpoint cannot see
  // custom_domains at all, so the header read 0 adoptions on a page that also
  // tracks tenant-owned domains.
  const fetchDomainStats = useCallback(async () => {
    try {
      setDomainStats(await platformHomeService.getAdminCustomDomainStats());
    } catch (err) {
      clientLogger.error('Failed to fetch custom domain stats:', { detail: err });
    }
  }, []);

  const fetchRows = useCallback(async (nextSearch: string, nextPage: number) => {
    setListLoading(true);
    try {
      const result = await platformHomeService.getAdminSubdomains({
        search: nextSearch || undefined,
        page: nextPage,
        limit: PAGE_SIZE,
      });
      if (!result) {
        setError('Failed to load subdomains');
        return;
      }
      setRows(result.data);
      setTotal(result.total);
    } catch (err) {
      clientLogger.error('Failed to fetch admin subdomains:', { detail: err });
      setError('Failed to load subdomains');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasAccess) return;
    fetchRateLimits();
    fetchDomainStats();
    fetchSubdomainStats().finally(() => setLoading(false));
    fetchRows('', 1);
  }, [hasAccess, fetchSubdomainStats, fetchRows, fetchRateLimits, fetchDomainStats]);

  // Debounced search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!hasAccess) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchRows(search, 1);
    }, 350);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search, hasAccess, fetchRows]);

  const submitRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    const result = await platformHomeService.removeAdminSubdomain(removeTarget.tenantId, removeReason || undefined);
    setRemoving(false);
    if (!result.success) {
      setError(`Failed to remove subdomain (${result.error ?? 'unknown'})`);
      return;
    }
    setRemoveTarget(null);
    setRemoveReason('');
    await fetchRows(search, page);
    await fetchSubdomainStats();
  };

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3"></div>
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-2/3"></div>
          <div className="h-64 bg-neutral-200 dark:bg-neutral-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            You don't have permission to access admin subdomain settings.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Domain Management"
        description="Platform subdomains and tenant-owned custom domains — usage, adoption, and support tooling"
        icon={Icons.Admin}
        backLink={{
          href: '/settings/admin',
          label: 'Back to Admin Dashboard',
        }}
      />

      {error && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {/* Key Metrics */}
        {/* Subdomain metrics and custom-domain metrics are separate surfaces —
            labelled explicitly so neither reads as the whole picture. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 dark:bg-gray-800">
              <CardTitle className="text-sm font-medium text-gray-900 dark:text-white">Total Tenants</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="dark:bg-gray-800">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.totalTenants || 0}</div>
              <p className="text-xs text-muted-foreground dark:text-gray-400">Registered tenants</p>
            </CardContent>
          </Card>

          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 dark:bg-gray-800">
              <CardTitle className="text-sm font-medium text-gray-900 dark:text-white">Platform Subdomain Users</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="dark:bg-gray-800">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.tenantsWithSubdomains || 0}</div>
              <p className="text-xs text-muted-foreground dark:text-gray-400">With a subdomain assigned</p>
            </CardContent>
          </Card>

          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 dark:bg-gray-800">
              <CardTitle className="text-sm font-medium text-gray-900 dark:text-white">Subdomain Adoption Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="dark:bg-gray-800">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.adoptionRate || 0}%</div>
              <p className="text-xs text-muted-foreground dark:text-gray-400">Of total tenants</p>
            </CardContent>
          </Card>

          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 dark:bg-gray-800">
              <CardTitle className="text-sm font-medium text-gray-900 dark:text-white">Recent Subdomain Adoptions</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="dark:bg-gray-800">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.recentAdoptions || 0}</div>
              <p className="text-xs text-muted-foreground dark:text-gray-400">Last 30 days</p>
            </CardContent>
          </Card>

          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 dark:bg-gray-800">
              <CardTitle className="text-sm font-medium text-gray-900 dark:text-white">Custom Domain Users</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="dark:bg-gray-800">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{domainStats?.tenantsWithCustomDomains || 0}</div>
              <p className="text-xs text-muted-foreground dark:text-gray-400">With a live domain</p>
            </CardContent>
          </Card>

          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 dark:bg-gray-800">
              <CardTitle className="text-sm font-medium text-gray-900 dark:text-white">Recent Domain Attachments</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="dark:bg-gray-800">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{domainStats?.recentAttachments || 0}</div>
              <p className="text-xs text-muted-foreground dark:text-gray-400">Last 30 days</p>
            </CardContent>
          </Card>
        </div>

        {/* Subdomain List */}
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="dark:bg-gray-800">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-gray-900 dark:text-white">Active Subdomains</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-300">
                  Tenants with configured subdomains. To rename one, use the tenant&apos;s own slug tools —
                  the subdomain mirrors the slug, so the two move together.
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <Input
                  aria-label="Search subdomains"
                  placeholder="Search tenant or subdomain…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="dark:bg-gray-800">
            {listLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 bg-neutral-100 dark:bg-neutral-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <p className="text-neutral-500 dark:text-gray-400">
                {search ? 'No subdomains match your search.' : 'No subdomains configured yet'}
              </p>
            ) : (
              <div className="space-y-2">
                {rows.map((item) => (
                  <div
                    key={item.tenantId}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                      <div className="min-w-0">
                        <Link
                          href={`/t/${item.tenantId}/settings/subdomain`}
                          title={`Open subdomain configuration for ${item.tenantName ?? item.tenantId}`}
                          className="font-medium text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 inline-flex items-center gap-1"
                        >
                          <span className="truncate">
                            {item.subdomain}.{platformUrl}
                          </span>
                          <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                        </Link>
                        <p className="text-sm text-neutral-500 dark:text-gray-400 truncate">
                          Tenant: {item.tenantName ?? item.tenantId}
                          {item.slug ? ` · slug: ${item.slug}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* The assignment date, not the tenant's creation date —
                          `createdAt` is when the tenant row was created. */}
                      <span
                        title={
                          item.assignedAt
                            ? `Subdomain assigned ${new Date(item.assignedAt).toLocaleDateString()}`
                            : 'Assignment date not recorded (assigned before dates were tracked)'
                        }
                      >
                        <Badge variant="default">
                          {item.assignedAt ? new Date(item.assignedAt).toLocaleDateString() : '—'}
                        </Badge>
                      </span>
                      <Button variant="secondary" size="sm" onClick={() => setRemoveTarget(item)}>
                        <Trash2 className="w-3.5 h-3.5 mr-1.5 text-red-600" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}

                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-3">
                    <p className="text-sm text-neutral-500 dark:text-gray-400">
                      {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); fetchRows(search, p); }}>
                        Previous
                      </Button>
                      <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); fetchRows(search, p); }}>
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Custom Domains — tenant-owned domains, DFY attach, verification support */}
        <AdminCustomDomainsSection />

        {/* Management Section */}
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader className="dark:bg-gray-800">
            <CardTitle className="text-gray-900 dark:text-white">Subdomain Management</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-300">
              Administrative controls for subdomain system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 dark:bg-gray-800">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Refresh Analytics</h3>
                <p className="text-sm text-neutral-500 dark:text-gray-400">Update subdomain usage statistics</p>
              </div>
              <Button
                onClick={() => { fetchSubdomainStats(); fetchDomainStats(); fetchRows(search, page); fetchRateLimits(); }}
                variant="secondary"
                size="sm"
                disabled={listLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${listLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {/* Rate Limiting Configuration */}
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">Rate Limiting</h3>
                <p className="text-xs text-neutral-500 dark:text-gray-400 mt-1">
                  Read from the backend configuration — the same limits the write routes enforce.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                  <h4 className="font-medium text-sm text-gray-900 dark:text-white">Subdomain Checks</h4>
                  <p className="text-sm text-neutral-500 dark:text-gray-400 mt-1">
                    {describeRateLimit(rateLimits?.subdomainCheck)}
                  </p>
                </div>
                <div className="p-4 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                  <h4 className="font-medium text-sm text-gray-900 dark:text-white">Subdomain Creation</h4>
                  <p className="text-sm text-neutral-500 dark:text-gray-400 mt-1">
                    {describeRateLimit(rateLimits?.subdomainCreate)}
                  </p>
                </div>
                <div className="p-4 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                  <h4 className="font-medium text-sm text-gray-900 dark:text-white">Subdomain Resolution</h4>
                  <p className="text-sm text-neutral-500 dark:text-gray-400 mt-1">
                    {describeRateLimit(rateLimits?.subdomainResolve)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Remove modal */}
      <Modal
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title="Remove subdomain"
        description={removeTarget ? `${removeTarget.subdomain}.${platformUrl}` : undefined}
      >
        <div className="space-y-4">
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 text-sm">
              This removes the tenant's subdomain and its storefront URL. The tenant's slug is kept. This
              cannot be undone from here.
            </AlertDescription>
          </Alert>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
            <Input value={removeReason} onChange={(e) => setRemoveReason(e.target.value)} placeholder="e.g. duplicate subdomain" />
          </div>

          <ModalFooter>
            <Button variant="secondary" onClick={() => setRemoveTarget(null)} disabled={removing}>
              Cancel
            </Button>
            <Button onClick={submitRemove} disabled={removing}>
              {removing ? 'Removing…' : 'Remove subdomain'}
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  );
}
