'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import directoryPresenceAdminService, {
  ClaimInviteQrKitMeta,
  DirectoryAttributeDefinition,
  DirectoryAttributeRecommendation,
  DirectoryAttributeSuggestion,
  DirectoryListingAttribute,
  DirectoryPresenceSeedDetail,
  OutreachTouch,
} from '@/services/DirectoryPresenceAdminService';
import { clientLogger } from '@/lib/client-logger';
import { generateQrDataUrl } from '@/lib/qr-engine';
import { geocodeAddress } from '@/lib/validation/businessProfile';
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
  QrCode,
  Download,
  Palette,
} from 'lucide-react';
import DirectoryCategorySelectorAdapter from '@/components/directory/DirectoryCategorySelectorAdapter';
import LinkedCampaignsPanel from './LinkedCampaignsPanel';
import ClaimQrDesignerModal from './ClaimQrDesignerModal';
import { slugify } from '@/utils/slug';
import { useDirectoryCategories } from '@/hooks/directory/useDirectoryCategories';

const PROVENANCE_FIELD_KEYS = [
  'name',
  'address',
  'phone',
  'snap_ebt',
  'hours',
  'specialty_line',
  'description',
  'keywords',
  'same_as',
  'secondary_categories',
  'attributes',
] as const;

const DISCLOSURE_SENTENCE =
  ' Listed on VisibleShelf from public information (address, phone). Claim this listing to verify and update details.';

// Display order for attribute picker groups (migration 268). Definitions with
// a group_key outside this list fall into 'other'.
const ATTRIBUTE_GROUPS: Array<{ key: string; label: string }> = [
  { key: 'payments', label: 'Payments accepted' },
  { key: 'accessibility', label: 'Accessibility' },
  { key: 'ownership', label: 'Ownership' },
  { key: 'service_options', label: 'Service options' },
  { key: 'certifications', label: 'Certifications' },
  { key: 'other', label: 'Other' },
];

// Origin labels for scan/audit-sourced attribute suggestions.
const SUGGESTION_ORIGIN_LABELS: Record<string, string> = {
  gold_standard_scan: 'Gold standard scan',
  business_analysis: 'Business audit',
  intelligence_discovery: 'Discovery scan',
};

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

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

