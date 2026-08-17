'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import directoryPresenceAdminService, {
  DirectoryPresenceSeedDetail,
} from '@/services/DirectoryPresenceAdminService';
import {
  ArrowLeft,
  Send,
  CheckCircle,
  ExternalLink,
  Clock,
  Tag,
  MapPin,
  Phone,
  Globe,
  ShieldCheck,
  FileText,
  Pencil,
  Save,
  X,
  Plus,
  Trash2,
  Sparkles,
  Ban,
} from 'lucide-react';
import DirectoryCategorySelectorAdapter from '@/components/directory/DirectoryCategorySelectorAdapter';

const PROVENANCE_FIELD_KEYS = [
  'name',
  'address',
  'phone',
  'snap_ebt',
  'hours',
  'specialty_line',
] as const;

interface EditProvenanceRow {
  fieldKey: string;
  value: string;
  sourceName: string;
  sourceUrl: string;
  confidence: 'high' | 'medium' | 'low';
  showOnPublic: boolean;
}

const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

interface DayHours {
  open: string;
  close: string;
  closed: boolean;
}

const EMPTY_HOURS: Record<string, DayHours> = DAYS.reduce((acc, day) => {
  acc[day] = { open: '09:00', close: '18:00', closed: true };
  return acc;
}, {} as Record<string, DayHours>);

function parseHours(raw: any): Record<string, DayHours> {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_HOURS };
  const result: Record<string, DayHours> = { ...EMPTY_HOURS };
  for (const day of DAYS) {
    const d = raw[day];
    if (d && typeof d === 'object') {
      result[day] = {
        open: d.open ?? '09:00',
        close: d.close ?? '18:00',
        closed: d.closed ?? false,
      };
    }
  }
  return result;
}

function formatHoursForDisplay(raw: any): string {
  const hours = parseHours(raw);
  const parts: string[] = [];
  for (const day of DAYS) {
    const h = hours[day];
    if (h.closed) {
      parts.push(`${day[0].toUpperCase()}${day.slice(1)}: Closed`);
    } else {
      parts.push(`${day[0].toUpperCase()}${day.slice(1)}: ${h.open}–${h.close}`);
    }
  }
  return parts.join(' · ');
}

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  published: 'bg-blue-100 text-blue-700',
  invited: 'bg-amber-100 text-amber-700',
  claimed: 'bg-green-100 text-green-700',
  suppressed: 'bg-red-100 text-red-700',
};

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

