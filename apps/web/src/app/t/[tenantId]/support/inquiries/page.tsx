'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner } from '@/components/ui';
import { crmTenantCrmService } from '@/services/crm/CrmTenantCrmService';
import { tenantUserService, User } from '@/services/TenantUserService';
import TenantCrmPageShell from '@/components/crm/TenantCrmPageShell';
import type { CrmInquiry, CrmActivity } from '@/types/crm';
import { clientLogger } from '@/lib/client-logger';

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
  const [tenantUsers, setTenantUsers] = useState<User[]>([]);
  const [activities, setActivities] = useState<CrmActivity[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [data, users, activityList] = await Promise.all([
          crmTenantCrmService.listInquiries(
            statusFilter !== 'all' ? { status: statusFilter } : undefined
          ),
          tenantUserService.getTenantUsers(tenantId),
          crmTenantCrmService.listActivities({ limit: 100 }),
        ]);
        setInquiries(data ?? []);
        setTenantUsers(users ?? []);
        setActivities(activityList ?? []);
      } catch (err) {
        clientLogger.error('[Tenant Inquiries] Load error:', { detail: err });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [statusFilter, tenantId]);

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
          {inquiries.map(i => {
            const assignedName = i.assigned_to
              ? tenantUsers.find(u => u.id === i.assigned_to)?.name || i.assigned_to
              : null;
            const lastActivity = activities
              .filter(a => a.metadata?.inquiry_id === i.id || a.activity_type === 'inquiry_created')
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
            return (
              <Link
                key={i.id}
                href={`/t/${tenantId}/support/inquiries/${i.id}`}
                className="flex items-start justify-between p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{i.subject}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {i.sender_name || i.customer_id || i.contact_id || 'Anonymous'}
                    {i.sender_email ? ` · ${i.sender_email}` : ''}
                    {i.sender_phone ? ` · ${i.sender_phone}` : ''}
                    {' · '}
                    {new Date(i.created_at).toLocaleString()}
                    {assignedName ? ` · Assigned: ${assignedName}` : ''}
                  </p>
                  {lastActivity?.content && (
                    <p className="text-xs text-neutral-400 mt-1 truncate max-w-[90%]">
                      {lastActivity.content} · {new Date(lastActivity.created_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[i.status] || 'bg-gray-100 text-gray-800'}`}>
                    {i.status?.replace('_', ' ')}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </TenantCrmPageShell>
  );
}
