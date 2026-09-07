'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lightbulb, RefreshCw, Check, X, FileSearch, Copy, Loader2, Inbox, Users, Megaphone, ExternalLink, ListPlus, PhoneCall } from 'lucide-react';
import { Badge, Button, Select, Table, Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import directorySuggestionAdminService, { SuggestionRecord, SuggestionAnalytics } from '@/services/DirectorySuggestionAdminService';
import directoryPresenceAdminService, { type DirectoryPresenceSeedSummary } from '@/services/DirectoryPresenceAdminService';
import marketingOpsService from '@/services/MarketingOpsService';
import { formatDistanceToNow } from 'date-fns';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'duplicate', label: 'Duplicate' },
];

export default function SuggestionsQueueClient() {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<SuggestionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>('submitted');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<SuggestionRecord | null>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const [analytics, setAnalytics] = useState<SuggestionAnalytics | null>(null);
  // Approve surfaces the minted claim link + seed; Dup collects the canonical
  // seed it duplicates; Campaign converts the suggestion into a business-scope
  // triage campaign (audit-first path, before any seeding).
  const [approveResult, setApproveResult] = useState<{ seedId: string; claimUrl?: string; businessName: string } | null>(null);
  const [dupTarget, setDupTarget] = useState<SuggestionRecord | null>(null);
  const [dupSeeds, setDupSeeds] = useState<DirectoryPresenceSeedSummary[]>([]);
  const [dupSeedId, setDupSeedId] = useState('');
  const [dupLoading, setDupLoading] = useState(false);
  const [copiedClaim, setCopiedClaim] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const limit = 25;

  const fetchSuggestions = async (reset = false) => {
    setLoading(true);
    setError(null);
    try {
      const filters: any = { limit, offset: (page - 1) * limit };
      if (status && status !== 'all') filters.status = status;
      const result = await directorySuggestionAdminService.listSuggestions(filters);
      setSuggestions(result.suggestions);
      setTotal(result.total);
      if (reset) setPage(1);
    } catch (err: any) {
      setError(err?.message || 'Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const data = await directorySuggestionAdminService.getAnalytics();
      setAnalytics(data);
    } catch (err: any) {
      // Analytics are non-critical; don't block the queue on failure
      setAnalytics(null);
    }
  };

  useEffect(() => {
    fetchSuggestions(true);
    fetchAnalytics();
  }, [status]);

  useEffect(() => {
    fetchSuggestions(false);
  }, [page]);

  const handleStatusChange = async (id: string, newStatus: SuggestionRecord['status'], seedId?: string) => {
    setActionBusy(`${id}:${newStatus}`);
    try {
      const result = await directorySuggestionAdminService.updateStatus(id, newStatus, seedId);
      if (result.success) {
        setSuggestions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, ...result.suggestion } as SuggestionRecord : s))
        );
        // Approve mints a seed + claim token — surface the claim link so the
        // operator can send it to the business instead of losing it.
        if (newStatus === 'approved' && result.seed) {
          const biz = suggestions.find((s) => s.id === id)?.businessName || 'the business';
          setApproveResult({ seedId: result.seed.id, claimUrl: result.claimUrl, businessName: biz });
          setCopiedClaim(false);
        }
        if (detail?.id === id && result.suggestion) {
          setDetail({ ...detail, ...result.suggestion } as SuggestionRecord);
        }
      } else {
        setError(result.error || 'Failed to update status');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update status');
    } finally {
      setActionBusy(null);
    }
  };

  // Dup flow: the suggestion may match an existing seed — let the operator
  // pick the canonical seed (same market, searched by city+state) so
  // `seed_id` links the two records instead of standing alone.
  const openDupPicker = async (s: SuggestionRecord) => {
    setDupTarget(s);
    setDupSeedId('');
    setDupLoading(true);
    try {
      const seeds = await directoryPresenceAdminService.listSeeds({
        city: s.city || undefined,
        state: s.state || undefined,
      });
      setDupSeeds(seeds);
    } catch {
      setDupSeeds([]);
    } finally {
      setDupLoading(false);
    }
  };

  const confirmDuplicate = async () => {
    if (!dupTarget) return;
    await handleStatusChange(dupTarget.id, 'duplicate', dupSeedId || undefined);
    setDupTarget(null);
  };

  // Queue paths: park the suggestion in the prospect queue for later campaign
  // work ('queued'), or route it through verify-then-outreach first when the
  // operator wants NAP/contactability confirmed by phone before any outreach.
  // Both dedup against active queue rows + existing campaigns (title + city +
  // state); 'already_queued' / 'campaign_exists' surface as info, not errors.
  const handleQueue = async (s: SuggestionRecord, verify: boolean) => {
    setActionBusy(`${s.id}:${verify ? 'verify' : 'queue'}`);
    try {
      const result = await marketingOpsService.addToQueue({
        business_name: s.businessName,
        title: s.businessName,
        category: s.primaryCategory || undefined,
        city: s.city || undefined,
        state: s.state || undefined,
        source_kind: 'public_suggestion',
        scope: 'business',
        note: `Public directory suggestion ${s.id}${s.sourcePage ? ` (source: ${s.sourcePage})` : ''}${s.submitterComment ? `\nSubmitter: ${s.submitterComment}` : ''}`,
        business_snapshot: {
          phone: s.phone || undefined,
          email: s.submitterEmail || undefined,
          address: s.address || undefined,
          address_city: s.city || undefined,
          address_state: s.state || undefined,
          address_zip: s.zipCode || undefined,
        },
        initial_status: verify ? 'verify_then_outreach' : 'queued',
      });
      if (result.kind === 'campaign_exists') {
        setError(`"${s.businessName}" already has an active campaign — ${result.campaignId}`);
        return;
      }
      // Triage out of the submitted view once parked in a queue.
      await handleStatusChange(s.id, 'under_review');
      if (result.kind === 'already_queued') {
        setError(`"${s.businessName}" is already in the prospect queue (${result.entry.status}).`);
      }
    } catch (err: any) {
      setError(err?.message || `Failed to add to ${verify ? 'verify' : 'prospect'} queue`);
    } finally {
      setActionBusy(null);
    }
  };

  // Campaign path: convert the suggestion into a business-scope triage
  // campaign — the audit/triage machine evaluates the business first, and
  // seeding can happen later once the opportunity is qualified. The
  // suggestion moves to under_review and the campaign notes carry the
  // suggestion id for traceability.
  const handleCreateCampaign = async (s: SuggestionRecord) => {
    setActionBusy(`${s.id}:campaign`);
    try {
      const campaign = await marketingOpsService.createCampaign({
        scope: 'business',
        campaign_category: 'triage_management',
        business_name: s.businessName,
        category: s.primaryCategory || undefined,
        city: s.city || '',
        state: s.state || undefined,
        phone: s.phone || undefined,
        email: s.submitterEmail || undefined,
        address_line1: s.address || undefined,
        address_city: s.city || undefined,
        address_state: s.state || undefined,
        address_zip: s.zipCode || undefined,
        notes: `Public directory suggestion ${s.id}${s.sourcePage ? ` (source: ${s.sourcePage})` : ''}${s.submitterComment ? `\n\nSubmitter comment: ${s.submitterComment}` : ''}`,
      });
      await handleStatusChange(s.id, 'under_review');
      router.push(`/settings/admin/marketing-ops/campaigns/${campaign.id}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to create campaign');
    } finally {
      setActionBusy(null);
    }
  };

  const openDetail = (s: SuggestionRecord) => {
    setDetail(s);
    open();
  };

  const statusColor: Record<string, string> = {
    submitted: 'blue',
    under_review: 'yellow',
    approved: 'green',
    rejected: 'red',
    duplicate: 'gray',
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-yellow-500" />
            Public Suggestions
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Review businesses suggested by visitors. {total} total.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={status}
            onChange={setStatus}
            data={STATUS_OPTIONS}
            clearable
            placeholder="Filter by status"
          />
          <Button
            variant="light"
            onClick={() => fetchSuggestions(false)}
            leftSection={<RefreshCw className="w-4 h-4" />}
            loading={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
        </div>
      )}

      {analytics && (
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
              <Inbox className="w-4 h-4" />
              Public suggestions
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.suggestions.total}</div>
            <div className="text-xs text-gray-500 mt-1">
              {(analytics.suggestions.byStatus.submitted || 0) + (analytics.suggestions.byStatus.under_review || 0)} pending
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
              <Check className="w-4 h-4" />
              Approved
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.suggestions.byStatus.approved || 0}</div>
            <div className="text-xs text-gray-500 mt-1">
              {analytics.suggestions.total
                ? Math.round(((analytics.suggestions.byStatus.approved || 0) / analytics.suggestions.total) * 100)
                : 0}% conversion
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
              <X className="w-4 h-4" />
              Rejected / duplicate
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {(analytics.suggestions.byStatus.rejected || 0) + (analytics.suggestions.byStatus.duplicate || 0)}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
              <Users className="w-4 h-4" />
              Owner submissions
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{analytics.ownerSubmissions.total}</div>
            <div className="text-xs text-gray-500 mt-1">
              {Object.values(analytics.ownerSubmissions.byStatus).reduce((a, b) => a + b, 0)} tracked
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Business</Table.Th>
              <Table.Th>Location</Table.Th>
              <Table.Th>Category</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Submitted</Table.Th>
              <Table.Th className="text-right">Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading && suggestions.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6} className="text-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                  <p className="text-sm text-gray-500 mt-2">Loading suggestions...</p>
                </Table.Td>
              </Table.Tr>
            ) : suggestions.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6} className="text-center py-12 text-gray-500">
                  No suggestions found.
                </Table.Td>
              </Table.Tr>
            ) : (
              suggestions.map((s) => (
                <Table.Tr key={s.id}>
                  <Table.Td>
                    <div className="font-medium text-gray-900 dark:text-white">{s.businessName}</div>
                    {s.submitterEmail && (
                      <div className="text-xs text-gray-500">{s.submitterEmail}</div>
                    )}
                    {s.seedId && (
                      <Link
                        href={`/settings/admin/directory/presence-seeds/${s.seedId}`}
                        className="text-xs text-blue-600 hover:underline inline-flex items-center gap-0.5 mt-0.5"
                      >
                        <ExternalLink className="w-3 h-3" /> seed {s.seedId.slice(0, 10)}…
                      </Link>
                    )}
                  </Table.Td>
                  <Table.Td className="text-sm text-gray-600 dark:text-gray-400">
                    {s.city ? `${s.city}, ${s.state || ''}` : '—'}
                  </Table.Td>
                  <Table.Td className="text-sm text-gray-600 dark:text-gray-400">
                    {s.primaryCategory || '—'}
                  </Table.Td>
                  <Table.Td>
                    <Badge color={statusColor[s.status] || 'gray'} size="sm">
                      {s.status.replace('_', ' ')}
                    </Badge>
                  </Table.Td>
                  <Table.Td className="text-sm text-gray-500">
                    {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}
                  </Table.Td>
                  <Table.Td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="xs" variant="subtle" onClick={() => openDetail(s)} leftSection={<FileSearch className="w-3.5 h-3.5" />}>
                        View
                      </Button>
                      <Button size="xs" color="green" variant="light" loading={actionBusy === `${s.id}:approved`} onClick={() => handleStatusChange(s.id, 'approved')} leftSection={<Check className="w-3.5 h-3.5" />}
                        title="Convert to a published seed + mint a claim link"
                      >
                        Approve
                      </Button>
                      <Button size="xs" color="indigo" variant="light" loading={actionBusy === `${s.id}:campaign`} onClick={() => handleCreateCampaign(s)} leftSection={<Megaphone className="w-3.5 h-3.5" />}
                        title="Create a business-scope triage campaign (audit first, seed later)"
                      >
                        Campaign
                      </Button>
                      <Button size="xs" color="teal" variant="light" loading={actionBusy === `${s.id}:queue`} onClick={() => handleQueue(s, false)} leftSection={<ListPlus className="w-3.5 h-3.5" />}
                        title="Add to prospect queue for later campaign work"
                      >
                        Queue
                      </Button>
                      <Button size="xs" color="orange" variant="light" loading={actionBusy === `${s.id}:verify`} onClick={() => handleQueue(s, true)} leftSection={<PhoneCall className="w-3.5 h-3.5" />}
                        title="Add to verify queue — confirm NAP/contactability by phone before outreach"
                      >
                        Verify
                      </Button>
                      <Button size="xs" color="red" variant="light" loading={actionBusy === `${s.id}:rejected`} onClick={() => handleStatusChange(s.id, 'rejected')} leftSection={<X className="w-3.5 h-3.5" />}>
                        Reject
                      </Button>
                      <Button size="xs" color="gray" variant="light" onClick={() => openDupPicker(s)} leftSection={<Copy className="w-3.5 h-3.5" />}
                        title="Mark duplicate — optionally link the canonical seed"
                      >
                        Dup
                      </Button>
                    </div>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>

        {total > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <Button variant="subtle" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {page} of {Math.ceil(total / limit)}
            </span>
            <Button
              variant="subtle"
              disabled={page * limit >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      <Modal opened={opened} onClose={close} title={detail?.businessName || 'Suggestion Detail'} size="lg">
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-gray-500">Address</span>
                <p className="text-gray-900 dark:text-white">{detail.address || '—'}</p>
              </div>
              <div>
                <span className="text-gray-500">City / State</span>
                <p className="text-gray-900 dark:text-white">{detail.city ? `${detail.city}, ${detail.state}` : '—'}</p>
              </div>
              <div>
                <span className="text-gray-500">ZIP</span>
                <p className="text-gray-900 dark:text-white">{detail.zipCode || '—'}</p>
              </div>
              <div>
                <span className="text-gray-500">Phone</span>
                <p className="text-gray-900 dark:text-white">{detail.phone || '—'}</p>
              </div>
              <div>
                <span className="text-gray-500">Category</span>
                <p className="text-gray-900 dark:text-white">{detail.primaryCategory || '—'}</p>
              </div>
              <div>
                <span className="text-gray-500">Source Page</span>
                <p className="text-gray-900 dark:text-white break-all">{detail.sourcePage || '—'}</p>
              </div>
            </div>
            {detail.submitterComment && (
              <div>
                <span className="text-gray-500">Comment</span>
                <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{detail.submitterComment}</p>
              </div>
            )}
            <div className="pt-4 flex gap-2 justify-end border-t border-gray-200 dark:border-gray-700 flex-wrap">
              <Button color="green" onClick={() => handleStatusChange(detail.id, 'approved')}>Approve</Button>
              <Button color="indigo" variant="light" onClick={() => { close(); handleCreateCampaign(detail); }}>Create Campaign</Button>
              <Button color="teal" variant="light" onClick={() => { close(); handleQueue(detail, false); }}>Add to Queue</Button>
              <Button color="orange" variant="light" onClick={() => { close(); handleQueue(detail, true); }}>Add to Verify</Button>
              <Button color="red" variant="light" onClick={() => handleStatusChange(detail.id, 'rejected')}>Reject</Button>
              <Button color="gray" variant="light" onClick={() => { close(); openDupPicker(detail); }}>Duplicate</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Approve result — the minted claim link, copyable for outreach */}
      <Modal opened={!!approveResult} onClose={() => setApproveResult(null)} title="Suggestion approved" size="md">
        {approveResult && (
          <div className="space-y-3 text-sm">
            <p className="text-gray-700 dark:text-gray-300">
              <span className="font-medium">{approveResult.businessName}</span> was converted to a
              published seed with a claim token.
            </p>
            {approveResult.claimUrl && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Claim link (send to the business owner):</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-1.5 break-all">
                    {approveResult.claimUrl}
                  </code>
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<Copy className="w-3.5 h-3.5" />}
                    onClick={() => {
                      navigator.clipboard.writeText(approveResult.claimUrl!);
                      setCopiedClaim(true);
                    }}
                  >
                    {copiedClaim ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
            )}
            <div className="pt-2 flex justify-end">
              <Button
                component={Link as any}
                href={`/settings/admin/directory/presence-seeds/${approveResult.seedId}`}
                variant="light"
                size="sm"
                leftSection={<ExternalLink className="w-3.5 h-3.5" />}
              >
                Open seed
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Duplicate picker — link the canonical seed this suggestion matches */}
      <Modal opened={!!dupTarget} onClose={() => setDupTarget(null)} title="Mark as duplicate" size="lg">
        {dupTarget && (
          <div className="space-y-3 text-sm">
            <p className="text-gray-700 dark:text-gray-300">
              If <span className="font-medium">{dupTarget.businessName}</span> matches an existing
              seed, select it to link the records.
            </p>
            {dupLoading ? (
              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading seeds in this market…
              </p>
            ) : dupSeeds.length === 0 ? (
              <p className="text-xs text-gray-500">No seeds found for this city/state.</p>
            ) : (
              <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
                {dupSeeds.map((seed) => (
                  <label key={seed.id} className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                    <input
                      type="radio"
                      name="dup-seed"
                      checked={dupSeedId === seed.id}
                      onChange={() => setDupSeedId(seed.id)}
                      className="border-gray-300"
                    />
                    <span className="flex-1 truncate font-medium">{seed.businessName}</span>
                    <span className="text-gray-400">{seed.city}, {seed.state} · {seed.status}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="pt-3 flex justify-end gap-2 border-t border-gray-200 dark:border-gray-700">
              <Button variant="subtle" onClick={() => setDupTarget(null)}>Cancel</Button>
              <Button
                color="gray"
                loading={actionBusy === `${dupTarget.id}:duplicate`}
                onClick={confirmDuplicate}
              >
                {dupSeedId ? 'Mark duplicate of selected seed' : 'Mark duplicate (no link)'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
