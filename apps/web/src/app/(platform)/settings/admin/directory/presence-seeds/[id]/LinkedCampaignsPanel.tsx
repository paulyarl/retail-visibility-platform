'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import directoryPresenceAdminService, {
  DirectorySeedCampaignLink,
  DirectoryCampaignCandidate,
  DirectoryCampaignDiffEntry,
} from '@/services/DirectoryPresenceAdminService';
import {
  Link2,
  Unlink,
  Search,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  X,
  Plus,
  ArrowRight,
} from 'lucide-react';

const NAP_CONFIDENCE_COLORS: Record<string, string> = {
  high: 'bg-green-50 text-green-700 border-green-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-orange-50 text-orange-700 border-orange-200',
  none: 'bg-red-50 text-red-700 border-red-200',
};

const LINK_ROLE_COLORS: Record<string, string> = {
  primary: 'bg-blue-50 text-blue-700 border-blue-200',
  sibling: 'bg-gray-50 text-gray-700 border-gray-200',
  recovery: 'bg-purple-50 text-purple-700 border-purple-200',
};

const ALL_PROJECTION_FIELDS = [
  { key: 'phone', label: 'Phone' },
  { key: 'website', label: 'Website' },
  { key: 'primaryCategory', label: 'Primary category' },
  { key: 'description', label: 'Description (campaign notes)' },
  { key: 'originCountry', label: 'Origin country → keywords' },
  { key: 'originRegion', label: 'Origin region → keywords' },
  { key: 'neighborhood', label: 'Neighborhood → keywords' },
  { key: 'directoryProfile', label: 'Directory profile (provenance only)' },
];

interface Props {
  seedId: string;
  canEdit: boolean;
}

