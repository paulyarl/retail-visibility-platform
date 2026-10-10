'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { isPlatformAdmin } from '@/lib/auth/access-control';
import {
  platformHomeService,
  type AdminSubdomainRow,
} from '@/services/PlatformHomeSingletonService';
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
  Pencil,
  Trash2,
  Search,
} from 'lucide-react';
import { clientLogger } from '@/lib/client-logger';

interface SubdomainStats {
  totalTenants: number;
  tenantsWithSubdomains: number;
  adoptionRate: number;
  recentAdoptions: number;
  subdomainList: Array<{
    subdomain: string;
    tenantId: string;
    tenantName?: string;
    createdAt: string;
  }>;
}

interface RateLimitConfig {
  subdomainCheck: { maxRequests: number; windowMs: number };
  subdomainCreate: { maxRequests: number; windowMs: number };
  subdomainResolve: { maxRequests: number; windowMs: number };
}

type Availability = { available: boolean; reason: string | null; takenBy: { tenantId: string; tenantName: string | null } | null };

const PAGE_SIZE = 20;

const AVAILABILITY_MESSAGE: Record<string, string> = {
  invalid_subdomain: 'Invalid format — 2–30 chars, lowercase letters, numbers, hyphens.',
  reserved_subdomain: 'This name is reserved by the platform.',
  subdomain_taken: 'Already taken by another tenant.',
};

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function AdminSubdomainPage() {
  const { user } = useAuth();

  const [stats, setStats] = useState<SubdomainStats | null>(null);
  const [rateLimits, setRateLimits] = useState<RateLimitConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const [rows, setRows] = useState<AdminSubdomainRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [listLoading, setListLoading] = useState(false);

  // Rename modal
  const [renameTarget, setRenameTarget] = useState<AdminSubdomainRow | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameReason, setRenameReason] = useState('');
  const [renameAvailability, setRenameAvailability] = useState<Availability | null>(null);
  const [renameChecking, setRenameChecking] = useState(false);
  const [saving, setSaving] = useState(false);

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
    setRateLimits({
      subdomainCheck: { maxRequests: 10, windowMs: 60 * 1000 },
      subdomainCreate: { maxRequests: 3, windowMs: 60 * 60 * 1000 },
      subdomainResolve: { maxRequests: 100, windowMs: 60 * 1000 },
    });
    fetchSubdomainStats().finally(() => setLoading(false));
    fetchRows('', 1);
  }, [hasAccess, fetchSubdomainStats, fetchRows]);

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

  // Debounced availability check for the rename modal
  useEffect(() => {
    if (!renameTarget) return;
    const value = renameValue.trim().toLowerCase();
    if (!value || value === renameTarget.subdomain) {
      setRenameAvailability(null);
      return;
    }
    setRenameChecking(true);
    const timer = setTimeout(async () => {
      const result = await platformHomeService.checkAdminSubdomainAvailability(value, renameTarget.tenantId);
      setRenameAvailability(result);
      setRenameChecking(false);
    }, 350);
    return () => {
      clearTimeout(timer);
      setRenameChecking(false);
    };
  }, [renameValue, renameTarget]);

  const openRename = (row: AdminSubdomainRow) => {
    setRenameTarget(row);
    setRenameValue(row.subdomain ?? '');
    setRenameReason('');
    setRenameAvailability(null);
    setError('');
  };

  const submitRename = async () => {
    if (!renameTarget) return;
    const value = renameValue.trim().toLowerCase();
    if (!value) {
      setError('Enter a subdomain');
      return;
    }
    if (renameAvailability && !renameAvailability.available) {
      setError(AVAILABILITY_MESSAGE[renameAvailability.reason ?? ''] ?? 'That subdomain is not available');
      return;
    }
    setSaving(true);
    const result = await platformHomeService.assignAdminSubdomain(renameTarget.tenantId, value, renameReason || undefined);
    setSaving(false);
    if (!result.success) {
      setError(AVAILABILITY_MESSAGE[result.error ?? ''] ?? `Failed to update subdomain (${result.error ?? 'unknown'})`);
      return;
    }
    setRenameTarget(null);
    await fetchRows(search, page);
    await fetchSubdomainStats();
  };

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
  const renameValueChanged = !!renameTarget && renameValue.trim().toLowerCase() !== (renameTarget.subdomain ?? '');

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Subdomain Management"
        description="Monitor subdomain usage, adoption rates, and manage rate limiting settings"
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <CardTitle className="text-sm font-medium text-gray-900 dark:text-white">Subdomain Users</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="dark:bg-gray-800">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.tenantsWithSubdomains || 0}</div>
              <p className="text-xs text-muted-foreground dark:text-gray-400">With custom subdomains</p>
            </CardContent>
          </Card>

          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 dark:bg-gray-800">
              <CardTitle className="text-sm font-medium text-gray-900 dark:text-white">Adoption Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="dark:bg-gray-800">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.adoptionRate || 0}%</div>
              <p className="text-xs text-muted-foreground dark:text-gray-400">Of total tenants</p>
            </CardContent>
          </Card>

          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 dark:bg-gray-800">
              <CardTitle className="text-sm font-medium text-gray-900 dark:text-white">Recent Adoptions</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="dark:bg-gray-800">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.recentAdoptions || 0}</div>
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
                  Tenants with configured subdomains
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
                      <Badge variant="default">{new Date(item.createdAt).toLocaleDateString()}</Badge>
                      <Button variant="secondary" size="sm" onClick={() => openRename(item)}>
                        <Pencil className="w-3.5 h-3.5 mr-1.5" />
                        Rename
                      </Button>
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
                onClick={() => { fetchSubdomainStats(); fetchRows(search, page); }}
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
                  Values are configured in the backend; shown here for reference.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                  <h4 className="font-medium text-sm text-gray-900 dark:text-white">Subdomain Checks</h4>
                  <p className="text-sm text-neutral-500 dark:text-gray-400 mt-1">
                    {rateLimits?.subdomainCheck.maxRequests} requests per {Math.floor(rateLimits?.subdomainCheck.windowMs! / 1000 / 60)} minutes
                  </p>
                </div>
                <div className="p-4 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                  <h4 className="font-medium text-sm text-gray-900 dark:text-white">Subdomain Creation</h4>
                  <p className="text-sm text-neutral-500 dark:text-gray-400 mt-1">
                    {rateLimits?.subdomainCreate.maxRequests} requests per {Math.floor(rateLimits?.subdomainCreate.windowMs! / 1000 / 60 / 60)} hours
                  </p>
                </div>
                <div className="p-4 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                  <h4 className="font-medium text-sm text-gray-900 dark:text-white">Subdomain Resolution</h4>
                  <p className="text-sm text-neutral-500 dark:text-gray-400 mt-1">
                    {rateLimits?.subdomainResolve.maxRequests} requests per {Math.floor(rateLimits?.subdomainResolve.windowMs! / 1000 / 60)} minutes
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rename modal */}
      <Modal
        isOpen={!!renameTarget}
        onClose={() => setRenameTarget(null)}
        title="Rename subdomain"
        description={renameTarget ? `Tenant: ${renameTarget.tenantName ?? renameTarget.tenantId}` : undefined}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subdomain</label>
            <div className="flex items-center gap-2">
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="my-business"
                autoFocus
              />
              <span className="text-sm text-neutral-500 whitespace-nowrap">.{platformUrl}</span>
            </div>
            {renameValueChanged && (
              <p className="text-xs mt-1">
                {renameChecking ? (
                  <span className="text-neutral-500">Checking availability…</span>
                ) : renameAvailability ? (
                  renameAvailability.available ? (
                    <span className="text-green-600">Available</span>
                  ) : (
                    <span className="text-red-600">
                      {AVAILABILITY_MESSAGE[renameAvailability.reason ?? ''] ??
                        `Not available${renameAvailability.takenBy?.tenantName ? ` — taken by ${renameAvailability.takenBy.tenantName}` : ''}`}
                    </span>
                  )
                ) : null}
              </p>
            )}
          </div>

          {renameValueChanged && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-sm">
                Renaming changes this tenant's public URLs — the subdomain, the slug, and the directory
                listing all move together. Existing links to the old name will stop working.
              </AlertDescription>
            </Alert>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
            <Input value={renameReason} onChange={(e) => setRenameReason(e.target.value)} placeholder="e.g. rebrand request #1234" />
          </div>

          <ModalFooter>
            <Button variant="secondary" onClick={() => setRenameTarget(null)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={submitRename}
              disabled={saving || renameChecking || !renameValue.trim() || (!!renameAvailability && !renameAvailability.available)}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </ModalFooter>
        </div>
      </Modal>

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
