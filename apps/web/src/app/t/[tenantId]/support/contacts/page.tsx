'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner } from '@/components/ui';
import { crmTenantCrmService } from '@/services/crm/CrmTenantCrmService';
import TenantCrmPageShell from '@/components/crm/TenantCrmPageShell';
import type { CrmContact } from '@/types/crm';

export default function TenantContactsPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await crmTenantCrmService.listContacts();
        setContacts(data ?? []);
      } catch (err) {
        console.error('[Tenant Contacts] Load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = contacts.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.first_name?.toLowerCase().includes(q) ||
      c.last_name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.role?.toLowerCase().includes(q)
    );
  });

  return (
    <TenantCrmPageShell
      tenantId={tenantId}
      title="Contacts"
      subtitle="People associated with this location"
      breadcrumbs={[
        { label: 'Dashboard', href: `/t/${tenantId}/dashboard` },
        { label: 'Support', href: `/t/${tenantId}/support` },
        { label: 'Contacts' },
      ]}
    >
      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search contacts..."
        className="w-full max-w-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
      />

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-neutral-500">{search ? 'No contacts match your search' : 'No contacts yet'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-700">
                <th className="text-left py-2 px-3 font-medium text-neutral-500">Name</th>
                <th className="text-left py-2 px-3 font-medium text-neutral-500">Email</th>
                <th className="text-left py-2 px-3 font-medium text-neutral-500">Phone</th>
                <th className="text-left py-2 px-3 font-medium text-neutral-500">Role</th>
                <th className="text-left py-2 px-3 font-medium text-neutral-500">Primary</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                  <td className="py-2 px-3 font-medium">
                    {c.first_name} {c.last_name || ''}
                  </td>
                  <td className="py-2 px-3 text-neutral-600 dark:text-neutral-400">{c.email}</td>
                  <td className="py-2 px-3 text-neutral-600 dark:text-neutral-400">{c.phone || '—'}</td>
                  <td className="py-2 px-3">
                    {c.role ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        {c.role}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-2 px-3">
                    {c.is_primary ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Primary</span>
                    ) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TenantCrmPageShell>
  );
}
