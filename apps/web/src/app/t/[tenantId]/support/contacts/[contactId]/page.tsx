'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, Spinner } from '@/components/ui';
import { crmTenantCrmService } from '@/services/crm/CrmTenantCrmService';
import { toast } from '@/hooks/use-toast';
import TenantCrmPageShell from '@/components/crm/TenantCrmPageShell';
import type { CrmContactDetail, CrmTicket, CrmTask, CrmInquiry } from '@/types/crm';
import { clientLogger } from '@/lib/client-logger';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-amber-100 text-amber-800',
  waiting: 'bg-yellow-100 text-yellow-800',
  pending: 'bg-amber-100 text-amber-800',
  resolved: 'bg-green-100 text-green-800',
  completed: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'text-red-600',
  high: 'text-orange-500',
  medium: 'text-amber-500',
  low: 'text-neutral-400',
};

export default function ContactDetailPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const contactId = params.contactId as string;

  const [contact, setContact] = useState<CrmContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await crmTenantCrmService.getContactDetail(contactId);
        setContact(data);
      } catch (err) {
        clientLogger.error('[Contact Detail] Load error:', { detail: err });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [contactId]);

  async function handleCreateTicket() {
    if (!newTitle.trim()) return;
    setSubmitting(true);
    try {
      await crmTenantCrmService.createTicket({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        contact_id: contactId,
      });
      setShowNewTicket(false);
      setNewTitle('');
      setNewDescription('');
      // Reload contact to show new ticket
      const data = await crmTenantCrmService.getContactDetail(contactId);
      setContact(data);
      toast({ title: 'Ticket Created', description: `Ticket created for ${contact?.first_name}`, variant: 'success' });
    } catch (err) {
      clientLogger.error('[Contact Detail] Create ticket error:', { detail: err });
      toast({ title: 'Error', description: 'Failed to create ticket', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!contact) {
    return (
      <TenantCrmPageShell
        tenantId={tenantId}
        title="Contact Not Found"
        breadcrumbs={[
          { label: 'Dashboard', href: `/t/${tenantId}/dashboard` },
          { label: 'Support', href: `/t/${tenantId}/support` },
          { label: 'Contacts', href: `/t/${tenantId}/support/contacts` },
          { label: 'Not Found' },
        ]}
      >
        <div className="text-center py-12">
          <p className="text-neutral-500">Contact not found</p>
          <Link href={`/t/${tenantId}/support/contacts`} className="text-amber-600 hover:underline text-sm mt-2 inline-block">
            Back to Contacts
          </Link>
        </div>
      </TenantCrmPageShell>
    );
  }

  const tickets = contact.crm_support_tickets ?? [];
  const tasks = contact.crm_tasks ?? [];
  const inquiries = contact.crm_inquiries ?? [];
  const linkedCustomer = contact.customers;

  return (
    <TenantCrmPageShell
      tenantId={tenantId}
      title={`${contact.first_name} ${contact.last_name || ''}`}
      breadcrumbs={[
        { label: 'Dashboard', href: `/t/${tenantId}/dashboard` },
        { label: 'Support', href: `/t/${tenantId}/support` },
        { label: 'Contacts', href: `/t/${tenantId}/support/contacts` },
        { label: contact.first_name },
      ]}
    >
      {/* Contact Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Contact Information</CardTitle>
            <button
              onClick={() => setShowNewTicket(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-sm hover:shadow-md transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New Ticket
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-neutral-500 mb-1">Email</p>
              <p className="text-sm font-medium">{contact.email}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 mb-1">Phone</p>
              <p className="text-sm font-medium">{contact.phone || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500 mb-1">Role</p>
              {contact.role ? (
                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                  {contact.role}
                </span>
              ) : <p className="text-sm text-neutral-400">—</p>}
            </div>
            <div>
              <p className="text-xs text-neutral-500 mb-1">Primary</p>
              {contact.is_primary ? (
                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Primary</span>
              ) : <p className="text-sm text-neutral-400">No</p>}
            </div>
            {linkedCustomer && (
              <div className="sm:col-span-2">
                <p className="text-xs text-neutral-500 mb-1">Linked Customer</p>
                <p className="text-sm font-medium">
                  {linkedCustomer.first_name || ''} {linkedCustomer.last_name || ''} <span className="text-neutral-400">({linkedCustomer.email})</span>
                </p>
                <p className="text-xs text-green-600 mt-0.5">Tickets created for this contact will appear in their support inbox</p>
              </div>
            )}
            {contact.notes && (
              <div className="sm:col-span-2">
                <p className="text-xs text-neutral-500 mb-1">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tickets */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            Tickets <span className="text-neutral-400 font-normal">({tickets.length})</span>
          </h3>
        </div>
        {tickets.length === 0 ? (
          <p className="text-sm text-neutral-400 text-center py-4">No tickets for this contact</p>
        ) : (
          tickets.map((t: CrmTicket) => (
            <Link
              key={t.id}
              href={`/t/${tenantId}/support/tickets/${t.id}`}
              className="flex items-center justify-between py-2 px-3 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.priority === 'urgent' ? 'bg-red-500' : t.priority === 'high' ? 'bg-orange-400' : 'bg-blue-400'}`} />
                <p className="text-sm truncate">{t.title}</p>
              </div>
              <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-800'}`}>
                  {t.status?.replace('_', ' ')}
                </span>
                <span className="text-xs text-neutral-400">{new Date(t.created_at).toLocaleDateString()}</span>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Tasks */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          Tasks <span className="text-neutral-400 font-normal">({tasks.length})</span>
        </h3>
        {tasks.length === 0 ? (
          <p className="text-sm text-neutral-400 text-center py-4">No tasks for this contact</p>
        ) : (
          tasks.map((t: CrmTask) => {
            const isOverdue = t.due_date && new Date(t.due_date) < new Date();
            return (
              <div
                key={t.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg border border-neutral-200 dark:border-neutral-700"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOverdue ? 'bg-red-500' : t.priority === 'high' ? 'bg-orange-400' : 'bg-amber-400'}`} />
                  <p className="text-sm truncate">{t.title}</p>
                </div>
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[t.status] || 'bg-gray-100 text-gray-800'}`}>
                    {t.status?.replace('_', ' ')}
                  </span>
                  {t.due_date && (
                    <span className={`text-[10px] ${isOverdue ? 'text-red-600 font-semibold' : 'text-neutral-400'}`}>
                      {isOverdue ? 'Overdue' : new Date(t.due_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Inquiries */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          Inquiries <span className="text-neutral-400 font-normal">({inquiries.length})</span>
        </h3>
        {inquiries.length === 0 ? (
          <p className="text-sm text-neutral-400 text-center py-4">No inquiries for this contact</p>
        ) : (
          inquiries.map((i: CrmInquiry) => (
            <div
              key={i.id}
              className="flex items-center justify-between py-2 px-3 rounded-lg border border-neutral-200 dark:border-neutral-700"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-purple-400" />
                <p className="text-sm truncate">{i.subject}</p>
              </div>
              <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[i.status] || 'bg-gray-100 text-gray-800'}`}>
                  {i.status?.replace('_', ' ')}
                </span>
                <span className="text-xs text-neutral-400">{new Date(i.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Ticket Modal */}
      {showNewTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowNewTicket(false)}>
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">New Ticket for {contact.first_name}</h3>
            <p className="text-xs text-neutral-500 mb-4">
              {linkedCustomer
                ? 'This ticket will appear in the customer\'s support inbox.'
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
                  onClick={() => setShowNewTicket(false)}
                  className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTicket}
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