export default function PresenceSeedDetailPage() {
  const params = useParams();
  const seedId = decodeURIComponent(String(params?.id ?? ''));
  const [detail, setDetail] = useState<DirectoryPresenceSeedDetail | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [savingFields, setSavingFields] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editSnapReported, setEditSnapReported] = useState(false);
  const [editSnapAsOf, setEditSnapAsOf] = useState('');
  const [editSnapSource, setEditSnapSource] = useState('');
  const [editSnapSourceName, setEditSnapSourceName] = useState('');
  const [editProvenance, setEditProvenance] = useState<EditProvenanceRow[]>([]);
  const [editHours, setEditHours] = useState<Record<string, DayHours>>({
    ...EMPTY_HOURS,
  });
  const [editHoursSource, setEditHoursSource] = useState('');
  const [editHoursSourceUrl, setEditHoursSourceUrl] = useState('');
  const [editPrimaryCategory, setEditPrimaryCategory] = useState('');
  const [editSecondaryCategories, setEditSecondaryCategories] = useState<string[]>([]);

  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      const data = await directoryPresenceAdminService.getSeed(seedId);
      setDetail(data);
      if (!data) setError('Seed not found.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load seed detail',
      );
    } finally {
      setLoading(false);
    }
  }, [seedId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handlePublish = async () => {
    setActionError(null);
    setActionSuccess(null);
    try {
      await directoryPresenceAdminService.publishSeed(seedId);
      setActionSuccess('Listing published.');
      fetchDetail();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to publish listing',
      );
    }
  };

  const handleInvite = async () => {
    setActionError(null);
    setActionSuccess(null);
    setInviteToken(null);
    try {
      const result = await directoryPresenceAdminService.inviteSeed(seedId);
      setInviteToken(result.token);
      setActionSuccess(
        'Claim token generated. Share the link below with the business owner.',
      );
      fetchDetail();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to generate invite',
      );
    }
  };

  const [statusDraft, setStatusDraft] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [revokingTokenId, setRevokingTokenId] = useState<string | null>(null);

  const handleStatusChange = async () => {
    if (!statusDraft || statusDraft === status) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      setSavingStatus(true);
      await directoryPresenceAdminService.updateStatus(seedId, statusDraft);
      setActionSuccess(`Status changed to "${statusDraft}".`);
      setStatusDraft('');
      fetchDetail();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to change status',
      );
    } finally {
      setSavingStatus(false);
    }
  };

  const handleRevokeToken = async (tokenId: string) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      setRevokingTokenId(tokenId);
      await directoryPresenceAdminService.revokeToken(seedId, tokenId);
      setActionSuccess('Claim token revoked.');
      fetchDetail();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to revoke token',
      );
    } finally {
      setRevokingTokenId(null);
    }
  };

  const seed = detail?.seed as any;
  const listing = detail?.listing as any;
  const provenance = detail?.provenance ?? [];
  const claimTokens = detail?.claimTokens ?? [];
  const status = seed?.status ?? '—';
  const canPublish = status === 'draft';
  const canInvite =
    (status === 'published' || status === 'invited') &&
    !claimTokens.some((t) => !t.consumedAt);
  const canEdit = status !== 'claimed';

  const startEditing = () => {
    setEditPhone(listing?.phone ?? '');
    setEditWebsite(listing?.website ?? '');
    setEditPrimaryCategory(seed?.category ?? listing?.primary_category ?? '');
    setEditSecondaryCategories(
      Array.isArray(listing?.secondary_categories) ? listing.secondary_categories : [],
    );
    setEditSnapReported(!!listing?.snap_ebt_reported);
    const asOf = listing?.snap_ebt_as_of
      ? new Date(listing.snap_ebt_as_of).toISOString().slice(0, 10)
      : '';
    setEditSnapAsOf(asOf);
    setEditSnapSource(listing?.snap_ebt_source ?? '');
    setEditSnapSourceName(listing?.snap_ebt_source_name ?? '');
    setEditProvenance(
      provenance.map((p) => ({
        fieldKey: p.fieldKey,
        value: p.value ?? '',
        sourceName: p.sourceName ?? '',
        sourceUrl: p.sourceUrl ?? '',
        confidence: (p.confidence ?? 'medium') as 'high' | 'medium' | 'low',
        showOnPublic: !!p.showOnPublic,
      })),
    );
    setEditHours(parseHours(listing?.business_hours));
    const hoursProv = provenance.find((p) => p.fieldKey === 'hours');
    setEditHoursSource(hoursProv?.sourceName ?? '');
    setEditHoursSourceUrl(hoursProv?.sourceUrl ?? '');
    setActionError(null);
    setActionSuccess(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setActionError(null);
  };

  const addEditProvenanceRow = () =>
    setEditProvenance((rows) => [
      ...rows,
      {
        fieldKey: 'hours',
        value: '',
        sourceName: '',
        sourceUrl: '',
        confidence: 'medium',
        showOnPublic: true,
      },
    ]);
  const removeEditProvenanceRow = (idx: number) =>
    setEditProvenance((rows) => rows.filter((_, i) => i !== idx));
  const updateEditProvenanceRow = (
    idx: number,
    patch: Partial<EditProvenanceRow>,
  ) =>
    setEditProvenance((rows) =>
      rows.map((row, i) => (i === idx ? { ...row, ...patch } : row)),
    );

  const handleSaveFields = async () => {
    setActionError(null);
    setActionSuccess(null);
    try {
      setSavingFields(true);
      const fields: any = {
        phone: editPhone.trim() || undefined,
        website: editWebsite.trim() || undefined,
        primaryCategory: editPrimaryCategory.trim() || null,
        secondaryCategories: editSecondaryCategories,
      };

      // Business hours — only include if any day is not closed
      const hasHours = DAYS.some((day) => !editHours[day].closed);
      if (hasHours) {
        const hoursObj: Record<string, DayHours> = {};
        for (const day of DAYS) {
          hoursObj[day] = editHours[day];
        }
        fields.businessHours = hoursObj;
      } else {
        fields.businessHours = null;
      }
      if (editSnapReported !== !!listing?.snap_ebt_reported) {
        fields.snapEbtReported = editSnapReported;
      }
      if (editSnapReported) {
        if (editSnapAsOf) {
          const d = new Date(`${editSnapAsOf}T00:00:00.000Z`);
          fields.snapEbtAsOf = Number.isNaN(d.getTime()) ? null : d;
        } else {
          fields.snapEbtAsOf = null;
        }
        fields.snapEbtSource = editSnapSource.trim() || null;
        fields.snapEbtSourceName = editSnapSourceName.trim() || null;
      } else {
        fields.snapEbtAsOf = null;
        fields.snapEbtSource = null;
        fields.snapEbtSourceName = null;
      }

      const provenanceUpdates = editProvenance
        .filter((row) => row.fieldKey && (row.value || row.sourceName))
        .map((row) => ({
          fieldKey: row.fieldKey,
          value: row.value.trim() || undefined,
          sourceName: row.sourceName.trim() || undefined,
          sourceUrl: row.sourceUrl.trim() || undefined,
          confidence: row.confidence,
          showOnPublic: row.showOnPublic,
        }));

      // Add/replace hours provenance if hours are set and a source is provided
      if (hasHours && (editHoursSource.trim() || editHoursSourceUrl.trim())) {
        // Remove any existing hours row from the list (we replace it)
        const filtered = provenanceUpdates.filter(
          (p) => p.fieldKey !== 'hours',
        );
        filtered.push({
          fieldKey: 'hours',
          value: undefined,
          sourceName: editHoursSource.trim() || undefined,
          sourceUrl: editHoursSourceUrl.trim() || undefined,
          confidence: 'high',
          showOnPublic: true,
        });
        provenanceUpdates.length = 0;
        provenanceUpdates.push(...filtered);
      }

      await directoryPresenceAdminService.updateFields(
        seedId,
        fields,
        provenanceUpdates,
      );
      setActionSuccess('Fields updated.');
      setEditing(false);
      fetchDetail();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to update fields',
      );
    } finally {
      setSavingFields(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Presence Seed"
          backLink={{
            href: '/settings/admin/directory/presence-seeds',
            label: 'Back to seeds',
          }}
        />
        <div className="text-center py-12 text-gray-500">Loading seed...</div>
      </div>
    );
  }

  if (error || !detail || !seed) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Presence Seed"
          backLink={{
            href: '/settings/admin/directory/presence-seeds',
            label: 'Back to seeds',
          }}
        />
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error || 'Seed not found.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={listing?.business_name ?? seed.id}
        description={`Seed ${seed.id} · Tenant ${seed.tenant_id}`}
        backLink={{
          href: '/settings/admin/directory/presence-seeds',
          label: 'Back to seeds',
        }}
        badge={
          <span
            className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
              STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'
            }`}
          >
            {status}
          </span>
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
      {inviteToken && listing?.slug && (
        <div className="bg-blue-50 border border-blue-200 px-4 py-3 rounded-lg space-y-3">
          <div>
            <p className="text-sm font-medium text-blue-900 mb-1">Claim Link</p>
            <p className="text-sm text-blue-700 break-all font-mono">
              {typeof window !== 'undefined'
                ? `${window.location.origin}/place/claim/${inviteToken}`
                : `/place/claim/${inviteToken}`}
            </p>
            <button
              className="mt-2 text-xs text-blue-600 underline"
              onClick={() => {
                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  const link = `${window.location.origin}/place/claim/${inviteToken}`;
                  navigator.clipboard.writeText(link);
                }
              }}
            >
              Copy claim link
            </button>
          </div>
          <div className="border-t border-blue-200 pt-3">
            <p className="text-sm font-medium text-blue-900 mb-1">Retail Preview Link</p>
            <p className="text-xs text-blue-600 mb-1">
              Private preview of the business profile for the owner. Token-gated, not indexed.
            </p>
            <p className="text-sm text-blue-700 break-all font-mono">
              {typeof window !== 'undefined'
                ? `${window.location.origin}/retail/${listing.slug}?preview=${inviteToken}`
                : `/retail/${listing.slug}?preview=${inviteToken}`}
            </p>
            <button
              className="mt-2 text-xs text-blue-600 underline"
              onClick={() => {
                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  const link = `${window.location.origin}/retail/${listing.slug}?preview=${inviteToken}`;
                  navigator.clipboard.writeText(link);
                }
              }}
            >
              Copy preview link
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {canPublish && (
          <button
            onClick={handlePublish}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <CheckCircle className="w-4 h-4" /> Publish Listing
          </button>
        )}
        {canInvite && (
          <button
            onClick={handleInvite}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
          >
            <Send className="w-4 h-4" /> Generate Claim Invite
          </button>
        )}
        {listing?.slug && (
          <Link
            href={`/place/${listing.slug}`}
            target="_blank"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            <ExternalLink className="w-4 h-4" /> View Public Listing
          </Link>
        )}
        {listing?.slug && (
          <Link
            href={`/settings/admin/directory/presence-seeds/${seedId}/retail-preview`}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            <Sparkles className="w-4 h-4" /> Customize Retail Preview
          </Link>
        )}
        {/* Status changer */}
        <div className="inline-flex items-center gap-2">
          <select
            value={statusDraft || status}
            onChange={(e) => setStatusDraft(e.target.value)}
            disabled={savingStatus}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 disabled:opacity-50"
            title="Change seed status"
          >
            <option value="draft">draft</option>
            <option value="published">published</option>
            <option value="invited">invited</option>
            <option value="claimed">claimed</option>
            <option value="suppressed">suppressed</option>
          </select>
          <button
            onClick={handleStatusChange}
            disabled={savingStatus || !statusDraft || statusDraft === status}
            className="inline-flex items-center gap-1 px-3 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            title="Apply status change"
          >
            {savingStatus ? 'Saving...' : 'Set Status'}
          </button>
        </div>
        {canEdit && !editing && (
          <button
            onClick={startEditing}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            <Pencil className="w-4 h-4" /> Edit Fields
          </button>
        )}
        {editing && (
          <>
            <button
              onClick={handleSaveFields}
              disabled={savingFields}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {savingFields ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={cancelEditing}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Listing summary */}
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Listing</h2>
          <dl className="text-sm space-y-2">
            <div className="flex gap-2">
              <Tag className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <dt className="text-gray-500">Primary category</dt>
                <dd className="text-gray-900">{seed.category}</dd>
              </div>
            </div>
            <div className="flex gap-2">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <dt className="text-gray-500">Location</dt>
                <dd className="text-gray-900">
                  {listing?.address}, {listing?.city}, {listing?.state}{' '}
                  {listing?.zip_code}
                </dd>
              </div>
            </div>
            {listing?.phone && (
              <div className="flex gap-2">
                <Phone className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <dt className="text-gray-500">Phone</dt>
                  <dd className="text-gray-900">{listing.phone}</dd>
                </div>
              </div>
            )}
            {listing?.website && (
              <div className="flex gap-2">
                <Globe className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <dt className="text-gray-500">Website</dt>
                  <dd>
                    <a
                      href={listing.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline break-all"
                    >
                      {listing.website}
                    </a>
                  </dd>
                </div>
              </div>
            )}
            {listing?.secondary_categories?.length > 0 && (
              <div>
                <dt className="text-gray-500">Secondary categories</dt>
                <dd className="text-gray-900">
                  {listing.secondary_categories.join(', ')}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-gray-500">Hours</dt>
              <dd className="text-gray-900 text-xs">
                {listing?.business_hours ? (
                  <span>{formatHoursForDisplay(listing.business_hours)}</span>
                ) : (
                  <span className="text-gray-400">
                    Not sourced — omitted from public listing
                  </span>
                )}
              </dd>
            </div>
            <div className="flex gap-2">
              <ShieldCheck className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <dt className="text-gray-500">Identity confidence</dt>
                <dd className="text-gray-900">{seed.identity_confidence}</dd>
              </div>
            </div>
            <div>
              <dt className="text-gray-500">Category fit</dt>
              <dd className="text-gray-900">{seed.category_fit}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Seed batch</dt>
              <dd className="text-gray-900">{seed.seed_batch}</dd>
            </div>
            {seed.notes && (
              <div>
                <dt className="text-gray-500">Notes</dt>
                <dd className="text-gray-900 whitespace-pre-wrap">
                  {seed.notes}
                </dd>
              </div>
            )}
          </dl>
        </section>

        {/* SNAP / EBT + Lifecycle */}
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">
            SNAP / EBT &amp; Lifecycle
          </h2>
          <dl className="text-sm space-y-2">
            <div>
              <dt className="text-gray-500">SNAP/EBT reported</dt>
              <dd className="text-gray-900">
                {listing?.snap_ebt_reported ? 'Yes' : 'No'}
              </dd>
            </div>
            {listing?.snap_ebt_reported && (
              <>
                <div>
                  <dt className="text-gray-500">As of</dt>
                  <dd className="text-gray-900">
                    {formatDate(listing.snap_ebt_as_of)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Source</dt>
                  <dd className="text-gray-900">
                    {listing.snap_ebt_source || '—'}
                    {listing.snap_ebt_source_name
                      ? ` (${listing.snap_ebt_source_name})`
                      : ''}
                  </dd>
                </div>
              </>
            )}
            <div className="pt-2 border-t border-gray-100">
              <dt className="text-gray-500">Created</dt>
              <dd className="text-gray-900">{formatDate(seed.created_at)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Published</dt>
              <dd className="text-gray-900">{formatDate(seed.published_at)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Invited</dt>
              <dd className="text-gray-900">{formatDate(seed.invited_at)}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Claimed</dt>
              <dd className="text-gray-900">{formatDate(seed.claimed_at)}</dd>
            </div>
          </dl>
        </section>
      </div>

      {/* Provenance */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Field Provenance</h2>
        {provenance.length === 0 ? (
          <p className="text-sm text-gray-500">No provenance rows recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600">
                  <th className="py-2 px-3 font-medium">Field</th>
                  <th className="py-2 px-3 font-medium">Value</th>
                  <th className="py-2 px-3 font-medium">Source</th>
                  <th className="py-2 px-3 font-medium">Confidence</th>
                  <th className="py-2 px-3 font-medium">Public</th>
                  <th className="py-2 px-3 font-medium">Accessed</th>
                </tr>
              </thead>
              <tbody>
                {provenance.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className="py-2 px-3 font-medium text-gray-900">
                      {p.fieldKey}
                    </td>
                    <td className="py-2 px-3 text-gray-700">
                      {p.value || '—'}
                    </td>
                    <td className="py-2 px-3 text-gray-700">
                      {p.sourceName || '—'}
                      {p.sourceUrl && (
                        <>
                          {' '}
                          ·{' '}
                          <a
                            href={p.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline break-all"
                          >
                            link
                          </a>
                        </>
                      )}
                    </td>
                    <td className="py-2 px-3 text-gray-700">
                      {p.confidence}
                    </td>
                    <td className="py-2 px-3">
                      {p.showOnPublic ? (
                        <span className="text-green-600">Yes</span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-gray-700">
                      {formatDate(p.accessedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Claim tokens */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Claim Tokens</h2>
        {claimTokens.length === 0 ? (
          <p className="text-sm text-gray-500">
            No claim tokens minted. Use “Generate Claim Invite” to mint one.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600">
                  <th className="py-2 px-3 font-medium">Token ID</th>
                  <th className="py-2 px-3 font-medium">Claim Link</th>
                  <th className="py-2 px-3 font-medium">Expires</th>
                  <th className="py-2 px-3 font-medium">Consumed</th>
                  <th className="py-2 px-3 font-medium">Consumed by</th>
                  <th className="py-2 px-3 font-medium">Created</th>
                  <th className="py-2 px-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {claimTokens.map((t) => {
                  const isActive = !t.consumedAt;
                  const claimUrl =
                    typeof window !== 'undefined' && t.token
                      ? `${window.location.origin}/place/claim/${t.token}`
                      : t.token
                        ? `/place/claim/${t.token}`
                        : '';
                  return (
                    <tr key={t.id} className="border-b border-gray-100">
                      <td className="py-2 px-3 font-mono text-xs text-gray-700">
                        {t.id}
                      </td>
                      <td className="py-2 px-3 text-gray-700">
                        {isActive && t.token ? (
                          <div className="space-y-1">
                            <p className="text-xs text-blue-700 break-all font-mono">
                              {claimUrl}
                            </p>
                            <button
                              className="text-xs text-blue-600 underline"
                              onClick={() => {
                                if (
                                  typeof navigator !== 'undefined' &&
                                  navigator.clipboard &&
                                  typeof window !== 'undefined'
                                ) {
                                  navigator.clipboard.writeText(
                                    `${window.location.origin}/place/claim/${t.token}`,
                                  );
                                }
                              }}
                            >
                              Copy link
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-gray-700">
                        <Clock className="inline w-3 h-3 mr-1 text-gray-400" />
                        {formatDate(t.expiresAt)}
                      </td>
                      <td className="py-2 px-3 text-gray-700">
                        {t.consumedAt ? (
                          formatDate(t.consumedAt)
                        ) : (
                          <span className="text-amber-600">Active</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-gray-700">
                        {t.consumedBy || '—'}
                      </td>
                      <td className="py-2 px-3 text-gray-700">
                        {formatDate(t.createdAt)}
                      </td>
                      <td className="py-2 px-3">
                        {isActive && (
                          <button
                            onClick={() => handleRevokeToken(t.id)}
                            disabled={revokingTokenId === t.id}
                            className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                            title="Revoke this claim token"
                          >
                            <Ban className="w-4 h-4" />
                            {revokingTokenId === t.id ? 'Revoking...' : 'Revoke'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Edit panel */}
      {editing && (
        <section className="bg-white border border-blue-200 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Edit Sourced Fields</h2>
          <p className="text-xs text-gray-500">
            Updates write to the listing and upsert provenance rows. Once a seed
            is claimed, the owner manages these fields.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={editWebsite}
                onChange={(e) => setEditWebsite(e.target.value)}
                placeholder="https://"
              />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Categories</h3>
            <p className="text-xs text-gray-500 mb-3">
              Select from the platform category list (same categories used by the
              tenant directory and GBP settings). The primary category drives the
              /place browse page grouping.
            </p>
            <DirectoryCategorySelectorAdapter
              primary={editPrimaryCategory}
              secondary={editSecondaryCategories}
              onPrimaryChange={setEditPrimaryCategory}
              onSecondaryChange={setEditSecondaryCategories}
            />
          </div>

          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={editSnapReported}
                  onChange={(e) => setEditSnapReported(e.target.checked)}
                />
                SNAP/EBT reported
              </label>
            </div>
            {editSnapReported && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">As of</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={editSnapAsOf}
                    onChange={(e) => setEditSnapAsOf(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={editSnapSource}
                    onChange={(e) => setEditSnapSource(e.target.value)}
                    placeholder="snap_retailer_list"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source name</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={editSnapSourceName}
                    onChange={(e) => setEditSnapSourceName(e.target.value)}
                  />
                </div>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">
              Never infer SNAP/EBT from category labels. Only mark reported when
              sourced from the SNAP retailer list, owner confirmation, or an
              in-store photo reviewed by ops.
            </p>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Business hours</h3>
            <p className="text-xs text-gray-500 mb-3">
              Only set hours when sourced. Unsourced hours are omitted from the
              public listing per the directory presence contract.
            </p>
            <div className="space-y-2">
              {DAYS.map((day) => {
                const h = editHours[day];
                return (
                  <div
                    key={day}
                    className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center"
                  >
                    <div className="md:col-span-3">
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={!h.closed}
                          onChange={(e) =>
                            setEditHours((prev) => ({
                              ...prev,
                              [day]: { ...prev[day], closed: !e.target.checked },
                            }))
                          }
                        />
                        <span className="capitalize">{day}</span>
                      </label>
                    </div>
                    {!h.closed && (
                      <>
                        <div className="md:col-span-4">
                          <input
                            type="time"
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                            value={h.open}
                            onChange={(e) =>
                              setEditHours((prev) => ({
                                ...prev,
                                [day]: { ...prev[day], open: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="md:col-span-1 text-center text-xs text-gray-400">to</div>
                        <div className="md:col-span-4">
                          <input
                            type="time"
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                            value={h.close}
                            onChange={(e) =>
                              setEditHours((prev) => ({
                                ...prev,
                                [day]: { ...prev[day], close: e.target.value },
                              }))
                            }
                          />
                        </div>
                      </>
                    )}
                    {h.closed && (
                      <div className="md:col-span-9 text-sm text-gray-400">Closed</div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Hours source name</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                  value={editHoursSource}
                  onChange={(e) => setEditHoursSource(e.target.value)}
                  placeholder="Google Maps, owner confirmation, etc."
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Hours source URL</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                  value={editHoursSourceUrl}
                  onChange={(e) => setEditHoursSourceUrl(e.target.value)}
                  placeholder="https://"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Provenance rows</h3>
              <button
                type="button"
                onClick={addEditProvenanceRow}
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                <Plus className="w-4 h-4" /> Add row
              </button>
            </div>
            <div className="space-y-3">
              {editProvenance.map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border border-gray-100 rounded-lg p-3"
                >
                  <div className="md:col-span-3">
                    <label className="block text-xs text-gray-500 mb-1">Field</label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                      value={row.fieldKey}
                      onChange={(e) =>
                        updateEditProvenanceRow(idx, { fieldKey: e.target.value })
                      }
                    >
                      {PROVENANCE_FIELD_KEYS.map((k) => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs text-gray-500 mb-1">Value</label>
                    <input
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                      value={row.value}
                      onChange={(e) =>
                        updateEditProvenanceRow(idx, { value: e.target.value })
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Source name</label>
                    <input
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                      value={row.sourceName}
                      onChange={(e) =>
                        updateEditProvenanceRow(idx, { sourceName: e.target.value })
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Source URL</label>
                    <input
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                      value={row.sourceUrl}
                      onChange={(e) =>
                        updateEditProvenanceRow(idx, { sourceUrl: e.target.value })
                      }
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs text-gray-500 mb-1">Confidence</label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm"
                      value={row.confidence}
                      onChange={(e) =>
                        updateEditProvenanceRow(idx, {
                          confidence: e.target.value as 'high' | 'medium' | 'low',
                        })
                      }
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div className="md:col-span-1 flex items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-1 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        checked={row.showOnPublic}
                        onChange={(e) =>
                          updateEditProvenanceRow(idx, {
                            showOnPublic: e.target.checked,
                          })
                        }
                      />
                      Public
                    </label>
                    <button
                      type="button"
                      onClick={() => removeEditProvenanceRow(idx)}
                      className="text-red-500 hover:text-red-700"
                      title="Remove row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {editProvenance.length === 0 && (
                <p className="text-sm text-gray-500">No provenance rows.</p>
              )}
            </div>
          </div>
        </section>
      )}

      {!editing && (
        <div className="text-sm text-gray-500">
          <FileText className="inline w-4 h-4 mr-1" />
          Use “Edit Fields” above to update phone, website, SNAP/EBT, and
          provenance. Once claimed, the owner manages these fields.
        </div>
      )}
    </div>
  );
}
