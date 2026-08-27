'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import directoryPresenceAdminService, {
  DirectoryPresenceSeedSummary,
  DirectoryClaimRequest,
} from '@/services/DirectoryPresenceAdminService';
import { List, Plus, Send, CheckCircle, Eye, MapPin, Tag, Clock, ExternalLink, UserCheck, XCircle, Mail, Phone, ShieldCheck, FileText } from 'lucide-react';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  published: 'bg-blue-100 text-blue-700',
  invited: 'bg-amber-100 text-amber-700',
  claimed: 'bg-green-100 text-green-700',
  suppressed: 'bg-red-100 text-red-700',
};

export default function DirectoryPresenceSeedsPage() {
  const [seeds, setSeeds] = useState<DirectoryPresenceSeedSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterBatch, setFilterBatch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterState, setFilterState] = useState('');
  const [filterConfidence, setFilterConfidence] = useState('');
  const [filterCategoryFit, setFilterCategoryFit] = useState('');
  const [filterClaimToken, setFilterClaimToken] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<{ seedId: string; token: string } | null>(null);
  const [claimRequests, setClaimRequests] = useState<DirectoryClaimRequest[]>([]);
  const [claimRequestsLoading, setClaimRequestsLoading] = useState(false);
  const [claimActionId, setClaimActionId] = useState<string | null>(null);
  const [unlinkedApproved, setUnlinkedApproved] = useState<DirectoryClaimRequest[]>([]);
  const [verifyRequest, setVerifyRequest] = useState<DirectoryClaimRequest | null>(null);
  const [verifyMethod, setVerifyMethod] = useState('phone');
  const [verifyNotes, setVerifyNotes] = useState('');
  const [verifySaving, setVerifySaving] = useState(false);
  const [verifyAttachments, setVerifyAttachments] = useState<Array<{
    id: string; fileName: string; fileType: string; fileSize: number; uploadedAt: string;
  }>>([]);
  const [verifyAttachmentsLoading, setVerifyAttachmentsLoading] = useState(false);

  const fetchSeeds = useCallback(async () => {
    try {
      setLoading(true);
      const data = await directoryPresenceAdminService.listSeeds({
        seedBatch: filterBatch || undefined,
        status: filterStatus || undefined,
        category: filterCategory || undefined,
        city: filterCity || undefined,
        state: filterState || undefined,
        identityConfidence: filterConfidence || undefined,
        categoryFit: filterCategoryFit || undefined,
        hasClaimToken: filterClaimToken || undefined,
      });
      setSeeds(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load presence seeds');
    } finally {
      setLoading(false);
    }
  }, [
    filterBatch,
    filterStatus,
    filterCategory,
    filterCity,
    filterState,
    filterConfidence,
    filterCategoryFit,
    filterClaimToken,
  ]);

  useEffect(() => {
    fetchSeeds();
  }, [fetchSeeds]);

  // Derive dropdown options from the loaded seeds
  const batchOptions = useMemo(
    () => Array.from(new Set(seeds.map((s) => s.seedBatch).filter(Boolean))).sort(),
    [seeds],
  );
  const categoryOptions = useMemo(
    () => Array.from(new Set(seeds.map((s) => s.category).filter(Boolean))).sort(),
    [seeds],
  );
  const cityOptions = useMemo(
    () => Array.from(new Set(seeds.map((s) => s.city).filter(Boolean))).sort(),
    [seeds],
  );
  const stateOptions = useMemo(
    () => Array.from(new Set(seeds.map((s) => s.state).filter(Boolean))).sort(),
    [seeds],
  );

  const handlePublish = async (seedId: string) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      await directoryPresenceAdminService.publishSeed(seedId);
      setActionSuccess('Listing published successfully.');
      fetchSeeds();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to publish listing');
    }
  };

  const handleInvite = async (seedId: string) => {
    setActionError(null);
    setActionSuccess(null);
    setInviteToken(null);
    try {
      const result = await directoryPresenceAdminService.inviteSeed(seedId);
      setInviteToken({ seedId, token: result.token });
      setActionSuccess('Claim token generated. Share the link below with the business owner.');
      fetchSeeds();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to generate invite');
    }
  };

  const fetchClaimRequests = useCallback(async () => {
    setClaimRequestsLoading(true);
    try {
      const [pending, approved] = await Promise.all([
        directoryPresenceAdminService.listClaimRequests('pending'),
        directoryPresenceAdminService.listClaimRequests('approved'),
      ]);
      setClaimRequests(pending);
      // Approved claims with no customer_id need retroactive linking
      setUnlinkedApproved(approved.filter((r) => !r.customerId && !r.customerEmail));
    } catch {
      // Non-critical — claim requests section is supplementary
    } finally {
      setClaimRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClaimRequests();
  }, [fetchClaimRequests]);

  const handleApproveClaim = async (requestId: string) => {
    setClaimActionId(requestId);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await directoryPresenceAdminService.approveClaimRequest(requestId);
      if (result.success) {
        setActionSuccess('Claim request approved. The listing has been transferred to the owner.');
        fetchClaimRequests();
        fetchSeeds();
      } else {
        setActionError(result.error || 'Failed to approve claim request');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve claim request');
    } finally {
      setClaimActionId(null);
    }
  };

  const handleRejectClaim = async (requestId: string) => {
    const reason = window.prompt('Reason for rejection (optional):');
    if (reason === null) return; // cancelled
    setClaimActionId(requestId);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await directoryPresenceAdminService.rejectClaimRequest(requestId, reason || undefined);
      if (result.success) {
        setActionSuccess('Claim request rejected.');
        fetchClaimRequests();
      } else {
        setActionError(result.error || 'Failed to reject claim request');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reject claim request');
    } finally {
      setClaimActionId(null);
    }
  };

  const handleLinkCustomer = async (requestId: string) => {
    const customerId = window.prompt('Enter the customer ID or email to link to this approved claim:');
    if (!customerId) return; // cancelled
    setClaimActionId(requestId);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await directoryPresenceAdminService.linkCustomerToClaimRequest(requestId, customerId);
      if (result.success) {
        setActionSuccess('Customer linked to claim request. The owner now has platform access.');
        fetchClaimRequests();
      } else {
        setActionError(result.error || 'Failed to link customer');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to link customer');
    } finally {
      setClaimActionId(null);
    }
  };

  const handleOpenVerify = async (req: DirectoryClaimRequest) => {
    setVerifyRequest(req);
    setVerifyMethod(req.verificationMethod || 'phone');
    setVerifyNotes(req.verificationNotes || '');
    setVerifyAttachments([]);
    setVerifyAttachmentsLoading(true);
    try {
      const attachments = await directoryPresenceAdminService.listClaimAttachments(req.id);
      setVerifyAttachments(attachments);
    } catch {
      // soft-fail — attachments are optional
    } finally {
      setVerifyAttachmentsLoading(false);
    }
  };

  const handleSaveVerification = async () => {
    if (!verifyRequest) return;
    setVerifySaving(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await directoryPresenceAdminService.saveVerification(
        verifyRequest.id,
        verifyMethod,
        verifyNotes,
      );
      if (result.success) {
        setActionSuccess('Verification worksheet saved.');
        setVerifyRequest(null);
        fetchClaimRequests();
      } else {
        setActionError(result.error || 'Failed to save verification');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to save verification');
    } finally {
      setVerifySaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Directory Presence Seeds"
        description="Manage unclaimed directory listings seeded from public information."
        icon={<List className="w-6 h-6" />}
        actions={
          <Link
            href="/settings/admin/directory/presence-seeds/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Create Seed
          </Link>
        }
      />

      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          {actionSuccess}
        </div>
      )}
      {inviteToken && (
        <div className="bg-blue-50 border border-blue-200 px-4 py-3 rounded-lg">
          <p className="text-sm font-medium text-blue-900 mb-1">Claim Link</p>
          <p className="text-sm text-blue-700 break-all font-mono">
            {typeof window !== 'undefined'
              ? `${window.location.origin}/place/claim/${inviteToken.token}`
              : `/place/claim/${inviteToken.token}`}
          </p>
          <button
            className="mt-2 text-xs text-blue-600 underline"
            onClick={() => {
              if (typeof navigator !== 'undefined' && navigator.clipboard) {
                const link = `${window.location.origin}/place/claim/${inviteToken.token}`;
                navigator.clipboard.writeText(link);
              }
            }}
          >
            Copy link
          </button>
        </div>
      )}

      {/* Pending Claim Requests */}
      {claimRequests.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-200 bg-amber-100">
            <h3 className="text-sm font-semibold text-amber-900 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Pending Claim Requests ({claimRequests.length})
            </h3>
          </div>
          <div className="divide-y divide-amber-100">
            {claimRequests.map((req) => {
              const claimantFullName = [req.claimantFirstName, req.claimantLastName]
                .filter(Boolean).join(' ') || req.customerName || '—';
              const isVerified = !!req.verificationCompletedAt;
              return (
                <div key={req.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/settings/admin/directory/presence-seeds/${req.seedId}`}
                          className="font-medium text-gray-900 hover:text-blue-600 truncate"
                        >
                          {req.businessName}
                        </Link>
                        <span className="text-xs text-gray-500">
                          {req.category} · {req.city}, {req.state}
                        </span>
                        {isVerified && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            <ShieldCheck className="w-3 h-3" />
                            Verified
                          </span>
                        )}
                        {req.attachmentCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                            <FileText className="w-3 h-3" />
                            {req.attachmentCount} proof {req.attachmentCount === 1 ? 'file' : 'files'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="font-medium text-gray-700">{claimantFullName}</span>
                        {req.customerEmail && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {req.customerEmail}
                          </span>
                        )}
                        {req.claimantPhone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {req.claimantPhone}
                          </span>
                        )}
                        <span>
                          Submitted {new Date(req.submittedAt).toLocaleDateString()}
                        </span>
                      </div>
                      {req.claimantBusinessAddress && (
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {req.claimantBusinessAddress}
                        </div>
                      )}
                      {isVerified && req.verificationNotes && (
                        <div className="text-xs text-gray-500 mt-1 italic">
                          "{req.verificationNotes}"
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleOpenVerify(req)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-blue-300 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-50"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {isVerified ? 'Edit' : 'Verify'}
                      </button>
                      <button
                        onClick={() => handleApproveClaim(req.id)}
                        disabled={claimActionId === req.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectClaim(req.id)}
                        disabled={claimActionId === req.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-red-300 text-red-700 rounded-lg text-xs font-medium hover:bg-red-50 disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Verification Worksheet Modal */}
      {verifyRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                Claim Verification Worksheet
              </h2>
              <button
                type="button"
                onClick={() => setVerifyRequest(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {/* Claim summary */}
            <div className="mb-4 rounded-md bg-gray-50 p-3 text-sm">
              <p className="font-medium text-gray-900">{verifyRequest.businessName}</p>
              <p className="text-gray-500">
                {verifyRequest.category} · {verifyRequest.city}, {verifyRequest.state}
              </p>
              <div className="mt-2 space-y-0.5 text-xs text-gray-600">
                <p><span className="font-medium">Claimant:</span> {[verifyRequest.claimantFirstName, verifyRequest.claimantLastName].filter(Boolean).join(' ') || verifyRequest.customerName || '—'}</p>
                <p><span className="font-medium">Email:</span> {verifyRequest.customerEmail || '—'}</p>
                <p><span className="font-medium">Phone:</span> {verifyRequest.claimantPhone || '—'}</p>
                {verifyRequest.claimantBusinessAddress && (
                  <p><span className="font-medium">Stated address:</span> {verifyRequest.claimantBusinessAddress}</p>
                )}
                {verifyRequest.businessPhone && (
                  <p><span className="font-medium">Business phone on file:</span> {verifyRequest.businessPhone}</p>
                )}
                <p><span className="font-medium">Listing address:</span> {verifyRequest.address}, {verifyRequest.city}, {verifyRequest.state}</p>
              </div>
            </div>

            {/* Proof attachments uploaded by claimant */}
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-1">Proof documents</p>
              {verifyAttachmentsLoading ? (
                <p className="text-xs text-gray-500">Loading...</p>
              ) : verifyAttachments.length === 0 ? (
                <p className="text-xs text-gray-500">No proof documents uploaded by the claimant.</p>
              ) : (
                <div className="space-y-1">
                  {verifyAttachments.map((att) => (
                    <a
                      key={att.id}
                      href={`/api/admin/directory-presence/claim-requests/attachments/${att.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <FileText className="w-4 h-4" />
                      {att.fileName}
                      <span className="text-xs text-gray-400">
                        ({att.fileType}, {(att.fileSize / 1024).toFixed(0)}KB)
                      </span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Verification form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Verification method
                </label>
                <select
                  value={verifyMethod}
                  onChange={(e) => setVerifyMethod(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                >
                  <option value="phone">Phone call to business</option>
                  <option value="email">Email verification</option>
                  <option value="website">Website / domain check</option>
                  <option value="in_person">In-person visit</option>
                  <option value="document">Document review (license, utility bill)</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Verification notes
                </label>
                <textarea
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  rows={5}
                  placeholder="Record what you checked, who you spoke with, what they confirmed, and any concerns..."
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Notes are visible to other operators. Record the outcome of your verification
                  before approving or rejecting.
                </p>
              </div>

              {/* Verification checklist hints */}
              <div className="rounded-md bg-blue-50 p-3 text-xs text-blue-700">
                <p className="font-medium mb-1">Suggested checks:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Call the business phone — ask for the claimant by name</li>
                  <li>Compare claimant phone to the business phone on file</li>
                  <li>Compare stated address to the listing address</li>
                  <li>Check if the email domain matches the business website</li>
                  <li>Ask the claimant for a business license or utility bill</li>
                </ul>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setVerifyRequest(null)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveVerification}
                  disabled={verifySaving}
                  className="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {verifySaving ? 'Saving...' : 'Save Verification'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approved claims with no linked customer — need retroactive linking */}
      {unlinkedApproved.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-blue-200 bg-blue-100">
            <h3 className="text-sm font-semibold text-blue-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4" />
              Approved Claims — Link Owner ({unlinkedApproved.length})
            </h3>
            <p className="text-xs text-blue-700 mt-1">
              These claims were approved without a linked customer account. Link the owner
              so they get platform access and see Marketing / GBP navigation.
            </p>
          </div>
          <div className="divide-y divide-blue-100">
            {unlinkedApproved.map((req) => (
              <div key={req.id} className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/settings/admin/directory/presence-seeds/${req.seedId}`}
                      className="font-medium text-gray-900 hover:text-blue-600 truncate"
                    >
                      {req.businessName}
                    </Link>
                    <span className="text-xs text-gray-500">
                      {req.category} · {req.city}, {req.state}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    Approved {req.reviewedAt ? new Date(req.reviewedAt).toLocaleDateString() : '—'} ·
                    Tenant: {req.tenantId}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleLinkCustomer(req.id)}
                    disabled={claimActionId === req.id}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Link Customer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Seed Batch</label>
            <select
              value={filterBatch}
              onChange={(e) => setFilterBatch(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
            >
              <option value="">All</option>
              {batchOptions.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
            >
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="invited">Invited</option>
              <option value="claimed">Claimed</option>
              <option value="suppressed">Suppressed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
            >
              <option value="">All</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <select
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
            >
              <option value="">All</option>
              {cityOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
            <select
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
            >
              <option value="">All</option>
              {stateOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Identity Confidence</label>
            <select
              value={filterConfidence}
              onChange={(e) => setFilterConfidence(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
            >
              <option value="">All</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category Fit</label>
            <select
              value={filterCategoryFit}
              onChange={(e) => setFilterCategoryFit(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
            >
              <option value="">All</option>
              <option value="verified">Verified</option>
              <option value="probable">Probable</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Claim Token</label>
            <select
              value={filterClaimToken}
              onChange={(e) => setFilterClaimToken(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full"
            >
              <option value="">All</option>
              <option value="yes">Has active token</option>
              <option value="no">No active token</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={fetchSeeds}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium"
          >
            Filter
          </button>
          <Link
            href="/place"
            target="_blank"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
            title="Open the public directory presence page in a new tab"
          >
            <ExternalLink className="w-4 h-4" /> View Public Directory
          </Link>
        </div>
      </div>

      {/* Seeds table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading seeds...</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      ) : seeds.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No presence seeds found. Create one to get started.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-600">
                <th className="py-3 px-4 font-medium">Business</th>
                <th className="py-3 px-4 font-medium">Category</th>
                <th className="py-3 px-4 font-medium">Location</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium">Confidence</th>
                <th className="py-3 px-4 font-medium">SNAP/EBT</th>
                <th className="py-3 px-4 font-medium">Claim Token</th>
                <th className="py-3 px-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {seeds.map((seed) => (
                <tr key={seed.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <Link
                      href={`/settings/admin/directory/presence-seeds/${seed.id}`}
                      className="font-medium text-gray-900 hover:text-blue-600"
                    >
                      {seed.businessName}
                    </Link>
                    <div className="text-xs text-gray-500">{seed.seedBatch}</div>
                  </td>
                  <td className="py-3 px-4 text-gray-700">{seed.category}</td>
                  <td className="py-3 px-4 text-gray-700">
                    {seed.city}, {seed.state}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        STATUS_COLORS[seed.status] || 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {seed.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-xs ${
                        seed.identityConfidence === 'high'
                          ? 'text-green-600 font-medium'
                          : 'text-amber-600 font-medium'
                      }`}
                    >
                      {seed.identityConfidence}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {seed.snapEbtReported ? (
                      <span className="text-xs text-green-600 font-medium">Reported</span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {seed.hasClaimToken ? (
                      <span className="text-xs text-amber-600">
                        <Clock className="inline w-3 h-3 mr-1" />
                        Active
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">None</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      {seed.status === 'draft' && (
                        <button
                          onClick={() => handlePublish(seed.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          title="Publish listing"
                        >
                          <CheckCircle className="inline w-4 h-4" />
                        </button>
                      )}
                      {(seed.status === 'published' || seed.status === 'invited') &&
                        !seed.hasClaimToken && (
                          <button
                            onClick={() => handleInvite(seed.id)}
                            className="text-xs text-amber-600 hover:text-amber-800 font-medium"
                            title="Generate claim invite"
                          >
                            <Send className="inline w-4 h-4" />
                          </button>
                        )}
                      <Link
                        href={`/settings/admin/directory/presence-seeds/${seed.id}`}
                        className="text-xs text-gray-600 hover:text-gray-800"
                        title="View details"
                      >
                        <Eye className="inline w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
