'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner } from '@/components/ui';
import { crmTenantCrmService } from '@/services/crm/CrmTenantCrmService';
import { toast } from '@/hooks/use-toast';
import TenantCrmPageShell from '@/components/crm/TenantCrmPageShell';
import type { CrmContact } from '@/types/crm';

export default function TenantContactsPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [selectedContact, setSelectedContact] = useState<CrmContact | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  async function handleCreateTicketForContact() {
    if (!newTitle.trim() || !selectedContact) return;
    setSubmitting(true);
    try {
      await crmTenantCrmService.createTicket({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        contact_id: selectedContact.id,
      });
      setShowNewTicket(false);
      setNewTitle('');
      setNewDescription('');
      setSelectedContact(null);
      toast({ title: 'Ticket Created', description: `Ticket created for ${selectedContact.first_name}`, variant: 'success' });
    } catch (err) {
      console.error('[Tenant Contacts] Create ticket error:', err);
      toast({ title: 'Error', description: 'Failed to create ticket', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  function openTicketModal(contact: CrmContact) {
    setSelectedContact(contact);
    setNewTitle('');
    setNewDescription('');
    setShowNewTicket(true);
  }

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
                <th className="text-right py-2 px-3 font-medium text-neutral-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                  <td className="py-2 px-3 font-medium">
                    <Link
                      href={`/t/${tenantId}/support/contacts/${c.id}`}
                      className="hover:text-amber-600 hover:underline transition-colors"
                    >
                      {c.first_name} {c.last_name || ''}
                    </Link>
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
                  <td className="py-2 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openTicketModal(c)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 dark:text-amber-300 dark:bg-amber-900/20 dark:hover:bg-amber-900/30 transition-colors"
                        title="Create ticket for this contact"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        Ticket
                      </button>
                      <Link
                        href={`/t/${tenantId}/support/contacts/${c.id}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-neutral-600 bg-neutral-50 hover:bg-neutral-100 dark:text-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 transition-colors"
                      >
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Ticket Modal */}
      {showNewTicket && selectedContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => { setShowNewTicket(false); setSelectedContact(null); }}>
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">New Ticket for {selectedContact.first_name}</h3>
            <p className="text-xs text-neutral-500 mb-4">
              {selectedContact.customer_id
                ? 'This contact is linked to a customer — they will see this ticket in their support inbox.'
                : 'This contact is not linked to a customer account.'}
            </p>
            <div className="space-y-3">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Subject"
                className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
                autoFocus
              />
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Describe the issue..."
                rows={3}
                className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
              />
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setShowNewTicket(false); setSelectedContact(null); }}
                  className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTicketForContact}
                  disabled={!newTitle.trim() || submitting}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Ticket'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </TenantCrmPageShell>
  );
}
