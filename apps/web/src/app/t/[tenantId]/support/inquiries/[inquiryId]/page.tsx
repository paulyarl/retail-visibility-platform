'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, Spinner } from '@/components/ui';
import { crmTenantCrmService } from '@/services/crm/CrmTenantCrmService';
import { faqService } from '@/services/FaqService';
import { tenantUserService, User } from '@/services/TenantUserService';
import { useAuth } from '@/contexts/AuthContext';
import { useFaqOptionsCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import TenantCrmPageShell from '@/components/crm/TenantCrmPageShell';
import type { CrmInquiry, InquiryStatus, InquiryPriority } from '@/types/crm';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-amber-100 text-amber-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
};

const STATUS_OPTIONS: InquiryStatus[] = ['open', 'in_progress', 'resolved', 'closed'];
const PRIORITY_OPTIONS: InquiryPriority[] = ['low', 'medium', 'high', 'urgent'];

export default function TenantInquiryDetailPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const inquiryId = params.inquiryId as string;

  const [inquiry, setInquiry] = useState<CrmInquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [tenantUsers, setTenantUsers] = useState<User[]>([]);
  const { user } = useAuth();
  const [creatingFaq, setCreatingFaq] = useState(false);
  const [faqCreated, setFaqCreated] = useState(false);
  const [faqError, setFaqError] = useState<string | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [ticketCreated, setTicketCreated] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [createdTicketId, setCreatedTicketId] = useState<string | null>(null);
  const isClosed = inquiry?.status === 'closed';

  // Check FAQ KB capability for inquiry-to-FAQ feature
  const faqCap = useFaqOptionsCapability(tenantId, { forTenant: true });
  const [merchantGateEnabled, setMerchantGateEnabled] = useState(false);

  useEffect(() => {
    if (!tenantId || !faqCap.data?.kbEnabled) return;
    faqService.getOptions(tenantId)
      .then(({ settings }) => setMerchantGateEnabled(!!settings.faq_kb_auto_sync))
      .catch(() => setMerchantGateEnabled(false));
  }, [tenantId, faqCap.data?.kbEnabled]);

  const tierAllowsFaqSync = faqCap.data?.kbEnabled && faqCap.data?.allowedKbTypes?.includes('faq_kb_auto_sync');
  const canCreateFaq = tierAllowsFaqSync && merchantGateEnabled;

  useEffect(() => {
    async function load() {
      try {
        const [data, users, activityList] = await Promise.all([
          crmTenantCrmService.listInquiries(),
          tenantUserService.getTenantUsers(tenantId),
          crmTenantCrmService.listActivities({ limit: 50 }),
        ]);
        const found = (data ?? []).find((i: CrmInquiry) => i.id === inquiryId) ?? null;
        setInquiry(found);
        setTenantUsers(users ?? []);
        // Filter activities related to this inquiry (via metadata or inquiry creation)
        const related = (activityList ?? []).filter((a: any) =>
          a.metadata?.inquiry_id === inquiryId ||
          a.activity_type === 'inquiry_created'
        );
        setActivities(related);
      } catch (err) {
        console.error('[Tenant Inquiry Detail] Load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [inquiryId, tenantId]);

  async function refreshActivities() {
    try {
      const activityList = await crmTenantCrmService.listActivities({ limit: 50 });
      const related = (activityList ?? []).filter((a: any) =>
        a.metadata?.inquiry_id === inquiryId ||
        a.activity_type === 'inquiry_created'
      );
      setActivities(related);
    } catch (err) {
      console.error('[Tenant Inquiry Detail] Activity refresh error:', err);
    }
  }

  async function handleStatusChange(newStatus: InquiryStatus) {
    if (!inquiry) return;
    if (newStatus === 'closed') {
      const confirmed = window.confirm(
        'Are you sure you want to close this inquiry?\n\nThis action is final. Once closed, you will not be able to change status, priority, or assignment.'
      );
      if (!confirmed) return;
    }
    setUpdating(true);
    setShowStatusDropdown(false);
    try {
      const updated = await crmTenantCrmService.updateInquiry(inquiryId, { status: newStatus });
      setInquiry(updated);
      await refreshActivities();
    } catch (err) {
      console.error('[Tenant Inquiry Detail] Status change error:', err);
    } finally {
      setUpdating(false);
    }
  }

  async function handlePriorityChange(newPriority: InquiryPriority) {
    if (!inquiry) return;
    setUpdating(true);
    setShowPriorityDropdown(false);
    try {
      const updated = await crmTenantCrmService.updateInquiry(inquiryId, { priority: newPriority });
      setInquiry(updated);
      await refreshActivities();
    } catch (err) {
      console.error('[Tenant Inquiry Detail] Priority change error:', err);
    } finally {
      setUpdating(false);
    }
  }

  async function handleAssignChange(userId: string | null) {
    if (!inquiry) return;
    setUpdating(true);
    setShowAssignDropdown(false);
    try {
      const updated = await crmTenantCrmService.updateInquiry(inquiryId, { assigned_to: userId ?? undefined });
      setInquiry(updated);
      await refreshActivities();
    } catch (err) {
      console.error('[Tenant Inquiry Detail] Assign change error:', err);
    } finally {
      setUpdating(false);
    }
  }

  async function handleCreateFaq() {
    if (!inquiry) return;
    setCreatingFaq(true);
    setFaqCreated(false);
    setFaqError(null);
    try {
      await crmTenantCrmService.createFaqFromInquiry(inquiryId);
      setFaqCreated(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to create FAQ from inquiry';
      setFaqError(msg);
    } finally {
      setCreatingFaq(false);
    }
  }

  async function handleCreateTicketFromInquiry() {
    if (!inquiry) return;
    setCreatingTicket(true);
    setTicketCreated(false);
    setTicketError(null);
    setCreatedTicketId(null);
    try {
      const ticket = await crmTenantCrmService.createTicketFromInquiry(inquiryId);
      setTicketCreated(true);
      setCreatedTicketId(ticket.id);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to create ticket from inquiry';
      setTicketError(msg);
    } finally {
      setCreatingTicket(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!inquiry) {
    return (
      <TenantCrmPageShell
        tenantId={tenantId}
        title="Inquiry Not Found"
        breadcrumbs={[
          { label: 'Dashboard', href: `/t/${tenantId}/dashboard` },
          { label: 'Support', href: `/t/${tenantId}/support` },
          { label: 'Inquiries', href: `/t/${tenantId}/support/inquiries` },
          { label: 'Not Found' },
        ]}
      >
        <div className="text-center py-12">
          <p className="text-neutral-500">Inquiry not found</p>
          <Link href={`/t/${tenantId}/support/inquiries`} className="text-amber-600 hover:underline text-sm mt-2 inline-block">
            Back to Inquiries
          </Link>
        </div>
      </TenantCrmPageShell>
    );
  }

  return (
    <TenantCrmPageShell
      tenantId={tenantId}
      title={inquiry.subject}
      breadcrumbs={[
        { label: 'Dashboard', href: `/t/${tenantId}/dashboard` },
        { label: 'Support', href: `/t/${tenantId}/support` },
        { label: 'Inquiries', href: `/t/${tenantId}/support/inquiries` },
        { label: inquiry.id },
      ]}
    >
      {/* Inquiry header with actions */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{inquiry.subject}</h2>
          <p className="text-sm text-neutral-500 mt-1">
            {inquiry.sender_name || 'Anonymous'}
            {inquiry.sender_email ? ` · ${inquiry.sender_email}` : ''}
            {inquiry.sender_phone ? ` · ${inquiry.sender_phone}` : ''}
            {' · Source: '}{inquiry.source || 'N/A'}
            {' · '}{new Date(inquiry.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status dropdown */}
          <div className="relative">
            <button
              onClick={() => { if (isClosed) return; setShowStatusDropdown(!showStatusDropdown); setShowPriorityDropdown(false); setShowAssignDropdown(false); }}
              disabled={updating || isClosed}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${STATUS_COLORS[inquiry.status] || 'bg-gray-100 text-gray-800'} hover:opacity-80 transition-opacity ${isClosed ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {inquiry.status?.replace('_', ' ')}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showStatusDropdown && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg py-1 min-w-[140px]">
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 ${s === inquiry.status ? 'font-semibold' : ''}`}
                  >
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Priority dropdown */}
          <div className="relative">
            <button
              onClick={() => { if (isClosed) return; setShowPriorityDropdown(!showPriorityDropdown); setShowStatusDropdown(false); setShowAssignDropdown(false); }}
              disabled={updating || isClosed}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:opacity-80 transition-opacity ${isClosed ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {inquiry.priority || 'No priority'}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showPriorityDropdown && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg py-1 min-w-[140px]">
                {PRIORITY_OPTIONS.map(p => (
                  <button
                    key={p}
                    onClick={() => handlePriorityChange(p)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 ${p === inquiry.priority ? 'font-semibold' : ''}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Assign dropdown */}
          {tenantUsers.length > 0 && (
            <div className="relative">
              <button
                onClick={() => { if (isClosed) return; setShowAssignDropdown(!showAssignDropdown); setShowStatusDropdown(false); setShowPriorityDropdown(false); }}
                disabled={updating || isClosed}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:opacity-80 transition-opacity ${isClosed ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {inquiry.assigned_to ? tenantUsers.find(u => u.id === inquiry.assigned_to)?.name || 'Assigned' : 'Assign'}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showAssignDropdown && (
                <div className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg py-1 min-w-[180px] max-h-48 overflow-y-auto">
                  <button
                    onClick={() => handleAssignChange(null)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 ${!inquiry.assigned_to ? 'font-semibold' : ''}`}
                  >
                    Unassigned
                  </button>
                  {tenantUsers.map(u => (
                    <button
                      key={u.id}
                      onClick={() => handleAssignChange(u.id)}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 ${u.id === inquiry.assigned_to ? 'font-semibold' : ''}`}
                    >
                      {u.name || u.email}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* Create Ticket from inquiry */}
          <button
            onClick={handleCreateTicketFromInquiry}
            disabled={creatingTicket}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50 transition-colors disabled:opacity-50"
            title="Promote this inquiry to a tracked support ticket"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
            {creatingTicket ? 'Creating...' : 'Create Ticket'}
          </button>

          {/* Create FAQ from inquiry (tier-gated) */}
          {canCreateFaq && (
            <button
              onClick={handleCreateFaq}
              disabled={creatingFaq}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:hover:bg-violet-900/50 transition-colors disabled:opacity-50"
              title="Create a draft FAQ from this inquiry"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              {creatingFaq ? 'Creating...' : 'Create FAQ'}
            </button>
          )}
          {!canCreateFaq && !faqCap.loading && (
            <span
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] text-neutral-400 border border-dashed border-neutral-300 dark:border-neutral-600 cursor-default"
              title={tierAllowsFaqSync ? 'Enable "Inquiry-to-FAQ Curation" in FAQ Options to activate' : 'Upgrade to unlock inquiry-to-FAQ curation'}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m10-6a8 8 0 11-16 0 8 8 0 0116 0z" /></svg>
              {tierAllowsFaqSync ? 'Enable in FAQ Options' : 'FAQ from Inquiry'}
            </span>
          )}
        </div>
      </div>

      {/* Ticket creation feedback */}
      {ticketCreated && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 text-sm text-green-700 dark:text-green-300">
          Ticket created successfully from this inquiry.
          {createdTicketId && (
            <Link href={`/t/${tenantId}/support/tickets/${createdTicketId}`} className="ml-1 underline font-medium hover:text-green-800">
              View Ticket →
            </Link>
          )}
        </div>
      )}
      {ticketError && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
          {ticketError}
        </div>
      )}

      {/* FAQ creation feedback */}
      {faqCreated && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 text-sm text-green-700 dark:text-green-300">
          FAQ draft created successfully from this inquiry. You can edit and publish it from your FAQ management page.
        </div>
      )}
      {faqError && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
          {faqError}
        </div>
      )}

      {/* Inquiry body */}
      {inquiry.body && (
        <Card>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{inquiry.body}</p>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-neutral-500 text-xs">From</p>
              <p className="font-medium">{inquiry.sender_name || 'Anonymous'}</p>
            </div>
            <div>
              <p className="text-neutral-500 text-xs">Email</p>
              <p className="font-medium">{inquiry.sender_email || '—'}</p>
            </div>
            <div>
              <p className="text-neutral-500 text-xs">Phone</p>
              <p className="font-medium">{inquiry.sender_phone || '—'}</p>
            </div>
            <div>
              <p className="text-neutral-500 text-xs">Source</p>
              <p className="font-medium">{inquiry.source || 'N/A'}</p>
            </div>
            <div>
              <p className="text-neutral-500 text-xs">Assigned To</p>
              <p className="font-medium">{inquiry.assigned_to ? tenantUsers.find(u => u.id === inquiry.assigned_to)?.name || inquiry.assigned_to : 'Unassigned'}</p>
            </div>
            <div>
              <p className="text-neutral-500 text-xs">Created</p>
              <p className="font-medium">{new Date(inquiry.created_at).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-neutral-500 text-xs">Updated</p>
              <p className="font-medium">{new Date(inquiry.updated_at).toLocaleString()}</p>
            </div>
            {inquiry.resolved_at && (
              <div>
                <p className="text-neutral-500 text-xs">Resolved</p>
                <p className="font-medium">{new Date(inquiry.resolved_at).toLocaleString()}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Activity History */}
      <Card>
        <CardContent>
          <h3 className="text-sm font-semibold mb-3">Activity History</h3>
          {activities.length === 0 ? (
            <p className="text-sm text-neutral-500">No activity recorded for this inquiry.</p>
          ) : (
            <div className="space-y-3">
              {activities.map((a) => (
                <div key={a.id} className="flex gap-3 py-2 border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{a.content || a.activity_type}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {(() => {
                        const actorUser = tenantUsers.find(u => u.id === a.actor_id);
                        const currentUserName = user?.firstName || user?.lastName
                          ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                          : null;
                        const displayName = actorUser?.name || (a.actor_id === user?.id ? currentUserName : null) || a.actor_name;
                        return `${displayName} · ${a.activity_type} · ${new Date(a.created_at).toLocaleString()}`;
                      })()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </TenantCrmPageShell>
  );
}
