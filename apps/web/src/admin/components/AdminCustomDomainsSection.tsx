/**
 * AdminCustomDomainsSection
 *
 * Custom-domain ops console — the admin counterpart of Active Subdomains.
 * Surfaces the capability-gated write path (the `custom_domains` rollout
 * flag is deprecated and no longer consulted) and gives operators the full
 * mini-workflow in one place:
 *
 *   pick tenant → entitlement card → [Grant via BSaaS]
 *   → attach domain → watch pending_verification → force check → active
 *
 * Backed by /api/admin/custom-domains (requirePlatformAdmin) and the tenant
 * owner-equivalent /api/admin/tenant-flags proxy. All mutations audited
 * server-side with actor + reason.
 */
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  platformHomeService,
  type AdminCustomDomainRow,
  type AdminTenantDomainDetail,
} from '@/services/PlatformHomeSingletonService';
import { adminOperationsService } from '@/services/AdminOperationsService';
import ComplimentaryAccessForm from '@/admin/components/ComplimentaryAccessForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Modal, ModalFooter } from '@/components/ui';
import { Badge } from '@/components/ui/Badge';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { clientLogger } from '@/lib/client-logger';
import {
  Search,
  RefreshCw,
  ArrowUpRight,
  ExternalLink,
  Trash2,
  Plus,
  Gift,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';

const PAGE_SIZE = 20;
const CUSTOM_DOMAIN_FEATURE_KEY = 'storefront_domains_custom_domain';

const STATUS_BADGE: Record<string, { variant: 'success' | 'info' | 'warning' | 'error' | 'secondary'; label: string }> = {
  active: { variant: 'success', label: 'Active' },
  verified: { variant: 'info', label: 'Verified' },
  pending_verification: { variant: 'warning', label: 'Pending' },
  error: { variant: 'error', label: 'Error' },
  disabled: { variant: 'secondary', label: 'Disabled' },
};

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending_verification', label: 'Pending' },
  { value: 'verified', label: 'Verified' },
  { value: 'active', label: 'Active' },
  { value: 'error', label: 'Error' },
  { value: 'disabled', label: 'Disabled' },
];

const ATTACH_ERROR_MESSAGE: Record<string, string> = {
  not_entitled: 'Not entitled — grant the capability (BSaaS) first.',
  domain_taken: 'That domain is already attached to another tenant.',
  domain_limit: 'This tenant already has the maximum number of custom domains.',
  invalid_domain: 'Invalid domain format.',
  non_dns_host: 'Local/internal hosts cannot be attached.',
  platform_domain: 'Platform domains cannot be attached as custom domains.',
  unconfigured: 'Vercel domains integration is not configured on the API.',
  vercel_error: 'Vercel rejected the domain attach — check the domain is not on another project.',
};

function StatusBadge({ status }: { status: string }) {
  const conf = STATUS_BADGE[status] ?? { variant: 'secondary' as const, label: status };
  return <Badge variant={conf.variant}>{conf.label}</Badge>;
}

/**
 * Count shown on a status chip. "All" is the sum across statuses; a status the
 * server didn't report returns undefined so the chip renders without a number —
 * never a misleading 0, and null (not yet loaded) shows nothing at all.
 */
export function statusChipCount(
  filterValue: string,
  statusCounts: Record<string, number> | null | undefined,
): number | undefined {
  if (!statusCounts) return undefined;
  if (filterValue === '') return Object.values(statusCounts).reduce((sum, n) => sum + n, 0);
  return statusCounts[filterValue];
}