function stripDisclosure(text: string | null | undefined): string {
  if (!text) return '';
  return text.endsWith(DISCLOSURE_SENTENCE) ? text.slice(0, -DISCLOSURE_SENTENCE.length) : text;
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

/**
 * Live preview of the exact URL the downloaded PNG/postcard encodes —
 * rendered via the shared qr-engine (classic B/W path, same `qrcode` lib and
 * error-correction level as ClaimInviteQrKitService) so what the operator
 * sees is what scans off the printed card.
 */
function ClaimQrPreview({ url }: { url: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    generateQrDataUrl({
      data: url,
      exportSize: 512,
      styled: false,
      errorCorrection: 'H',
    })
      .then((d) => {
        if (!cancelled) setDataUrl(d);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);
  if (!dataUrl) {
    return (
      <div className="w-28 h-28 rounded border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
        <QrCode className="w-6 h-6 text-gray-300" />
      </div>
    );
  }
  return (
    <img
      src={dataUrl}
      alt="Claim QR preview"
      className="w-28 h-28 rounded border border-gray-200"
    />
  );
}

export default function PresenceSeedDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const seedId = decodeURIComponent(String(params?.id ?? ''));
  const syncCampaignId = searchParams.get('sync') || undefined;
  const [detail, setDetail] = useState<DirectoryPresenceSeedDetail | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteShortCode, setInviteShortCode] = useState<string | null>(null);
  const [qrKit, setQrKit] = useState<ClaimInviteQrKitMeta | null>(null);
  const [qrDownloading, setQrDownloading] = useState<string | null>(null);
  const [copiedQrLink, setCopiedQrLink] = useState<string | null>(null);
  const [qrDesignerVariant, setQrDesignerVariant] = useState<
    'mail' | 'walkin' | 'social' | null
  >(null);
  const [touches, setTouches] = useState<OutreachTouch[]>([]);
  const [touchChannel, setTouchChannel] = useState<
    'call' | 'email' | 'sms' | 'mail' | 'form' | 'referral' | 'visit' | 'other'
  >('call');
  const [touchOutcome, setTouchOutcome] = useState('');
  const [touchNotes, setTouchNotes] = useState('');
  const [loggingTouch, setLoggingTouch] = useState(false);
  const [decidingProposal, setDecidingProposal] = useState<string | null>(null);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [savingFields, setSavingFields] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editSnapReported, setEditSnapReported] = useState(false);
  const [editSnapAsOf, setEditSnapAsOf] = useState('');
  const [editSnapSource, setEditSnapSource] = useState('');
  const [editSnapSourceName, setEditSnapSourceName] = useState('');
  const [editAttributes, setEditAttributes] = useState<DirectoryListingAttribute[]>([]);
  const [attributeDefs, setAttributeDefs] = useState<DirectoryAttributeDefinition[]>([]);
  const [attributeDefsLoading, setAttributeDefsLoading] = useState(false);
  const [attributeSuggestions, setAttributeSuggestions] = useState<DirectoryAttributeSuggestion[]>([]);
  const [attributeRecommendations, setAttributeRecommendations] = useState<DirectoryAttributeRecommendation[]>([]);
  const [attributeSuggestionsLoading, setAttributeSuggestionsLoading] = useState(false);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [editProvenance, setEditProvenance] = useState<EditProvenanceRow[]>([]);
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editZipCode, setEditZipCode] = useState('');
  const [editLatitude, setEditLatitude] = useState('');
  const [editLongitude, setEditLongitude] = useState('');
  const [editHours, setEditHours] = useState<Record<string, DayHours>>({
    ...EMPTY_HOURS,
  });
  const [editTimezone, setEditTimezone] = useState('America/New_York');
  const [editHoursSource, setEditHoursSource] = useState('');
  const [editHoursSourceUrl, setEditHoursSourceUrl] = useState('');
  const [editPrimaryCategory, setEditPrimaryCategory] = useState('');
  const [editSecondaryCategories, setEditSecondaryCategories] = useState<string[]>([]);
  const [editSlug, setEditSlug] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [composedEnrichment, setComposedEnrichment] = useState<any | null>(null);
  const [composedLoading, setComposedLoading] = useState(false);
  const [resettingEnrichment, setResettingEnrichment] = useState(false);

  // Platform category vocabulary — resolves canonical shelf slugs for the
  // public category-page links rendered in the Listing summary.
  const { categories: directoryCategories } = useDirectoryCategories();

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

  const loadQrKit = useCallback(async () => {
    try {
      const kit = await directoryPresenceAdminService.getClaimInviteQrKit(seedId);
      setQrKit(kit);
    } catch (err) {
      clientLogger.error('Failed to load claim QR kit:', { detail: err });
    }
  }, [seedId]);

  const loadTouches = useCallback(async () => {
    try {
      const list = await directoryPresenceAdminService.listOutreachTouches(seedId);
      setTouches(list);
    } catch (err) {
      clientLogger.error('Failed to load outreach touches:', { detail: err });
    }
  }, [seedId]);

  const loadComposed = useCallback(async () => {
    try {
      setComposedLoading(true);
      const result = await directoryPresenceAdminService.getSeedComposed(seedId);
      setComposedEnrichment(result);
    } catch (err) {
      clientLogger.error('Failed to load composed enrichment:', { detail: err });
    } finally {
      setComposedLoading(false);
    }
  }, [seedId]);

  useEffect(() => {
    fetchDetail();
    loadQrKit();
    loadTouches();
  }, [fetchDetail, loadQrKit, loadTouches]);

  useEffect(() => {
    if (seedId) loadComposed();
  }, [seedId, loadComposed]);

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
    setInviteShortCode(null);
    try {
      const result = await directoryPresenceAdminService.inviteSeed(seedId);
      setInviteToken(result.token);
      setInviteShortCode(result.shortCode);
      setActionSuccess(
        'Claim token generated. Share the link below with the business owner.',
      );
      fetchDetail();
      loadQrKit();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to generate invite',
      );
    }
  };

  const handleQrDownload = async (
    variant: 'mail' | 'walkin' | 'social',
    kind: 'png' | 'postcard',
  ) => {
    const key = `${variant}-${kind}`;
    setActionError(null);
    try {
      setQrDownloading(key);
      const blob =
        kind === 'png'
          ? await directoryPresenceAdminService.downloadClaimInvitePng(seedId, variant)
          : await directoryPresenceAdminService.downloadClaimInvitePostcard(seedId, variant);
      if (!blob) throw new Error('Download failed');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        kind === 'png'
          ? `claim-qr-${variant}.png`
          : `claim-postcard-${variant}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to download QR artifact',
      );
    } finally {
      setQrDownloading(null);
    }
  };

  const [statusDraft, setStatusDraft] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [revokingTokenId, setRevokingTokenId] = useState<string | null>(null);
  const [generatingEnrichmentToken, setGeneratingEnrichmentToken] = useState(false);
  const [enrichmentTokenLink, setEnrichmentTokenLink] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
      loadQrKit();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to revoke token',
      );
    } finally {
      setRevokingTokenId(null);
    }
  };

  const handleOutreachStatusChange = async (newStatus: string) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      await directoryPresenceAdminService.updateOutreach(seedId, { status: newStatus });
      setActionSuccess(`Outreach status changed to "${newStatus}".`);
      fetchDetail();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to update outreach status',
      );
    }
  };

  const handleLogTouch = async () => {
    setActionError(null);
    setActionSuccess(null);
    try {
      setLoggingTouch(true);
      const result = await directoryPresenceAdminService.addOutreachTouch(seedId, {
        channel: touchChannel,
        outcome: (touchOutcome || undefined) as any,
        notes: touchNotes.trim() || undefined,
      });
      if (!result) throw new Error('Failed to log touch');
      setActionSuccess(`Touch logged (${touchChannel.replace(/_/g, ' ')}).`);
      setTouchNotes('');
      setTouchOutcome('');
      loadTouches();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to log touch',
      );
    } finally {
      setLoggingTouch(false);
    }
  };

  const handleProposalDecision = async (
    label: string,
    decision: 'accepted' | 'rejected',
  ) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      setDecidingProposal(`${label}:${decision}`);
      await directoryPresenceAdminService.decideProposedCategory(seedId, label, decision);
      setActionSuccess(
        decision === 'accepted'
          ? `"${label}" accepted — registered in the category vocab and added to the listing.`
          : `"${label}" rejected.`,
      );
      fetchDetail();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to decide proposed category',
      );
    } finally {
      setDecidingProposal(null);
    }
  };

  const handleGenerateEnrichmentToken = async () => {
    setActionError(null);
    setActionSuccess(null);
    setEnrichmentTokenLink(null);
    try {
      setGeneratingEnrichmentToken(true);
      const result = await directoryPresenceAdminService.generateEnrichmentToken(seedId);
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const link = `${origin}/directory/enrich/${result.token}`;
      setEnrichmentTokenLink(link);
      setActionSuccess('Enrichment token generated. Copy the link and send it to the owner.');
      fetchDetail();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to generate enrichment token',
      );
    } finally {
      setGeneratingEnrichmentToken(false);
    }
  };

  const handleDeleteSeed = async () => {
    setActionError(null);
    setActionSuccess(null);
    try {
      setDeleting(true);
      await directoryPresenceAdminService.deleteSeed(seedId);
      setActionSuccess('Seed deleted. Redirecting to seed list…');
      // Redirect to the seed list after a short delay so the success message is visible.
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.href = '/settings/admin/directory/presence-seeds';
        }
      }, 800);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to delete seed',
      );
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  const handleResetEnrichment = async () => {
    if (!confirm('Reset description and keywords to the composed market enrichment?')) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      setResettingEnrichment(true);
      const result = await directoryPresenceAdminService.resetSeedOverride(seedId);
      setComposedEnrichment(result);
      setActionSuccess('Enrichment reset to composed market values.');
      fetchDetail();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to reset enrichment',
      );
    } finally {
      setResettingEnrichment(false);
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
  // Claimed seeds have been promoted to a real customer relationship — refuse
  // to delete them from the UI to prevent destroying customer data.
  const canDelete = status !== 'claimed';

  // Claim QR kit variants — one tracked redirect URL per delivery channel.
  // Shared by the artifact cards and the QR designer modal.
  const qrVariants = qrKit
    ? [
        {
          variant: 'mail' as const,
          title: 'Mail postcard',
          desc: 'Mailed 4×6 invite — scans record as claim_invite.',
          url: qrKit.qrUrl,
          postcard: true,
        },
        {
          variant: 'walkin' as const,
          title: 'Walk-in leave-behind',
          desc: 'Hand-delivered card — scans record as claim_invite_walkin.',
          url: qrKit.qrUrlWalkin,
          postcard: true,
        },
        {
          variant: 'social' as const,
          title: 'Social / DM link',
          desc: 'Send the tracked link in a DM or post — taps record as claim_invite_social.',
          url: qrKit.qrUrlSocial,
          postcard: false,
        },
      ]
    : [];
  const qrDesignerConfig = qrDesignerVariant
    ? qrVariants.find((v) => v.variant === qrDesignerVariant) ?? null
    : null;

  // Public shelf page for a category name. Unclaimed seeds render on
  // /place/category shelves (primary + secondaries); claiming flips
  // listing_origin to 'claimed' and moves the listing onto
  // /directory/categories shelves. Canonical platform_categories slugs are
  // required by the /directory surface; the /place endpoint also resolves
  // name-derived slugs, so slugify() is a safe fallback for unregistered
  // labels.
  const categoryShelfHref = (categoryName: string): string => {
    if (!categoryName) return '#';
    const canonical = directoryCategories.find(
      (c) => c.name.trim().toLowerCase() === categoryName.trim().toLowerCase(),
    )?.slug;
    const slug = canonical || slugify(categoryName);
    if (status === 'claimed') {
      return `/directory/categories/${slug}`;
    }
    const cityQs = listing?.city
      ? `?city=${encodeURIComponent(listing.city)}${
          listing.state ? `&state=${encodeURIComponent(listing.state)}` : ''
        }`
      : '';
    return `/place/category/${slug}${cityQs}`;
  };

  // City shelf page — /place/city/{city-slug} for unclaimed seeds,
  // /directory/location/{city}-{state} once claimed (that surface needs a
  // state segment to parse, so no link without one).
  const cityShelf =
    status === 'claimed'
      ? listing?.city && listing?.state
        ? `/directory/location/${slugify(listing.city)}-${slugify(listing.state)}`
        : null
      : listing?.city
        ? `/place/city/${slugify(listing.city)}`
        : null;

  const handleGetCoordinates = async () => {
    if (!editAddress.trim() || !editCity.trim() || !editZipCode.trim()) {
      setActionError('Please fill in address, city, and ZIP code before geocoding.');
      return;
    }

    setGeocoding(true);
    setActionError(null);

    try {
      const coordinates = await geocodeAddress({
        address_line1: editAddress,
        city: editCity,
        state: editState,
        postal_code: editZipCode,
        country_code: 'US',
      });

      if (coordinates) {
        setEditLatitude(String(coordinates.latitude));
        setEditLongitude(String(coordinates.longitude));
      } else {
        setActionError('Could not find coordinates for this address. Please check the address and try again.');
      }
    } catch (err) {
      clientLogger.error('Failed to geocode seed address:', { detail: err });
      setActionError(err instanceof Error ? err.message : 'Failed to geocode address.');
    } finally {
      setGeocoding(false);
    }
  };

  const startEditing = () => {
    setEditPhone(listing?.phone ?? '');
    setEditWebsite(listing?.website ?? '');
    setEditDescription(stripDisclosure(listing?.description));
    setEditPrimaryCategory(seed?.category ?? listing?.primary_category ?? '');
    setEditSecondaryCategories(
      Array.isArray(listing?.secondary_categories) ? listing.secondary_categories : [],
    );
    setEditSlug(listing?.slug ?? '');
    setEditAddress(listing?.address ?? '');
    setEditCity(listing?.city ?? '');
    setEditState(listing?.state ?? '');
    setEditZipCode(listing?.zip_code ?? '');
    setEditLatitude(listing?.latitude != null ? String(listing.latitude) : '');
    setEditLongitude(listing?.longitude != null ? String(listing.longitude) : '');
    setEditSnapReported(!!listing?.snap_ebt_reported);
    const asOf = listing?.snap_ebt_as_of
      ? new Date(listing.snap_ebt_as_of).toISOString().slice(0, 10)
      : '';
    setEditSnapAsOf(asOf);
    setEditSnapSource(listing?.snap_ebt_source ?? '');
    setEditSnapSourceName(listing?.snap_ebt_source_name ?? '');
    setEditAttributes(
      Array.isArray(listing?.attributes) ? listing.attributes.map((a: any) => ({ ...a })) : [],
    );
    // Category-aware attribute presets — universal definitions always return;
    // category-specific ones match the seed's primary category (name or slug).
    setAttributeDefsLoading(true);
    directoryPresenceAdminService
      .listAttributeDefinitions(seed?.category ?? listing?.primary_category ?? '')
      .then((defs) => setAttributeDefs(defs))
      .catch(() => setAttributeDefs([]))
      .finally(() => setAttributeDefsLoading(false));
    // Scan/audit-sourced suggestions — gold-standard scans, business audits,
    // and discovery scans linked to this seed or sharing its category.
    setAttributeSuggestionsLoading(true);
    setDismissedSuggestions(new Set());
    directoryPresenceAdminService
      .listAttributeSuggestions(seedId)
      .then((r) => {
        setAttributeSuggestions(r.suggestions);
        setAttributeRecommendations(r.recommendations);
      })
      .catch(() => {
        setAttributeSuggestions([]);
        setAttributeRecommendations([]);
      })
      .finally(() => setAttributeSuggestionsLoading(false));
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
    setEditTimezone(listing?.business_hours?.timezone || 'America/New_York');
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

  const updateAttribute = (idx: number, patch: Partial<DirectoryListingAttribute>) =>
    setEditAttributes((attrs) => attrs.map((a, i) => (i === idx ? { ...a, ...patch } : a)));

  const removeAttribute = (idx: number) =>
    setEditAttributes((attrs) => attrs.filter((_, i) => i !== idx));

  const toggleAttribute = (def: DirectoryAttributeDefinition) =>
    setEditAttributes((attrs) =>
      attrs.some((a) => a.key === def.attributeKey)
        ? attrs.filter((a) => a.key !== def.attributeKey)
        : [...attrs, { key: def.attributeKey, label: def.label }],
    );

  const addCustomAttribute = () =>
    setEditAttributes((attrs) => [...attrs, { key: '', label: '' }]);

  // Accept a scan/audit-sourced suggestion — carries the analyst-recorded
  // evidence (source platform + URL + as_of) onto the attribute entry.
  const acceptSuggestion = (s: DirectoryAttributeSuggestion) =>
    setEditAttributes((attrs) =>
      attrs.some((a) => a.key === s.key)
        ? attrs
        : [
            ...attrs,
            {
              key: s.matchedDefinitionKey || s.key,
              label: s.label,
              sourcePlatform: s.sourcePlatform || undefined,
              sourceUrl: s.sourceUrl || undefined,
              asOf: s.asOf || undefined,
            },
          ],
    );

  const dismissSuggestion = (key: string) =>
    setDismissedSuggestions((prev) => new Set(dismissedSuggestions).add(key));

  // Accept an advisory audit recommendation — no observed evidence exists,
  // so the chip is stamped as an audit recommendation (not a sourced
  // observation) unless the operator overrides the source fields below.
  const acceptRecommendation = (r: DirectoryAttributeRecommendation) =>
    setEditAttributes((attrs) =>
      attrs.some((a) => a.key === (r.matchedDefinitionKey || r.key))
        ? attrs
        : [
            ...attrs,
            {
              key: r.matchedDefinitionKey || r.key,
              label: r.label,
              sourcePlatform: 'audit_recommendation',
            },
          ],
    );

  const handleSaveFields = async () => {
    setActionError(null);
    setActionSuccess(null);
    try {
      setSavingFields(true);
      const fields: any = {
        phone: editPhone.trim() || undefined,
        website: editWebsite.trim() || undefined,
        description: editDescription.trim() || null,
        primaryCategory: editPrimaryCategory.trim() || null,
        secondaryCategories: editSecondaryCategories,
        address: editAddress.trim() || undefined,
        city: editCity.trim() || undefined,
        state: editState.trim() || undefined,
        zipCode: editZipCode.trim() || null,
        latitude: editLatitude.trim() && !Number.isNaN(Number(editLatitude)) ? Number(editLatitude) : null,
        longitude: editLongitude.trim() && !Number.isNaN(Number(editLongitude)) ? Number(editLongitude) : null,
        slug: editSlug.trim() || null,
      };

      // Business hours — only include if any day is not closed
      const hasHours = DAYS.some((day) => !editHours[day].closed);
      if (hasHours) {
        const hoursObj: Record<string, DayHours> = {};
        for (const day of DAYS) {
          hoursObj[day] = editHours[day];
        }
        fields.businessHours = { ...hoursObj, timezone: editTimezone };
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

      // Sourced attributes — serialize the structured picker state. Each
      // attribute carries its own evidence; never inferred from category labels.
      let attributesSource: { sourceName?: string; sourceUrl?: string } | null = null;
      const cleanedAttributes = editAttributes
        .map((a) => ({
          key: (a.key || '').trim(),
          label: (a.label || '').trim(),
          sourcePlatform: (a.sourcePlatform || '').trim() || undefined,
          sourceUrl: (a.sourceUrl || '').trim() || undefined,
          asOf: (a.asOf || '').trim() || undefined,
        }))
        .filter((a) => a.key || a.label);
      for (const a of cleanedAttributes) {
        if (!a.key || !a.label) {
          throw new Error('Each attribute requires a key and a label.');
        }
        if (a.sourceUrl && !/^https?:\/\//i.test(a.sourceUrl)) {
          throw new Error(`Attribute "${a.label}" has an invalid source URL (must start with http:// or https://).`);
        }
      }
      if (new Set(cleanedAttributes.map((a) => a.key)).size !== cleanedAttributes.length) {
        throw new Error('Attribute keys must be unique.');
      }
      fields.attributes = cleanedAttributes.length > 0 ? cleanedAttributes : null;
      const firstSource = cleanedAttributes.find((a) => a.sourcePlatform || a.sourceUrl);
      if (firstSource) {
        attributesSource = {
          sourceName: firstSource.sourcePlatform || undefined,
          sourceUrl: firstSource.sourceUrl || undefined,
        };
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

      // Add/replace description provenance when the operator overrides description
      if (editDescription.trim()) {
        const filtered = provenanceUpdates.filter(
          (p) => p.fieldKey !== 'description',
        );
        filtered.push({
          fieldKey: 'description',
          value: editDescription.trim(),
          sourceName: 'operator_override',
          sourceUrl: undefined,
          confidence: 'high',
          showOnPublic: true,
        });
        provenanceUpdates.length = 0;
        provenanceUpdates.push(...filtered);
      }

      // Add/replace attributes provenance when sourced attributes are set
      if (fields.attributes !== undefined && fields.attributes !== null) {
        const filtered = provenanceUpdates.filter(
          (p) => p.fieldKey !== 'attributes',
        );
        filtered.push({
          fieldKey: 'attributes',
          value: undefined,
          sourceName: attributesSource?.sourceName || 'operator_override',
          sourceUrl: attributesSource?.sourceUrl || undefined,
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
            {inviteShortCode && (
              <div className="mb-2">
                <p className="text-xs text-blue-600 mb-0.5">Short link (preferred for SMS / DM)</p>
                <p className="text-sm text-blue-700 break-all font-mono">
                  {typeof window !== 'undefined'
                    ? `${window.location.origin}/c/${inviteShortCode}`
                    : `/c/${inviteShortCode}`}
                </p>
                <button
                  className="mt-1 text-xs text-blue-600 underline"
                  onClick={() => {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      const link = `${window.location.origin}/c/${inviteShortCode}`;
                      navigator.clipboard.writeText(link);
                    }
                  }}
                >
                  Copy short link
                </button>
              </div>
            )}
            <p className="text-xs text-blue-600 mb-0.5">Full link</p>
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
        {listing?.slug && status === 'published' ? (
          <Link
            href={`/place/${listing.slug}`}
            target="_blank"
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            <ExternalLink className="w-4 h-4" /> View Public Listing
          </Link>
        ) : listing?.slug ? (
          <span
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed"
            title="Publish the listing before viewing the public page"
          >
            <ExternalLink className="w-4 h-4" /> View Public Listing
          </span>
        ) : null}
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
        {canDelete && !editing && (
          <button
            onClick={() => setConfirmingDelete(true)}
            disabled={deleting}
            className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50"
            title="Permanently delete this seed and its tenant"
          >
            <Trash2 className="w-4 h-4" /> Delete Seed
          </button>
        )}
      </div>

      {/* Delete confirmation modal */}
      {confirmingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">Delete this seed?</h2>
            <p className="mt-2 text-sm text-gray-600">
              This permanently deletes the seed, its directory listing, the seed
              tenant, and all related claim tokens, provenance, and campaign
              links. This cannot be undone.
            </p>
            <p className="mt-2 text-sm text-gray-900 font-medium">
              {listing?.business_name ?? seed.id}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSeed}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Listing summary */}
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Listing</h2>
          <dl className="text-sm space-y-2">
            <div className="flex gap-2">
              <Tag className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <dt className="text-gray-500">Primary category</dt>
                <dd className="text-gray-900">
                  <Link
                    href={categoryShelfHref(seed.category)}
                    target="_blank"
                    title="Open the public category shelf page"
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    {seed.category}
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </dd>
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
            {cityShelf && (
              <div className="flex gap-2">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <dt className="text-gray-500">City shelf</dt>
                  <dd className="text-gray-900">
                    <Link
                      href={cityShelf}
                      target="_blank"
                      title="Open the public city shelf page"
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                    >
                      {listing.city}
                      {listing.state ? `, ${listing.state}` : ''}
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </dd>
                </div>
              </div>
            )}
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
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {listing.secondary_categories.map((cat: string) => (
                    <Link
                      key={cat}
                      href={categoryShelfHref(cat)}
                      target="_blank"
                      title={`Open the public "${cat}" shelf page`}
                      className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700"
                    >
                      {cat}
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  ))}
                  {(status === 'draft' || status === 'suppressed') && (
                    <span className="text-xs text-gray-400 self-center">
                      Listing appears on these shelves once published.
                    </span>
                  )}
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

      {/* Owner verification (migration 274) — the consent-of-record plus
          owner-proposed categories awaiting operator acceptance */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Owner Verification</h2>
        {seed.owner_verified_at ? (
          <p className="text-sm text-gray-700">
            Owner confirmed their categories and attributes at claim submit on{' '}
            {formatDate(seed.owner_verified_at)}
            {seed.owner_verification?.confirmedBy
              ? ` (claimant ${seed.owner_verification.confirmedBy})`
              : ''}
            . Confirmed fields carry provenance{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">owner_claim</code>{' '}
            and the category fit is marked verified.
          </p>
        ) : (
          <p className="text-sm text-gray-500">
            Not yet verified — the owner is asked to confirm categories and
            attributes on the claim page before the claim can be submitted.
          </p>
        )}

        {Array.isArray(seed.owner_proposed_categories) &&
          seed.owner_proposed_categories.length > 0 && (
            <div className="pt-2 space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">
                Owner-proposed categories
              </h3>
              <p className="text-xs text-gray-500">
                Labels the owner typed that aren&apos;t in the category vocab.
                Nothing is published until accepted — accept registers the
                label in the vocab and adds it to the listing.
              </p>
              <ul className="divide-y divide-gray-100">
                {seed.owner_proposed_categories.map((p: any) => (
                  <li
                    key={p.label}
                    className="py-2 flex items-center justify-between gap-3"
                  >
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        {p.label}
                      </span>
                      <span className="ml-2 text-xs text-gray-500">
                        {p.role === 'primary' ? 'primary' : 'secondary'} ·{' '}
                        proposed {formatDate(p.proposed_at)}
                      </span>
                    </div>
                    {p.status === 'pending' ? (
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleProposalDecision(p.label, 'accepted')}
                          disabled={decidingProposal !== null}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-50"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          {decidingProposal === `${p.label}:accepted`
                            ? 'Accepting…'
                            : 'Accept'}
                        </button>
                        <button
                          onClick={() => handleProposalDecision(p.label, 'rejected')}
                          disabled={decidingProposal !== null}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                          {decidingProposal === `${p.label}:rejected`
                            ? 'Rejecting…'
                            : 'Reject'}
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`text-xs font-medium ${
                          p.status === 'accepted'
                            ? 'text-green-600'
                            : 'text-red-500'
                        }`}
                      >
                        {p.status}
                        {p.decided_at ? ` · ${formatDate(p.decided_at)}` : ''}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
      </section>

      {/* Claim tokens */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Claim Tokens</h2>
        {claimTokens.length === 0 ? (
          <p className="text-sm text-gray-500">
            {status === 'draft' || status === 'suppressed'
              ? 'No claim tokens minted. Publish the listing first, then use “Generate Claim Invite” to mint one.'
              : 'No claim tokens minted. Use “Generate Claim Invite” to mint one.'}
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
                  const shortUrl =
                    t.shortCode && typeof window !== 'undefined'
                      ? `${window.location.origin}/c/${t.shortCode}`
                      : t.shortCode
                        ? `/c/${t.shortCode}`
                        : null;
                  return (
                    <tr key={t.id} className="border-b border-gray-100">
                      <td className="py-2 px-3 font-mono text-xs text-gray-700">
                        {t.id}
                      </td>
                      <td className="py-2 px-3 text-gray-700">
                        {isActive && t.token ? (
                          <div className="space-y-1">
                            {shortUrl && (
                              <div>
                                <p className="text-xs text-blue-700 break-all font-mono">
                                  {shortUrl}
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
                                        `${window.location.origin}/c/${t.shortCode}`,
                                      );
                                    }
                                  }}
                                >
                                  Copy short link
                                </button>
                              </div>
                            )}
                            <p className="text-xs text-gray-400 break-all font-mono">
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
                              Copy full link
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

      {/* Claim QR Kit — tracked-scan artifacts, one variant per delivery channel */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Claim QR Kit</h2>
            <p className="text-xs text-gray-500 mt-1">
              Each artifact encodes a tracked redirect, so scans are recorded
              before the owner lands on the claim page. Print the mail variant
              on postcards, the walk-in variant on leave-behind cards, and send
              the social variant as a DM/share link — all three stay separate
              in QR analytics.
            </p>
          </div>
          <QrCode className="w-5 h-5 text-gray-400 shrink-0" />
        </div>

        {!qrKit ? (
          <p className="text-sm text-gray-500">
            {status === 'draft' || status === 'suppressed'
              ? 'No active claim token — publish the listing first, then use “Generate Claim Invite” to mint one.'
              : 'No active claim token — use “Generate Claim Invite” above to mint one.'}{' '}
            QR artifacts are available once a token exists.
          </p>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {qrVariants.map((v) => (
              <div
                key={v.variant}
                className="border border-gray-200 rounded-lg p-4 space-y-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{v.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{v.desc}</p>
                </div>
                <div className="flex justify-center">
                  <ClaimQrPreview url={v.url} />
                </div>
                <p className="text-xs font-mono text-gray-600 break-all bg-gray-50 rounded px-2 py-1.5">
                  {v.url}
                </p>
                <div className="flex flex-wrap gap-2">
                  {v.variant === 'social' && (
                    <button
                      onClick={() => {
                        if (typeof navigator !== 'undefined' && navigator.clipboard) {
                          navigator.clipboard.writeText(v.url);
                          setCopiedQrLink(v.variant);
                          setTimeout(() => setCopiedQrLink(null), 2000);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50"
                    >
                      {copiedQrLink === v.variant ? 'Copied' : 'Copy link'}
                    </button>
                  )}
                  <button
                    onClick={() => setQrDesignerVariant(v.variant)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50"
                    title="Open the styled QR designer — templates, colors, platform logo"
                  >
                    <Palette className="w-3.5 h-3.5" />
                    Design
                  </button>
                  <button
                    onClick={() => handleQrDownload(v.variant, 'png')}
                    disabled={qrDownloading !== null}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {qrDownloading === `${v.variant}-png` ? 'Downloading…' : 'QR PNG'}
                  </button>
                  {v.postcard && (
                    <button
                      onClick={() => handleQrDownload(v.variant, 'postcard')}
                      disabled={qrDownloading !== null}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      {qrDownloading === `${v.variant}-postcard`
                        ? 'Downloading…'
                        : 'Postcard PDF'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {qrDesignerConfig && (
        <ClaimQrDesignerModal
          open
          onClose={() => setQrDesignerVariant(null)}
          seedId={seedId}
          variant={qrDesignerConfig.variant}
          title={qrDesignerConfig.title}
          url={qrDesignerConfig.url}
          allowPostcard={qrDesignerConfig.postcard}
        />
      )}

      {/* Outreach & Enrichment */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Outreach & Enrichment</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Outreach Status
            </label>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              seed?.outreachStatus === 'enriched' ? 'bg-green-50 text-green-700 border border-green-200' :
              seed?.outreachStatus === 'enrichment_sent' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
              seed?.outreachStatus === 'verified_by_call' || seed?.outreachStatus === 'verified_by_email' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
              seed?.outreachStatus === 'outreach_attempted' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
              'bg-gray-50 text-gray-700 border border-gray-200'
            }`}>
              {seed?.outreachStatus || 'unverified'}
            </span>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Outreach State (Courtesy Window)
            </label>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              seed?.outreach_state === 'outreach_scheduled' ? 'bg-cyan-50 text-cyan-700 border border-cyan-200' :
              seed?.outreach_state === 'owner_contacted' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
              seed?.outreach_state === 'freshness_verified' ? 'bg-teal-50 text-teal-700 border border-teal-200' :
              seed?.outreach_state === 'freshness_failed' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
              seed?.outreach_state === 'no_response' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
              seed?.outreach_state === 'claimed' ? 'bg-green-50 text-green-700 border border-green-200' :
              seed?.outreach_state === 'suppressed' ? 'bg-red-50 text-red-700 border border-red-200' :
              'bg-gray-50 text-gray-700 border border-gray-200'
            }`}>
              {(seed?.outreach_state || 'not_started').replace(/_/g, ' ')}
            </span>
            {seed?.outreach_scheduled_at && (
              <p className="text-xs text-gray-500 mt-1">
                Scheduled: {formatDate(seed.outreach_scheduled_at)}
              </p>
            )}
            {seed?.outreach_state_entered_at && (
              <p className="text-xs text-gray-500">
                Entered: {formatDate(seed.outreach_state_entered_at)}
              </p>
            )}
          </div>
          {seed?.owner_name && (
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Owner Name
              </label>
              <p className="text-sm text-gray-900">{seed.owner_name}</p>
            </div>
          )}
          {seed?.owner_email && (
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Owner Email
              </label>
              <p className="text-sm text-gray-900">{seed.owner_email}</p>
            </div>
          )}
          {seed?.owner_phone && (
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Owner Phone
              </label>
              <p className="text-sm text-gray-900">{seed.owner_phone}</p>
            </div>
          )}
          {(seed?.owner_name || seed?.owner_email || seed?.owner_phone) && (
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Contact Consent
              </label>
              <p className={`text-sm ${seed.owner_contact_consent ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
                {seed.owner_contact_consent ? 'Yes — OK to contact owner' : 'Not given — do not contact'}
              </p>
            </div>
          )}
        </div>

        {seed?.outreachNotes && (
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Outreach Notes
            </label>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{seed.outreachNotes}</p>
          </div>
        )}

        {/* Quick status actions */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
          <button
            onClick={() => handleOutreachStatusChange('outreach_attempted')}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
          >
            Log Outreach Attempt
          </button>
          <button
            onClick={() => handleOutreachStatusChange('verified_by_call')}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
          >
            Mark Verified (Call)
          </button>
          <button
            onClick={handleGenerateEnrichmentToken}
            disabled={generatingEnrichmentToken}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-50"
          >
            {generatingEnrichmentToken ? 'Generating...' : 'Send Enrichment Link'}
          </button>
        </div>

        {enrichmentTokenLink && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs font-medium text-blue-900 mb-1">Enrichment Link (copy and send to owner):</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-blue-700 bg-white px-2 py-1 rounded border border-blue-200 break-all">
                {enrichmentTokenLink}
              </code>
              <button
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    navigator.clipboard.writeText(enrichmentTokenLink);
                  }
                }}
                className="px-2 py-1 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Copy
              </button>
            </div>
          </div>
        )}

        {/* Per-touch log — feeds the funnel CAC numerator. 'visit' covers
            same-town walk-ins (leave-behind QR cards). */}
        <div className="pt-3 border-t border-gray-100 space-y-3">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
            Log a touch
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={touchChannel}
              onChange={(e) => setTouchChannel(e.target.value as typeof touchChannel)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-700"
              title="Touch channel"
            >
              <option value="call">call</option>
              <option value="email">email</option>
              <option value="sms">sms</option>
              <option value="mail">mail</option>
              <option value="form">form</option>
              <option value="referral">referral</option>
              <option value="visit">visit</option>
              <option value="other">other</option>
            </select>
            <select
              value={touchOutcome}
              onChange={(e) => setTouchOutcome(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-700"
              title="Outcome (optional)"
            >
              <option value="">outcome…</option>
              {[
                'connected', 'no_response', 'no_answer', 'no_reply', 'voicemail',
                'bad_number', 'bounce', 'unread', 'read_no_reply', 'form_submitted',
                'referral_asked', 'claimed', 'not_interested',
              ].map((o) => (
                <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <input
              type="text"
              value={touchNotes}
              onChange={(e) => setTouchNotes(e.target.value)}
              placeholder="Notes (optional)"
              className="flex-1 min-w-[160px] border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-gray-700"
            />
            <button
              onClick={handleLogTouch}
              disabled={loggingTouch}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-700 text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {loggingTouch ? 'Logging…' : 'Log touch'}
            </button>
          </div>
          {touches.length > 0 && (
            <div className="space-y-1">
              {touches.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center gap-3 text-xs text-gray-600">
                  <span className="font-medium text-gray-800 w-16">{t.channel}</span>
                  <span className="w-24">{t.outcome?.replace(/_/g, ' ') || '—'}</span>
                  <span className="text-gray-400">{formatDate(t.occurredAt)}</span>
                  {t.notes && <span className="truncate text-gray-500">{t.notes}</span>}
                </div>
              ))}
              {touches.length > 5 && (
                <p className="text-xs text-gray-400">+{touches.length - 5} more</p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Composed Enrichment (Phase 4) */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Composed enrichment</h2>
          <button
            onClick={handleResetEnrichment}
            disabled={resettingEnrichment || composedLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {resettingEnrichment ? 'Resetting…' : 'Reset to composed'}
          </button>
        </div>
        {composedLoading ? (
          <p className="text-sm text-gray-500">Loading composed enrichment…</p>
        ) : composedEnrichment ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Composed description (read-only)
              </label>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-mono whitespace-pre-wrap">
                {composedEnrichment.packet?.description || '—'}
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-gray-500">
              <span>
                Source: <span className="font-medium text-gray-700">{composedEnrichment.sourceName || 'none'}</span>
              </span>
              <span>
                Last composed: {formatDate(composedEnrichment.composedAt)}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No composed enrichment available.</p>
        )}
      </section>

      {/* Linked Campaigns (Migration 230) */}
      <LinkedCampaignsPanel
        seedId={seedId}
        canEdit={canEdit}
        seedCategory={seed?.category}
        seedBusinessName={listing?.business_name}
        autoSyncCampaignId={syncCampaignId}
      />

      {/* Edit panel */}
      {editing && (
        <section className="bg-white border border-blue-200 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Edit Sourced Fields</h2>
          <p className="text-xs text-gray-500">
            Updates write to the listing and upsert provenance rows. Once a seed
            is claimed, the owner manages these fields.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Public Slug</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={editSlug}
                onChange={(e) => setEditSlug(e.target.value)}
                maxLength={80}
                placeholder="your-business-slug"
              />
              <p className="text-xs text-gray-500 mt-1">
                Used in the public URL (/place/your-slug). Left empty, the current slug is kept.
              </p>
            </div>
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
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (overrides composed enrichment)
              </label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                rows={4}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                maxLength={500}
                placeholder="Operator-written description. The disclosure sentence is appended on save."
              />
              <p className="text-xs text-gray-500 mt-1">
                {editDescription.length}/500 characters. The disclosure sentence is appended when saved.
              </p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Location</h3>
            <p className="text-xs text-gray-500 mb-3">
              Street address, city, state, and ZIP are used for the public listing and map.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Street address</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={editState}
                  onChange={(e) => setEditState(e.target.value)}
                >
                  <option value="">Select state</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={editZipCode}
                  onChange={(e) => setEditZipCode(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={editLatitude}
                  onChange={(e) => setEditLatitude(e.target.value)}
                  placeholder="39.7684"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={editLongitude}
                  onChange={(e) => setEditLongitude(e.target.value)}
                  placeholder="-86.1581"
                />
              </div>
              <div className="md:col-span-2 flex items-end">
                <button
                  type="button"
                  onClick={handleGetCoordinates}
                  disabled={geocoding}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-60"
                >
                  {geocoding ? 'Geocoding…' : 'Get Coordinates'}
                </button>
              </div>
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
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Sourced attributes</h3>
            <p className="text-xs text-gray-500 mb-3">
              Toggle the attribute chips that apply — the preset list is filtered to the
              seed&apos;s primary category. Each attribute carries its own evidence
              (source platform, URL, as-of date); never inferred from category labels.
              SNAP/EBT stays in its dedicated fields above.
            </p>

            {attributeDefsLoading ? (
              <p className="text-xs text-gray-400 italic">Loading attribute presets…</p>
            ) : (
              <div className="space-y-3">
                {/* Scan/audit-sourced suggestions — one-click accept with evidence */}
                {attributeSuggestionsLoading ? (
                  <p className="text-xs text-gray-400 italic">Loading suggestions from scans & audits…</p>
                ) : (() => {
                  const visible = attributeSuggestions.filter(
                    (s) =>
                      !dismissedSuggestions.has(s.key) &&
                      !editAttributes.some((a) => a.key === (s.matchedDefinitionKey || s.key)),
                  );
                  if (visible.length === 0) return null;
                  return (
                    <div className="border border-blue-200 bg-blue-50/60 rounded-lg p-3">
                      <p className="text-xs font-medium text-blue-900 mb-2">
                        From scans &amp; audits — click Add to assign with its recorded evidence
                      </p>
                      <div className="space-y-1.5">
                        {visible.map((s) => (
                          <div key={s.key} className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-sm font-medium text-gray-900">{s.label}</span>
                              <span className="text-xs text-gray-500 ml-2">
                                {SUGGESTION_ORIGIN_LABELS[s.origin] ?? s.origin}
                                {s.sourcePlatform ? ` · ${s.sourcePlatform}` : ''}
                                {s.asOf ? ` · ${s.asOf}` : ''}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => acceptSuggestion(s)}
                                className="text-xs px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700"
                              >
                                Add
                              </button>
                              <button
                                type="button"
                                onClick={() => dismissSuggestion(s.key)}
                                className="text-gray-400 hover:text-gray-600 p-1"
                                title="Dismiss"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Advisory audit recommendations — no evidence; accepting
                    stamps the chip as an audit recommendation, not a
                    sourced observation. Owner verification is the intended
                    promotion path (attribute_verification intake). */}
                {attributeRecommendations.length > 0 && (() => {
                  const visible = attributeRecommendations.filter(
                    (r) =>
                      !dismissedSuggestions.has(r.key) &&
                      !editAttributes.some((a) => a.key === (r.matchedDefinitionKey || r.key)),
                  );
                  if (visible.length === 0) return null;
                  return (
                    <div className="border border-purple-200 bg-purple-50/60 rounded-lg p-3">
                      <p className="text-xs font-medium text-purple-900 mb-2">
                        Recommended by audit — advisory, not evidence the chip is enabled
                      </p>
                      <div className="space-y-1.5">
                        {visible.map((r) => (
                          <div key={r.key} className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-sm font-medium text-gray-900">{r.label}</span>
                              <span className="text-xs text-gray-500 ml-2">
                                Audit recommendation
                                {r.platform ? ` · ${r.platform}` : ''}
                                {r.currentState ? ` · ${r.currentState.replace(/_/g, ' ')}` : ''}
                              </span>
                              {r.rationale && (
                                <p className="text-[11px] text-gray-500 truncate" title={r.rationale}>{r.rationale}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => acceptRecommendation(r)}
                                className="text-xs px-2 py-0.5 rounded bg-purple-600 text-white hover:bg-purple-700"
                                title="Add to listing — stamped as audit recommendation, not observed evidence"
                              >
                                Add
                              </button>
                              <button
                                type="button"
                                onClick={() => dismissSuggestion(r.key)}
                                className="text-gray-400 hover:text-gray-600 p-1"
                                title="Dismiss"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {ATTRIBUTE_GROUPS.map((group) => {
                const defs = attributeDefs.filter((d) => (d.groupKey || 'other') === group.key);
                if (defs.length === 0) return null;
                return (
                  <div key={group.key} className="mb-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">{group.label}</label>
                    <div className="flex flex-wrap gap-1.5">
                      {defs.map((def) => {
                        const active = editAttributes.some((a) => a.key === def.attributeKey);
                        return (
                          <button
                            key={def.attributeKey}
                            type="button"
                            onClick={() => toggleAttribute(def)}
                            className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                              active
                                ? 'bg-blue-50 border-blue-400 text-blue-700'
                                : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'
                            }`}
                          >
                            {def.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              </div>
            )}

            {editAttributes.length > 0 && (
              <div className="space-y-2 mt-3">
                {editAttributes.map((attr, idx) => {
                  const predefinedDef = attributeDefs.find((d) => d.attributeKey === attr.key);
                  return (
                    <div key={`${attr.key || 'custom'}-${idx}`} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                          value={attr.label}
                          onChange={(e) => updateAttribute(idx, { label: e.target.value })}
                          placeholder="Attribute label"
                        />
                        {predefinedDef ? (
                          <code className="text-xs text-gray-400 shrink-0">{attr.key}</code>
                        ) : (
                          <input
                            className="w-44 border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-mono"
                            value={attr.key}
                            onChange={(e) => updateAttribute(idx, { key: e.target.value })}
                            placeholder="attribute_key"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => removeAttribute(idx)}
                          className="text-gray-400 hover:text-red-600 p-1"
                          title="Remove attribute"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Source platform</label>
                          <input
                            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                            value={attr.sourcePlatform ?? ''}
                            onChange={(e) => updateAttribute(idx, { sourcePlatform: e.target.value })}
                            placeholder={predefinedDef?.defaultSourcePlatform || 'apple_maps / google / yelp'}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Source URL</label>
                          <input
                            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                            value={attr.sourceUrl ?? ''}
                            onChange={(e) => updateAttribute(idx, { sourceUrl: e.target.value })}
                            placeholder="https://…"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">As of</label>
                          <input
                            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                            value={attr.asOf ?? ''}
                            onChange={(e) => updateAttribute(idx, { asOf: e.target.value })}
                            placeholder="2026-09-08"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={addCustomAttribute}
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 mt-2"
            >
              <Plus size={14} /> Add custom attribute
            </button>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Business hours</h3>
            <p className="text-xs text-gray-500 mb-3">
              Only set hours when sourced. Unsourced hours are omitted from the
              public listing per the directory presence contract.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                value={editTimezone}
                onChange={(e) => setEditTimezone(e.target.value)}
              >
                {[
                  'America/New_York',
                  'America/Chicago',
                  'America/Denver',
                  'America/Los_Angeles',
                  'America/Phoenix',
                  'America/Anchorage',
                  'Pacific/Honolulu',
                  'UTC',
                  'Europe/London',
                  'Europe/Paris',
                  'Europe/Berlin',
                  'Europe/Madrid',
                  'Asia/Tokyo',
                  'Asia/Hong_Kong',
                  'Asia/Singapore',
                  'Australia/Sydney',
                ].map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>

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
