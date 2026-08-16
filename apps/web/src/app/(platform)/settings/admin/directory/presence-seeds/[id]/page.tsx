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
} from 'lucide-react';

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

  const seed = detail?.seed as any;
  const listing = detail?.listing as any;
  const provenance = detail?.provenance ?? [];
  const claimTokens = detail?.claimTokens ?? [];
  const status = seed?.status ?? '—';
  const canPublish = status === 'draft';
  const canInvite =
    (status === 'published' || status === 'invited') &&
    !claimTokens.some((t) => !t.consumedAt);

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
      {inviteToken && (
        <div className="bg-blue-50 border border-blue-200 px-4 py-3 rounded-lg">
          <p className="text-sm font-medium text-blue-900 mb-1">Claim Link</p>
          <p className="text-sm text-blue-700 break-all font-mono">
            {typeof window !== 'undefined'
              ? `${window.location.origin}/directory/claim/${inviteToken}`
              : `/directory/claim/${inviteToken}`}
          </p>
          <button
            className="mt-2 text-xs text-blue-600 underline"
            onClick={() => {
              if (typeof navigator !== 'undefined' && navigator.clipboard) {
                const link = `${window.location.origin}/directory/claim/${inviteToken}`;
                navigator.clipboard.writeText(link);
              }
            }}
          >
            Copy link
          </button>
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
            href={`/directory/${listing.slug}`}
            target="_blank"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            <ExternalLink className="w-4 h-4" /> View Public Listing
          </Link>
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
                  <th className="py-2 px-3 font-medium">Expires</th>
                  <th className="py-2 px-3 font-medium">Consumed</th>
                  <th className="py-2 px-3 font-medium">Consumed by</th>
                  <th className="py-2 px-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {claimTokens.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100">
                    <td className="py-2 px-3 font-mono text-xs text-gray-700">
                      {t.id}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Edit fields link */}
      <div className="text-sm text-gray-500">
        <FileText className="inline w-4 h-4 mr-1" />
        Field updates (phone, website, SNAP, hours, provenance) are available
        via the admin API.
      </div>
    </div>
  );
}