export default function AdminCustomDomainsSection() {
  // List state
  const [rows, setRows] = useState<AdminCustomDomainRow[]>([]);
  const [total, setTotal] = useState(0);
  // null until the first list response lands — avoids flashing "0" per chip.
  const [statusCounts, setStatusCounts] = useState<Record<string, number> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  // Remove modal
  const [removeTarget, setRemoveTarget] = useState<AdminCustomDomainRow | null>(null);
  const [removeReason, setRemoveReason] = useState('');
  const [removing, setRemoving] = useState(false);

  // Attach modal
  const [attachOpen, setAttachOpen] = useState(false);
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
  const [attachTenantId, setAttachTenantId] = useState('');
  const [attachDomain, setAttachDomain] = useState('');
  const [attachApex, setAttachApex] = useState(false);
  const [attachReason, setAttachReason] = useState('');
  const [attachSaving, setAttachSaving] = useState(false);
  const [attachError, setAttachError] = useState('');
  const [tenantDetail, setTenantDetail] = useState<AdminTenantDomainDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Mini-workflows
  const [grantOpen, setGrantOpen] = useState(false);

  const fetchRows = useCallback(async (nextSearch: string, nextStatus: string, nextPage: number) => {
    setListLoading(true);
    try {
      const result = await platformHomeService.getAdminCustomDomains({
        search: nextSearch || undefined,
        status: nextStatus || undefined,
        page: nextPage,
        limit: PAGE_SIZE,
      });
      if (!result) {
        setError('Failed to load custom domains');
        return;
      }
      setRows(result.data);
      setTotal(result.total);
      // Counts per status (respecting the current search, not the status
      // filter) so the chips show how much is pending / errored.
      setStatusCounts(result.statusCounts ?? null);
    } catch (err) {
      clientLogger.error('Failed to fetch admin custom domains:', { detail: err });
      setError('Failed to load custom domains');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRows('', '', 1);
  }, [fetchRows]);

  // Debounced search + status filter
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      fetchRows(search, status, 1);
    }, 350);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search, status, fetchRows]);

  // Tenant detail (entitlement card) when a tenant is picked in the attach modal
  useEffect(() => {
    if (!attachOpen || !attachTenantId) {
      setTenantDetail(null);
      return;
    }
    setDetailLoading(true);
    platformHomeService
      .getAdminTenantDomains(attachTenantId)
      .then(setTenantDetail)
      .catch(() => setTenantDetail(null))
      .finally(() => setDetailLoading(false));
  }, [attachOpen, attachTenantId]);

  const openAttach = () => {
    setAttachOpen(true);
    setAttachTenantId('');
    setAttachDomain('');
    setAttachApex(false);
    setAttachReason('');
    setAttachError('');
    setTenantDetail(null);
    adminOperationsService.getTenants(1, 500)
      .then((result) => setTenants(result.tenants.map((t) => ({ id: t.id, name: t.name }))))
      .catch(() => {});
  };

  const refreshTenantDetail = async () => {
    if (!attachTenantId) return;
    setDetailLoading(true);
    try {
      // Post-grant refetch must not see the 30s cache
      await platformHomeService.invalidateCache('platform-admin-custom-domains*');
      const detail = await platformHomeService.getAdminTenantDomains(attachTenantId);
      setTenantDetail(detail);
    } finally {
      setDetailLoading(false);
    }
  };

  const submitAttach = async () => {
    const domain = attachDomain.trim().toLowerCase();
    if (!attachTenantId || !domain) {
      setAttachError('Select a tenant and enter a domain');
      return;
    }
    setAttachSaving(true);
    setAttachError('');
    const result = await platformHomeService.attachAdminCustomDomain(attachTenantId, domain, {
      apex: attachApex || undefined,
      reason: attachReason || undefined,
    });
    setAttachSaving(false);
    if (!result.success) {
      setAttachError(result.message || ATTACH_ERROR_MESSAGE[result.error ?? ''] || `Failed to attach (${result.error ?? 'unknown'})`);
      return;
    }
    setAttachOpen(false);
    await fetchRows(search, status, page);
  };

  const forceCheck = async (row: AdminCustomDomainRow) => {
    setCheckingId(row.id);
    const result = await platformHomeService.checkAdminCustomDomain(row.tenantId, row.id);
    setCheckingId(null);
    if (!result.success) {
      setError(result.message || `Check failed (${result.error ?? 'unknown'})`);
      return;
    }
    setError('');
    await fetchRows(search, status, page);
  };

  const submitRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    const result = await platformHomeService.removeAdminCustomDomain(removeTarget.tenantId, removeTarget.id, removeReason || undefined);
    setRemoving(false);
    if (!result.success) {
      setError(result.message || `Failed to remove (${result.error ?? 'unknown'})`);
      return;
    }
    setRemoveTarget(null);
    setRemoveReason('');
    setError('');
    await fetchRows(search, status, page);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const tenantOptions = tenants.map((t) => ({ value: t.id, label: `${t.name} (${t.id})` }));

  return (
    <>
      <Card className="dark:bg-gray-800 dark:border-gray-700">
        <CardHeader className="dark:bg-gray-800">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-gray-900 dark:text-white">Custom Domains</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-300">
                Tenant-owned domains — support, verification, and DFY attach
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <Input
                  aria-label="Search custom domains"
                  placeholder="Search domain or tenant…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="secondary" size="sm" onClick={openAttach}>
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Attach Domain
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-3">
            {STATUS_FILTERS.map((f) => {
              const count = statusChipCount(f.value, statusCounts);
              return (
                <button
                  key={f.value}
                  onClick={() => setStatus(f.value)}
                  aria-label={count == null ? f.label : `${f.label}, ${count}`}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    status === f.value
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                      : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 dark:border-neutral-700 dark:text-neutral-400'
                  }`}
                >
                  {f.label}
                  {count != null && <span className="ml-1 opacity-70">{count}</span>}
                </button>
              );
            })}
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
              {search || status ? 'No custom domains match.' : 'No custom domains configured yet'}
            </p>
          ) : (
            <div className="space-y-2">
              {rows.map((item) => (
                <div key={item.id} className="p-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <StatusBadge status={item.status} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <a
                            href={`https://${item.domain}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 inline-flex items-center gap-1"
                          >
                            <span className="truncate">{item.domain}</span>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          </a>
                        </div>
                        <p className="text-sm text-neutral-500 dark:text-gray-400 truncate">
                          <Link
                            href={`/t/${item.tenantId}/settings/subdomain`}
                            className="hover:text-indigo-600 dark:hover:text-indigo-400"
                          >
                            {item.tenantName ?? item.tenantId}
                          </Link>
                          {item.tenantSubdomain ? ` · ${item.tenantSubdomain}` : ''}
                          {item.attachedHosts.length > 0 ? ` · ${item.attachedHosts.join(', ')}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.verificationCheckedAt && (
                        <span className="text-xs text-neutral-400" title="Last verification check">
                          {new Date(item.verificationCheckedAt).toLocaleDateString()}
                        </span>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => forceCheck(item)}
                        disabled={checkingId === item.id}
                        title="Force verification check"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${checkingId === item.id ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setRemoveTarget(item)}>
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        title="Domain detail"
                      >
                        {expandedId === item.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>

                  {expandedId === item.id && (
                    <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      <div>
                        <span className="text-neutral-500 dark:text-gray-400">Status:</span>{' '}
                        <span className="font-medium">{item.status}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 dark:text-gray-400">Primary:</span>{' '}
                        <span className="font-medium">{item.isPrimary ? 'yes' : 'no'}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 dark:text-gray-400">Attached hosts:</span>{' '}
                        <span className="font-mono text-xs">{item.attachedHosts.join(', ') || '—'}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 dark:text-gray-400">Certificate:</span>{' '}
                        <span className="font-medium">{item.certificateStatus ?? '—'}</span>
                      </div>
                      {item.verificationError && (
                        <div className="sm:col-span-2">
                          <span className="text-neutral-500 dark:text-gray-400">Verification error:</span>{' '}
                          <span className="text-red-600 dark:text-red-400">{item.verificationError}</span>
                        </div>
                      )}
                      {item.certificateError && (
                        <div className="sm:col-span-2">
                          <span className="text-neutral-500 dark:text-gray-400">Certificate error:</span>{' '}
                          <span className="text-red-600 dark:text-red-400">{item.certificateError}</span>
                        </div>
                      )}
                      {item.verificationToken && (
                        <div className="sm:col-span-2">
                          <span className="text-neutral-500 dark:text-gray-400">TXT token:</span>{' '}
                          <span className="font-mono text-xs break-all">{item.verificationToken}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-neutral-500 dark:text-gray-400">Created:</span>{' '}
                        <span>{item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 dark:text-gray-400">Checked:</span>{' '}
                        <span>{item.verificationCheckedAt ? new Date(item.verificationCheckedAt).toLocaleString() : 'never'}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-3">
                  <p className="text-sm text-neutral-500 dark:text-gray-400">
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); fetchRows(search, status, p); }}>
                      Previous
                    </Button>
                    <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); fetchRows(search, status, p); }}>
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attach modal — DFY path with entitlement card + grant/flag workflows */}
      <Modal
        isOpen={attachOpen}
        onClose={() => setAttachOpen(false)}
        title="Attach Custom Domain"
        description="Operator attach (DFY) — capability gate applies"
      >
        <div className="space-y-4">
          {attachError && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
              {attachError}
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-1 block">Tenant *</label>
            <SearchableSelect
              options={tenantOptions}
              value={attachTenantId}
              onChange={setAttachTenantId}
              placeholder="Select a tenant…"
            />
          </div>

          {attachTenantId && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 space-y-2">
              {detailLoading ? (
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking entitlement…
                </div>
              ) : tenantDetail ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {tenantDetail.entitlement.entitled ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className="text-sm">
                        Capability <code className="text-xs">{CUSTOM_DOMAIN_FEATURE_KEY}</code>
                        {tenantDetail.entitlement.entitled ? ' — entitled' : ' — not entitled'}
                      </span>
                    </div>
                    {!tenantDetail.entitlement.entitled && (
                      <Button variant="secondary" size="sm" onClick={() => setGrantOpen(true)}>
                        <Gift className="w-3.5 h-3.5 mr-1.5" />
                        Grant via BSaaS
                      </Button>
                    )}
                  </div>
                  {tenantDetail.domains.length > 0 && (
                    <div className="pt-1 text-xs text-neutral-500 dark:text-gray-400">
                      Existing domains: {tenantDetail.domains.map((d) => d.domain).join(', ')}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-neutral-500">Could not load entitlement for this tenant.</p>
              )}
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-1 block">Domain *</label>
            <Input
              placeholder="shop.example.com or example.com"
              value={attachDomain}
              onChange={(e) => setAttachDomain(e.target.value)}
            />
            <p className="text-xs text-neutral-400 mt-1">Scheme, path and www. are stripped automatically</p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={attachApex}
              onChange={(e) => setAttachApex(e.target.checked)}
              className="rounded border-neutral-300"
            />
            Apex/root domain — attach apex + www
          </label>

          <div>
            <label className="text-sm font-medium mb-1 block">Reason</label>
            <Input
              placeholder="e.g. DFY onboarding for pilot tenant"
              value={attachReason}
              onChange={(e) => setAttachReason(e.target.value)}
            />
          </div>
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setAttachOpen(false)}>Cancel</Button>
          <Button onClick={submitAttach} disabled={attachSaving || !attachTenantId || !attachDomain.trim()}>
            {attachSaving ? 'Attaching…' : 'Attach Domain'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Remove modal */}
      <Modal
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title="Remove Custom Domain"
        description={removeTarget ? `Detaches Vercel hosts and deletes ${removeTarget.domain}` : undefined}
      >
        <div className="space-y-3">
          <p className="text-sm text-neutral-600 dark:text-gray-300">
            The domain will stop resolving to this tenant's storefront immediately. This cannot be undone.
          </p>
          <div>
            <label className="text-sm font-medium mb-1 block">Reason</label>
            <Input
              placeholder="e.g. Tenant request, domain released"
              value={removeReason}
              onChange={(e) => setRemoveReason(e.target.value)}
            />
          </div>
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setRemoveTarget(null)}>Cancel</Button>
          <Button variant="secondary" onClick={submitRemove} disabled={removing}>
            <Trash2 className="w-3.5 h-3.5 mr-1.5 text-red-600" />
            {removing ? 'Removing…' : 'Remove'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* BSaaS comp grant — prefilled with tenant + custom-domain SKU */}
      <ComplimentaryAccessForm
        open={grantOpen}
        onOpenChange={setGrantOpen}
        onSuccess={refreshTenantDetail}
        initialTenantId={attachTenantId}
        initialFeatureKey={CUSTOM_DOMAIN_FEATURE_KEY}
      />
    </>
  );
}