export default function LinkedCampaignsPanel({ seedId, canEdit }: Props) {
  const [links, setLinks] = useState<DirectorySeedCampaignLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Link picker modal state
  const [showPicker, setShowPicker] = useState(false);
  const [candidateQuery, setCandidateQuery] = useState('');
  const [candidates, setCandidates] = useState<DirectoryCampaignCandidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [linkingCampaignId, setLinkingCampaignId] = useState<string | null>(null);
  const [linkRole, setLinkRole] = useState<'primary' | 'sibling' | 'recovery'>('primary');

  // Sync modal state
  const [syncLink, setSyncLink] = useState<DirectorySeedCampaignLink | null>(null);
  const [diff, setDiff] = useState<DirectoryCampaignDiffEntry[]>([]);
  const [diffLoading, setDiffLoading] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [unlinksyncingId, setUnlinkingId] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await directoryPresenceAdminService.listCampaignLinks(seedId);
      setLinks(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaign links');
    } finally {
      setLoading(false);
    }
  }, [seedId]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const fetchCandidates = useCallback(async (q: string) => {
    try {
      setCandidatesLoading(true);
      const data = await directoryPresenceAdminService.findCampaignCandidates(seedId, q, 20);
      setCandidates(data);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to search campaigns');
    } finally {
      setCandidatesLoading(false);
    }
  }, [seedId]);

  const openPicker = () => {
    setShowPicker(true);
    setCandidateQuery('');
    setActionError(null);
    setActionSuccess(null);
    fetchCandidates('');
  };

  const handleCandidateSearch = (q: string) => {
    setCandidateQuery(q);
    fetchCandidates(q);
  };

  const handleLink = async (campaignId: string) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      setLinkingCampaignId(campaignId);
      const result = await directoryPresenceAdminService.linkCampaign(seedId, campaignId, linkRole);
      setActionSuccess(
        result.autoProjected
          ? `Linked and auto-projected campaign signals (NAP confidence: ${result.napMatch?.confidence}).`
          : `Linked campaign (NAP confidence: ${result.napMatch?.confidence}). Use "Sync" to project fields manually.`,
      );
      setShowPicker(false);
      fetchLinks();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to link campaign');
    } finally {
      setLinkingCampaignId(null);
    }
  };

  const handleUnlink = async (campaignId: string) => {
    if (!confirm('Unlink this campaign? Projected fields stay on the listing; provenance rows remain as audit trail.')) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      setUnlinkingId(campaignId);
      await directoryPresenceAdminService.unlinkCampaign(seedId, campaignId);
      setActionSuccess('Campaign unlinked.');
      fetchLinks();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to unlink campaign');
    } finally {
      setUnlinkingId(null);
    }
  };

  const openSync = async (link: DirectorySeedCampaignLink) => {
    setSyncLink(link);
    setDiff([]);
    setSelectedFields([]);
    setActionError(null);
    setActionSuccess(null);
    try {
      setDiffLoading(true);
      const d = await directoryPresenceAdminService.getCampaignDiff(seedId, link.campaignId);
      setDiff(d);
      // Pre-select changed fields with campaign values
      setSelectedFields(d.filter((x) => x.changed && x.campaignValue).map((x) => x.field));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to load diff');
    } finally {
      setDiffLoading(false);
    }
  };

  const handleSync = async () => {
    if (!syncLink) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      setSyncing(true);
      const result = await directoryPresenceAdminService.syncFromCampaign(
        seedId,
        syncLink.campaignId,
        selectedFields,
      );
      setActionSuccess(
        `Projected ${result.projected.length} field(s): ${result.projected.join(', ') || '—'}` +
        (result.skipped.length ? ` · Skipped: ${result.skipped.join(', ')}` : ''),
      );
      setSyncLink(null);
      fetchLinks();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to sync fields');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Linked Campaigns</h2>
        <p className="text-sm text-gray-500">Loading...</p>
      </section>
    );
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Linked Campaigns</h2>
          <p className="text-xs text-gray-500 mt-1">
            Bridge operator-validated campaign signals (origin country/region, neighborhood,
            reconciled NAP) into this seed&apos;s public SEO surface. Provenance is preserved
            per-field with source = &lsquo;linked_campaign&rsquo;.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={openPicker}
            className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> Link Campaign
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}
      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-sm">
          {actionSuccess}
        </div>
      )}

      {links.length === 0 ? (
        <p className="text-sm text-gray-500">
          No campaigns linked yet. Link a campaign to project operator-validated signals onto
          this seed listing.
        </p>
      ) : (
        <div className="space-y-3">
          {links.map((link) => (
            <div
              key={link.id}
              className="border border-gray-200 rounded-lg p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/settings/admin/marketing-ops/recovery/${link.campaignId}`}
                      className="text-sm font-medium text-blue-600 hover:underline truncate"
                    >
                      {link.campaign?.businessName || link.campaignId}
                    </Link>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${LINK_ROLE_COLORS[link.linkRole] || LINK_ROLE_COLORS.sibling}`}>
                      {link.linkRole}
                    </span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${NAP_CONFIDENCE_COLORS[link.napMatchConfidence] || NAP_CONFIDENCE_COLORS.none}`}>
                      NAP: {link.napMatchConfidence}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {link.campaign?.category} · {link.campaign?.city}
                    {link.campaign?.state ? `, ${link.campaign.state}` : ''} · stage: {link.campaign?.stage}
                    {link.campaign?.displayId ? ` · ${link.campaign.displayId}` : ''}
                  </p>
                  {link.lastSyncedAt && (
                    <p className="text-xs text-gray-400">
                      Last synced {new Date(link.lastSyncedAt).toLocaleString()}
                      {link.lastSyncFields.length > 0 && ` · fields: ${link.lastSyncFields.join(', ')}`}
                    </p>
                  )}
                  {link.napMatchSummary && (
                    <details className="text-xs text-gray-500">
                      <summary className="cursor-pointer hover:text-gray-700">NAP match details</summary>
                      <ul className="mt-1 ml-4 space-y-0.5">
                        <li>Business name: {link.napMatchSummary.businessNameMatch ? '✓' : '✗'}</li>
                        <li>Address: {link.napMatchSummary.addressMatch ? '✓' : '✗'}</li>
                        <li>Phone: {link.napMatchSummary.phoneMatch ? '✓' : '✗'}</li>
                        <li>City: {link.napMatchSummary.cityMatch ? '✓' : '✗'}</li>
                        {link.napMatchSummary.notes?.length > 0 && (
                          <li className="text-gray-400">Notes: {link.napMatchSummary.notes.join(', ')}</li>
                        )}
                      </ul>
                    </details>
                  )}
                </div>
                {canEdit && (
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={() => openSync(link)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 px-2 py-1 rounded border border-blue-200 hover:bg-blue-50"
                      title="Review diff and project fields"
                    >
                      <RefreshCw className="w-3 h-3" /> Sync
                    </button>
                    <button
                      onClick={() => handleUnlink(link.campaignId)}
                      disabled={unlinksyncingId === link.campaignId}
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-800 px-2 py-1 rounded border border-red-200 hover:bg-red-50 disabled:opacity-50"
                      title="Unlink this campaign"
                    >
                      <Unlink className="w-3 h-3" />
                      {unlinksyncingId === link.campaignId ? '...' : 'Unlink'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Link picker modal */}
      {showPicker && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">Link a campaign</h3>
              <button
                onClick={() => setShowPicker(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-gray-100 space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={candidateQuery}
                    onChange={(e) => handleCandidateSearch(e.target.value)}
                    placeholder="Search by business name, category, or city..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <select
                  value={linkRole}
                  onChange={(e) => setLinkRole(e.target.value as any)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  title="Link role"
                >
                  <option value="primary">primary</option>
                  <option value="sibling">sibling</option>
                  <option value="recovery">recovery</option>
                </select>
              </div>
              <p className="text-xs text-gray-500">
                Candidates are pre-filtered by business name similarity or city+category match.
                If NAP matches with high confidence, linking auto-projects campaign signals.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {candidatesLoading ? (
                <p className="text-sm text-gray-500 text-center py-6">Searching...</p>
              ) : candidates.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">
                  No candidate campaigns found. Try a different search.
                </p>
              ) : (
                candidates.map((c) => (
                  <div
                    key={c.id}
                    className="border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {c.businessName || c.id}
                      </p>
                      <p className="text-xs text-gray-500">
                        {c.category} · {c.city}
                        {c.state ? `, ${c.state}` : ''} · stage: {c.stage}
                        {c.displayId ? ` · ${c.displayId}` : ''}
                      </p>
                    </div>
                    {c.alreadyLinked ? (
                      <span className="text-xs text-gray-400 shrink-0">Already linked</span>
                    ) : (
                      <button
                        onClick={() => handleLink(c.id)}
                        disabled={linkingCampaignId === c.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 shrink-0"
                      >
                        <Link2 className="w-3 h-3" />
                        {linkingCampaignId === c.id ? 'Linking...' : 'Link'}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sync diff modal */}
      {syncLink && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  Sync from campaign
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {syncLink.campaign?.businessName || syncLink.campaignId}
                </p>
              </div>
              <button
                onClick={() => setSyncLink(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {diffLoading ? (
                <p className="text-sm text-gray-500 text-center py-6">Loading diff...</p>
              ) : diff.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">No diff available.</p>
              ) : (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                    <AlertTriangle className="inline w-4 h-4 mr-1" />
                    Selecting a field overwrites the seed listing value with the campaign value
                    and writes a provenance row (source = &lsquo;linked_campaign&rsquo;,
                    confidence = high). Operator-entered seed values will be replaced.
                  </div>
                  <div className="space-y-2">
                    {diff.map((d) => {
                      const fieldLabel = ALL_PROJECTION_FIELDS.find((f) => f.key === d.field)?.label || d.field;
                      const hasCampaignValue = d.campaignValue !== null && d.campaignValue !== undefined && d.campaignValue !== '';
                      return (
                        <label
                          key={d.field}
                          className={`block border rounded-lg p-3 cursor-pointer ${
                            selectedFields.includes(d.field)
                              ? 'border-blue-400 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          } ${!hasCampaignValue ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={selectedFields.includes(d.field)}
                              disabled={!hasCampaignValue}
                              onChange={(e) => {
                                setSelectedFields((prev) =>
                                  e.target.checked
                                    ? [...prev, d.field]
                                    : prev.filter((f) => f !== d.field),
                                );
                              }}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-gray-900">{fieldLabel}</span>
                                {d.changed ? (
                                  <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                    changed
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">no change</span>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <p className="text-gray-500">Campaign:</p>
                                  <p className="text-gray-900 break-words">
                                    {hasCampaignValue
                                      ? typeof d.campaignValue === 'object'
                                        ? JSON.stringify(d.campaignValue).slice(0, 120)
                                        : String(d.campaignValue).slice(0, 200)
                                      : '—'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Seed (current):</p>
                                  <p className="text-gray-900 break-words">
                                    {d.seedValue !== null && d.seedValue !== undefined && d.seedValue !== ''
                                      ? typeof d.seedValue === 'object'
                                        ? JSON.stringify(d.seedValue).slice(0, 120)
                                        : String(d.seedValue).slice(0, 200)
                                      : '—'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">
                {selectedFields.length} field(s) selected
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setSyncLink(null)}
                  className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSync}
                  disabled={syncing || selectedFields.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  {syncing ? 'Syncing...' : `Project ${selectedFields.length} field(s)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
