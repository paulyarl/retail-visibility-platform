'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner } from '@/components/ui';
import { crmTenantCrmService } from '@/services/crm/CrmTenantCrmService';
import TenantCrmPageShell from '@/components/crm/TenantCrmPageShell';
import type { CrmInquiry } from '@/types/crm';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-amber-100 text-amber-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
};

export default function TenantInquiriesPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const [inquiries, setInquiries] = useState<CrmInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    async function load() {
      try {
        const data = await crmTenantCrmService.listInquiries(
          statusFilter !== 'all' ? { status: statusFilter } : undefined
        );
        setInquiries(data ?? []);
      } catch (err) {
        console.error('[Tenant Inquiries] Load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [statusFilter]);

  return (
    <TenantCrmPageShell
      tenantId={tenantId}
      title="Inquiries"
      subtitle="Customer questions and requests"
      breadcrumbs={[
        { label: 'Dashboard', href: `/t/${tenantId}/dashboard` },
        { label: 'Support', href: `/t/${tenantId}/support` },
        { label: 'Inquiries' },
      ]}
      navCounts={{ inquiries: inquiries.length }}
    >
      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'open', 'in_progress', 'resolved', 'closed'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-amber-500 text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200'
            }`}
          >
            {s === 'all' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : inquiries.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-neutral-500">No inquiries found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {inquiries.map(i => (
            <Link
              key={i.id}
              href={`/t/${tenantId}/support/inquiries/${i.id}`}
              className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{i.subject}</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {i.contact_id || i.customer_id || 'Anonymous'} · {new Date(i.created_at).toLocaleDateString()}
                </p>
                {i.body && (
                  <p className="text-xs text-neutral-400 mt-1 line-clamp-2">{i.body}</p>
                )}
              </div>
              <div className="flex items-center gap-2 ml-3">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[i.status] || 'bg-gray-100 text-gray-800'}`}>
                  {i.status?.replace('_', ' ')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </TenantCrmPageShell>
  );
}
