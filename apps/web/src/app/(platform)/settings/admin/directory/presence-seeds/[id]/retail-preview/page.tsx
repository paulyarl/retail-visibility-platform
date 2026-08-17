'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import directoryPresenceAdminService, {
  DirectoryPresenceSeedDetail,
  InviteResult,
} from '@/services/DirectoryPresenceAdminService';
import {
  ArrowLeft,
  Send,
  ExternalLink,
  Sparkles,
  Copy,
  Check,
  Eye,
  Phone,
  MapPin,
  Clock,
  Tag,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function RetailPreviewCustomizationPage() {
  const params = useParams();
  const router = useRouter();
  const seedId = decodeURIComponent(String(params?.id ?? ''));

  const [detail, setDetail] = useState<DirectoryPresenceSeedDetail | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState<'claim' | 'preview' | null>(null);

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

  const handleInvite = async () => {
    setActionError(null);
    setActionSuccess(null);
    setInviteResult(null);
    try {
      const result = await directoryPresenceAdminService.inviteSeed(seedId);
      setInviteResult(result);
      setActionSuccess('Claim token generated. Preview link is ready below.');
      fetchDetail();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to generate invite',
      );
    }
  };

  const copyToClipboard = (text: string, type: 'claim' | 'preview') => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const seed = detail?.seed as any;
  const listing = detail?.listing as any;
  const claimTokens = detail?.claimTokens ?? [];
  const activeToken = claimTokens.find((t) => !t.consumedAt);
  const status = seed?.status ?? '—';
  const slug = listing?.slug ?? '';
  const isPublished = status === 'published' || status === 'invited';
  const isClaimed = status === 'claimed';

  // Determine the token to use for preview links
  const previewToken = inviteResult?.token ?? activeToken?.token ?? '';
  const origin =
    typeof window !== 'undefined' ? window.location.origin : '';
  const claimLink = previewToken
    ? `${origin}/place/claim/${previewToken}`
    : '';
  const previewLink = previewToken && slug
    ? `${origin}/retail/${slug}?preview=${previewToken}`
    : '';
  const publicLink = slug ? `${origin}/place/${slug}` : '';

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Customize Retail Preview"
          backLink={{
            href: `/settings/admin/directory/presence-seeds/${seedId}`,
            label: 'Back to seed',
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
          title="Customize Retail Preview"
          backLink={{
            href: `/settings/admin/directory/presence-seeds/${seedId}`,
            label: 'Back to seed',
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
        title="Customize Retail Preview"
        description={`${listing?.business_name ?? seed.id} — operator preview & link management`}
        backLink={{
          href: `/settings/admin/directory/presence-seeds/${seedId}`,
          label: 'Back to seed',
        }}
        badge={
          <span
            className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
              isClaimed
                ? 'bg-green-100 text-green-700'
                : isPublished
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700'
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

      {/* Claimed notice */}
      {isClaimed && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-green-900">
                This listing has been claimed
              </h3>
              <p className="text-sm text-green-700 mt-1">
                The owner has accepted the claim and now manages this listing.
                Retail preview links are no longer active. The public listing
                is available at{' '}
                <Link
                  href={`/place/${slug}`}
                  className="underline font-medium"
                >
                  /place/{slug}
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Unpublished notice */}
      {!isPublished && !isClaimed && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-amber-900">
                This seed is not yet published
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                Publish the listing first to generate claim tokens and retail
                preview links. Return to the{' '}
                <Link
                  href={`/settings/admin/directory/presence-seeds/${seedId}`}
                  className="underline font-medium"
                >
                  seed detail page
                </Link>{' '}
                to publish.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Listing summary card */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Listing Summary
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex gap-2">
            <Tag className="w-4 h-4 text-gray-400 mt-0.5" />
            <div>
              <dt className="text-gray-500">Business</dt>
              <dd className="text-gray-900 font-medium">
                {listing?.business_name}
              </dd>
            </div>
          </div>
          <div className="flex gap-2">
            <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
            <div>
              <dt className="text-gray-500">Address</dt>
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
          <div className="flex gap-2">
            <Tag className="w-4 h-4 text-gray-400 mt-0.5" />
            <div>
              <dt className="text-gray-500">Category</dt>
              <dd className="text-gray-900">{seed.category}</dd>
            </div>
          </div>
          {listing?.snap_ebt_reported && (
            <div className="flex gap-2">
              <ShieldCheck className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <dt className="text-gray-500">SNAP/EBT</dt>
                <dd className="text-green-600 font-medium">Reported</dd>
              </div>
            </div>
          )}
          <div>
            <dt className="text-gray-500">Slug</dt>
            <dd className="text-gray-900 font-mono text-xs">{slug}</dd>
          </div>
        </div>
      </section>

      {/* Link management */}
      {!isClaimed && isPublished && (
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Preview &amp; Claim Links
            </h2>
            {!activeToken && !inviteResult && (
              <button
                onClick={handleInvite}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
              >
                <Send className="w-4 h-4" /> Generate Claim Token
              </button>
            )}
          </div>

          {!previewToken && !activeToken && (
            <p className="text-sm text-gray-500">
              No active claim token. Generate one to create preview and claim
              links for the business owner.
            </p>
          )}

          {/* Retail preview link */}
          {previewLink && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <p className="text-sm font-medium text-blue-900">
                      Retail Preview Link
                    </p>
                  </div>
                  <p className="text-xs text-blue-600 mb-2">
                    Token-gated private preview for the business owner. Not
                    indexed. Shows the listing as the owner will see it after
                    claiming.
                  </p>
                  <p className="text-sm text-blue-700 break-all font-mono bg-white/50 rounded px-2 py-1">
                    {previewLink}
                  </p>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => copyToClipboard(previewLink, 'preview')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50"
                  >
                    {copied === 'preview' ? (
                      <>
                        <Check className="w-3 h-3" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy
                      </>
                    )}
                  </button>
                  <Link
                    href={`/retail/${slug}?preview=${previewToken}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50"
                  >
                    <Eye className="w-3 h-3" /> Open
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Claim link */}
          {claimLink && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck className="w-4 h-4 text-green-600" />
                    <p className="text-sm font-medium text-green-900">
                      Claim Link
                    </p>
                  </div>
                  <p className="text-xs text-green-600 mb-2">
                    Share this with the business owner. They&apos;ll register
                    or log in, then accept the claim to take ownership of the
                    listing.
                  </p>
                  <p className="text-sm text-green-700 break-all font-mono bg-white/50 rounded px-2 py-1">
                    {claimLink}
                  </p>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => copyToClipboard(claimLink, 'claim')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-white border border-green-200 rounded-lg hover:bg-green-50"
                  >
                    {copied === 'claim' ? (
                      <>
                        <Check className="w-3 h-3" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy
                      </>
                    )}
                  </button>
                  <Link
                    href={`/place/claim/${previewToken}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-white border border-green-200 rounded-lg hover:bg-green-50"
                  >
                    <ExternalLink className="w-3 h-3" /> Open
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Public listing link */}
          {publicLink && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <ExternalLink className="w-4 h-4 text-gray-500" />
                    <p className="text-sm font-medium text-gray-900">
                      Public Listing
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    The shopper-facing listing page. No token required.
                  </p>
                  <p className="text-sm text-gray-700 break-all font-mono bg-white/50 rounded px-2 py-1">
                    {publicLink}
                  </p>
                </div>
                <Link
                  href={`/place/${slug}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 flex-shrink-0"
                >
                  <Eye className="w-3 h-3" /> Open
                </Link>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Token management */}
      {!isClaimed && (
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">
            Claim Tokens
          </h2>
          {claimTokens.length === 0 ? (
            <p className="text-sm text-gray-500">
              No claim tokens minted yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-600">
                    <th className="py-2 px-3 font-medium">Token</th>
                    <th className="py-2 px-3 font-medium">Expires</th>
                    <th className="py-2 px-3 font-medium">Status</th>
                    <th className="py-2 px-3 font-medium">Consumed by</th>
                    <th className="py-2 px-3 font-medium">Created</th>
                    <th className="py-2 px-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {claimTokens.map((t) => (
                    <tr key={t.id} className="border-b border-gray-100">
                      <td className="py-2 px-3 font-mono text-xs text-gray-700">
                        {t.token?.slice(0, 16)}...
                      </td>
                      <td className="py-2 px-3 text-gray-700">
                        <Clock className="inline w-3 h-3 mr-1 text-gray-400" />
                        {formatDate(t.expiresAt)}
                      </td>
                      <td className="py-2 px-3">
                        {t.consumedAt ? (
                          <span className="text-green-600">Consumed</span>
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
                        {!t.consumedAt && (
                          <button
                            onClick={async () => {
                              setActionError(null);
                              try {
                                await directoryPresenceAdminService.revokeToken(
                                  seedId,
                                  t.id,
                                );
                                setActionSuccess('Token revoked.');
                                fetchDetail();
                              } catch (err) {
                                setActionError(
                                  err instanceof Error
                                    ? err.message
                                    : 'Failed to revoke token',
                                );
                              }
                            }}
                            className="text-xs text-red-600 hover:text-red-800 font-medium"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!activeToken && !inviteResult && isPublished && (
            <button
              onClick={handleInvite}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
            >
              <Send className="w-4 h-4" /> Generate New Token
            </button>
          )}
        </section>
      )}

      {/* Quick links */}
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/settings/admin/directory/presence-seeds/${seedId}`}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Seed Detail
        </Link>
        <Link
          href="/settings/admin/directory/presence-seeds"
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
        >
          <ArrowLeft className="w-4 h-4" /> All Seeds
        </Link>
      </div>
    </div>
  );
}
