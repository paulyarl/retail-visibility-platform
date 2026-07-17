'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner, Input, Select } from '@/components/ui';
import { crmAdminService } from '@/services/crm/CrmAdminService';
import CrmPageShell from '@/components/crm/CrmPageShell';
import type { CrmTenantSummary } from '@/types/crm';
import { clientLogger } from '@/lib/client-logger';

const TIERS: Record<string, { label: string; color: string }> = {
  discovery: { label: 'Discovery', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300' },
  commitment: { label: 'Commitment', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300' },
  storefront: { label: 'Storefront', color: 'bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300' },
  starter: { label: 'Starter', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  professional: { label: 'Professional', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  enterprise: { label: 'Enterprise', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300' },
};

const STATUSES: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  trial: { label: 'Trial', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  past_due: { label: 'Past Due', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300' },
};

export default function CrmTenantsPage() {
  const [tenants, setTenants] = useState<CrmTenantSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const limit = 25;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const result = await crmAdminService.listTenants({
          q: search || undefined,
          tier: tierFilter || undefined,
          status: statusFilter || undefined,
          page,
          limit,
        });
        setTenants(result.data);
        setTotal(result.total);
      } catch (err) {
        clientLogger.error('[CRM Tenants] Load error:', { detail: err });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [search, tierFilter, statusFilter, page]);

  const totalPages = Math.ceil(total / limit);

  return (
    <CrmPageShell
      title="CRM Tenants"
      subtitle={`${total} tenants`}
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'CRM', href: '/settings/admin/crm' },
        { label: 'Tenants' },
      ]}
      actions={
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search tenants..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="min-w-[200px] rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <select
            value={tierFilter}
            onChange={(e) => { setTierFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
          >
            <option value="">All Tiers</option>
            {Object.entries(TIERS).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUSES).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      }
    >
      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : tenants.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-center text-neutral-500 py-8">No tenants found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-800">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Tier</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Open Tickets</th>
                <th className="text-left px-4 py-3 font-medium">Pending Tasks</th>
                <th className="text-left px-4 py-3 font-medium">Last Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {tenants.map((t) => {
                const tier = TIERS[t.subscription_tier] || { label: t.subscription_tier, color: 'bg-gray-100 text-gray-800' };
                const status = STATUSES[t.subscription_status] || { label: t.subscription_status, color: 'bg-gray-100 text-gray-800' };
                return (
                  <tr key={t.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                    <td className="px-4 py-3">
                      <Link href={`/settings/admin/crm/tenants/${t.id}`} className="font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400">
                        {t.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${tier.color}`}>{tier.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>{status.label}</span>
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{t.open_tickets ?? 0}</td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">{t.pending_tasks ?? 0}</td>
                    <td className="px-4 py-3 text-neutral-500 text-xs">{t.last_activity_at ? new Date(t.last_activity_at).toLocaleDateString() : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 rounded border border-neutral-200 dark:border-neutral-700 text-sm disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 rounded border border-neutral-200 dark:border-neutral-700 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </CrmPageShell>
  );
}
