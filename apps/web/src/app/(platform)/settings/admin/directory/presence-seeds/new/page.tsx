'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import directoryPresenceAdminService, {
  CreateSeedRequest,
  DirectoryListingAttribute,
} from '@/services/DirectoryPresenceAdminService';
import marketingOpsService, {
  type ProspectQueueEntry,
  type Campaign,
} from '@/services/MarketingOpsService';
import { tenantManagementService } from '@/services/TenantManagementService';
import { clientLogger } from '@/lib/client-logger';
import { addressParser } from '@/lib/address-parser';
import { geocodeAddress } from '@/lib/validation/businessProfile';
import DirectoryCategorySelectorAdapter from '@/components/directory/DirectoryCategorySelectorAdapter';
import { Plus, ArrowLeft, Trash2, Search, Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

const PROVENANCE_FIELD_KEYS = [
  'name',
  'address',
  'phone',
  'website',
  'snap_ebt',
  'hours',
  'specialty_line',
  'description',
  'keywords',
  'same_as',
] as const;

interface ProvenanceRow {
  fieldKey: string;
  value: string;
  sourceName: string;
  sourceUrl: string;
  confidence: 'high' | 'medium' | 'low';
  showOnPublic: boolean;
}

const EMPTY_PROVENANCE_ROW: ProvenanceRow = {
  fieldKey: 'name',
  value: '',
  sourceName: '',
  sourceUrl: '',
  confidence: 'high',
  showOnPublic: true,
};

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

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

export default function NewPresenceSeedPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Core fields
  const [businessName, setBusinessName] = useState('');
  const [slug, setSlug] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [primaryCategory, setPrimaryCategory] = useState('');
  const [secondaryCategories, setSecondaryCategories] = useState<string[]>([]);
  const [businessHours, setBusinessHours] = useState<Record<string, DayHours>>({
    ...EMPTY_HOURS,
  });
  const [businessHoursTimezone, setBusinessHoursTimezone] =
    useState('America/New_York');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [seedBatch, setSeedBatch] = useState('');
  const [identityConfidence, setIdentityConfidence] =
    useState<'high' | 'medium'>('high');
  const [categoryFit, setCategoryFit] = useState<'verified' | 'probable'>(
    'verified',
  );
  const [notes, setNotes] = useState('');
  const [geocoding, setGeocoding] = useState(false);

  // SNAP/EBT
  const [snapEbtReported, setSnapEbtReported] = useState(false);
  const [snapEbtAsOf, setSnapEbtAsOf] = useState('');
  const [snapEbtSource, setSnapEbtSource] = useState('');
  const [snapEbtSourceName, setSnapEbtSourceName] = useState('');

  // Sourced attributes (payments accepted, accessibility, ownership, service options)
  const [attributesJson, setAttributesJson] = useState('');

  // Provenance rows
  const [provenance, setProvenance] = useState<ProvenanceRow[]>([
    { ...EMPTY_PROVENANCE_ROW },
    { ...EMPTY_PROVENANCE_ROW, fieldKey: 'address' },
  ]);

  // Load-from-prospect picker
  const [sourceType, setSourceType] = useState<'queue' | 'campaign'>('queue');
  const [prospectQuery, setProspectQuery] = useState('');
  const [queueEntries, setQueueEntries] = useState<ProspectQueueEntry[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [campaignResults, setCampaignResults] = useState<Campaign[]>([]);
  const [campaignSearching, setCampaignSearching] = useState(false);
  const [loadedFrom, setLoadedFrom] = useState<{
    kind: 'queue' | 'campaign';
    id: string;
    label: string;
  } | null>(null);

  // SEO enrichment (prefilled from the source campaign's business_analysis
  // audit via the seo-preview endpoint — same composer the automated
  // campaign → seed path uses).
  const [description, setDescription] = useState('');
  const [keywords, setKeywords] = useState('');
  const [sameAs, setSameAs] = useState('');
  const [seoMetaTitle, setSeoMetaTitle] = useState('');
  const [seoHasAudit, setSeoHasAudit] = useState(false);
  const [seoLoading, setSeoLoading] = useState(false);
  const [seoEnrichment, setSeoEnrichment] = useState<Record<string, any> | null>(null);

  const addProvenanceRow = () =>
    setProvenance((rows) => [...rows, { ...EMPTY_PROVENANCE_ROW }]);
  const removeProvenanceRow = (idx: number) =>
    setProvenance((rows) => rows.filter((_, i) => i !== idx));
  const updateProvenanceRow = (idx: number, patch: Partial<ProvenanceRow>) =>
    setProvenance((rows) =>
      rows.map((row, i) => (i === idx ? { ...row, ...patch } : row)),
    );

  // ─── Load from existing prospect ──────────────────────────────────────
  // Queue entries and campaigns already carry the business identity, NAP,
  // category, provenance, and sourced attributes — prefill the form from
  // them instead of retyping. Everything stays editable after loading.

  const loadQueueEntries = async () => {
    setQueueLoading(true);
    setQueueError(null);
    try {
      const res = await marketingOpsService.listProspectQueue({ limit: 200 });
      setQueueEntries(res.entries.filter((e) => e.status !== 'dismissed'));
    } catch (err) {
      setQueueError(err instanceof Error ? err.message : 'Failed to load prospect queue.');
    } finally {
      setQueueLoading(false);
    }
  };

  useEffect(() => {
    loadQueueEntries();
  }, []);

  const filteredQueueEntries = useMemo(() => {
    const q = prospectQuery.trim().toLowerCase();
    const visible = queueEntries.filter(
      (e) => !(e as ProspectQueueEntry & { seed_id?: string | null }).seed_id,
    );
    if (!q) return visible.slice(0, 25);
    return visible
      .filter((e) =>
        [e.business_name, e.title, e.category, e.city, e.state].some((v) =>
          (v ?? '').toLowerCase().includes(q),
        ),
      )
      .slice(0, 25);
  }, [queueEntries, prospectQuery]);

  const searchCampaignProspects = async () => {
    setCampaignSearching(true);
    try {
      const res = await marketingOpsService.listCampaigns({
        scope: 'business',
        search: prospectQuery.trim() || undefined,
        limit: 25,
      });
      setCampaignResults(res.items);
    } catch {
      setCampaignResults([]);
    } finally {
      setCampaignSearching(false);
    }
  };

  /** Normalize one snapshot attribute entry (string label or structured object). */
  const normalizeAttribute = (
    raw: any,
    fallbackPlatform: string,
  ): DirectoryListingAttribute | null => {
    const slug = (label: string) =>
      label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (typeof raw === 'string') {
      const label = raw.trim();
      return label ? { key: slug(label), label, sourcePlatform: fallbackPlatform } : null;
    }
    if (raw && typeof raw === 'object') {
      const label = String(raw.label ?? raw.value ?? '').trim();
      if (!label) return null;
      return {
        key: String(raw.key ?? '').trim().toLowerCase() || slug(label),
        label,
        sourcePlatform:
          String(raw.sourcePlatform ?? raw.source_platform ?? fallbackPlatform ?? '').trim() ||
          undefined,
        sourceUrl: String(raw.sourceUrl ?? raw.source_url ?? '').trim() || undefined,
        asOf: String(raw.asOf ?? raw.as_of ?? '').trim() || undefined,
      };
    }
    return null;
  };

  const provenanceRowsFor = (
    fields: Array<{ fieldKey: string; value: string }>,
    sourceName: string,
    sourceUrl: string,
    confidence: ProvenanceRow['confidence'],
  ): ProvenanceRow[] =>
    fields
      .filter((f) => f.value)
      .map((f) => ({
        fieldKey: f.fieldKey,
        value: f.value,
        sourceName,
        sourceUrl,
        confidence,
        showOnPublic: true,
      }));

  /**
   * Prefill the SEO enrichment fields from the source campaign's latest
   * business_analysis audit (same SeedSeoComposer the automated campaign →
   * seed path uses). Also upserts provenance rows for the composed fields so
   * they render publicly per the provenance contract (spec §4.4.6).
   */
  const loadSeoPreview = async (campaignId: string) => {
    setSeoLoading(true);
    try {
      const preview = await directoryPresenceAdminService.getSeoPreview(campaignId);
      if (!preview) return;
      setSeoMetaTitle(preview.metaTitle || '');
      setSeoHasAudit(preview.hasAudit);
      setDescription(preview.description || '');
      setKeywords((preview.keywords || []).join(', '));
      setSameAs((preview.sameAs || []).join('\n'));
      setSeoEnrichment(preview.seoEnrichment ?? null);
      if ((preview.secondaryCategories || []).length > 0) {
        setSecondaryCategories((prev) =>
          prev.length > 0 ? prev : (preview.secondaryCategories as string[]),
        );
      }
      setProvenance((rows) => {
        const next = [...rows];
        const upsert = (fieldKey: string, value: string, sourceName: string) => {
          if (!value) return;
          const row: ProvenanceRow = {
            fieldKey,
            value,
            sourceName,
            sourceUrl: `/settings/admin/marketing-ops/campaigns/${campaignId}`,
            confidence: 'high',
            showOnPublic: true,
          };
          const i = next.findIndex((r) => r.fieldKey === fieldKey);
          if (i >= 0) next[i] = { ...next[i], ...row };
          else next.push(row);
        };
        upsert('description', preview.description || '', 'seed_seo_composer');
        upsert('keywords', (preview.keywords || []).join(', '), 'seed_seo_composer');
        upsert('same_as', (preview.sameAs || []).join(', '), 'business_analysis_audit');
        return next;
      });
    } catch (err) {
      clientLogger.warn('Failed to load SEO preview:', { detail: err });
    } finally {
      setSeoLoading(false);
    }
  };

  const applyQueueEntry = (entry: ProspectQueueEntry) => {
    const snap = (entry.business_snapshot ?? {}) as Record<string, any>;
    // Verified NAP (captured on the verification call) wins over the raw
    // discovery snapshot — mirrors the queue → campaign promotion path.
    const verified = (snap.verified_nap ?? {}) as Record<string, string>;

    const name = String(entry.business_name || verified.name || entry.title || '').trim();
    const rawAddress = String(verified.address || snap.address || snap.street_address || '').trim();
    const parsed = rawAddress && addressParser.canParse(rawAddress)
      ? addressParser.parse(rawAddress)
      : null;
    const phone = String(verified.phone || snap.phone || snap.business_phone || '').trim();
    const website = String(
      verified.website
        || (typeof snap.website === 'string' ? snap.website : snap?.website?.url)
        || '',
    ).trim();
    const stateRaw = String(verified.state || entry.state || parsed?.state || '')
      .trim()
      .toUpperCase();

    setBusinessName(name);
    setAddress(String(parsed?.address_line1 || rawAddress));
    setCity(String(verified.city || entry.city || parsed?.city || ''));
    setState(US_STATES.includes(stateRaw) ? stateRaw : '');
    setZipCode(String(snap.zip_code || parsed?.postal_code || '').trim());
    setPhone(phone);
    setWebsite(website);
    setPrimaryCategory(String(verified.category || entry.category || '').trim());
    setSecondaryCategories(
      Array.isArray(snap.secondary_categories)
        ? snap.secondary_categories.map(String)
        : [],
    );
    setLatitude(snap.latitude != null ? String(snap.latitude) : '');
    setLongitude(snap.longitude != null ? String(snap.longitude) : '');

    if (snap.snap_ebt_reported) {
      setSnapEbtReported(true);
      if (snap.snap_ebt_as_of) setSnapEbtAsOf(String(snap.snap_ebt_as_of).slice(0, 10));
      if (snap.snap_ebt_source) setSnapEbtSource(String(snap.snap_ebt_source));
      if (snap.snap_ebt_source_name) setSnapEbtSourceName(String(snap.snap_ebt_source_name));
    }

    const attrs = (Array.isArray(snap.attributes) ? snap.attributes : [])
      .map((a: any) => normalizeAttribute(a, 'queue_snapshot'))
      .filter(Boolean) as DirectoryListingAttribute[];
    setAttributesJson(attrs.length > 0 ? JSON.stringify(attrs, null, 2) : '');

    const conf: ProvenanceRow['confidence'] =
      entry.identity_confidence === 'high'
        ? 'high'
        : entry.identity_confidence === 'low'
          ? 'low'
          : 'medium';
    setIdentityConfidence(conf === 'low' ? 'medium' : conf);
    setCategoryFit(entry.category_fit === 'verified' ? 'verified' : 'probable');
    setSeedBatch(`from-queue-${entry.id}`);
    if (entry.note) setNotes(entry.note);

    const provSource = `prospect_queue:${entry.source_kind}`;
    const provUrl = entry.source_campaign_id
      ? `/settings/admin/marketing-ops/campaigns/${entry.source_campaign_id}`
      : '/settings/admin/marketing-ops/queue';
    setProvenance(
      provenanceRowsFor(
        [
          { fieldKey: 'name', value: name },
          { fieldKey: 'address', value: String(parsed?.address_line1 || rawAddress) },
          { fieldKey: 'phone', value: phone },
          { fieldKey: 'website', value: website },
        ],
        provSource,
        provUrl,
        conf,
      ),
    );
    setLoadedFrom({ kind: 'queue', id: entry.id, label: name || entry.id });
    // Audit-derived entries point at their source campaign — pull the SEO
    // packet (description, keywords, same_as) from its business_analysis audit.
    if (entry.source_campaign_id) {
      loadSeoPreview(entry.source_campaign_id);
    }
  };

  const applyCampaignProspect = (campaign: Campaign) => {
    const name = String(campaign.business_name || campaign.title || '').trim();
    const address = [campaign.address_line1, campaign.address_line2]
      .filter(Boolean)
      .join(', ');
    const phone = String(campaign.phone || '').trim();
    const website = String(campaign.website_url || '').trim();
    const stateRaw = String(campaign.address_state || campaign.state || '')
      .trim()
      .toUpperCase();

    setBusinessName(name);
    setAddress(address);
    setCity(String(campaign.address_city || campaign.city || ''));
    setState(US_STATES.includes(stateRaw) ? stateRaw : '');
    setZipCode(String(campaign.address_zip || ''));
    setPhone(phone);
    setWebsite(website);
    setPrimaryCategory(String(campaign.category || '').trim());
    setSecondaryCategories([]);
    setLatitude('');
    setLongitude('');
    setSnapEbtReported(false);
    setSnapEbtAsOf('');
    setSnapEbtSource('');
    setSnapEbtSourceName('');
    // Sourced attributes with per-attribute evidence live on the campaign's
    // audits, not the campaign row — the seed detail page's suggestion miner
    // surfaces them once the seed is linked (done after create below).
    setAttributesJson('');
    setIdentityConfidence('medium');
    setCategoryFit('probable');
    setSeedBatch(`from-campaign-${campaign.display_id || campaign.id}`);
    setNotes('');

    const provUrl = `/settings/admin/marketing-ops/campaigns/${campaign.id}`;
    const sameAsUrls = [
      ...(Array.isArray(campaign.directory_profiles)
        ? campaign.directory_profiles.map((p) => p?.url).filter(Boolean)
        : []),
      ...(Array.isArray(campaign.social_profiles)
        ? campaign.social_profiles.map((p) => p?.url).filter(Boolean)
        : []),
    ] as string[];
    setProvenance([
      ...provenanceRowsFor(
        [
          { fieldKey: 'name', value: name },
          { fieldKey: 'address', value: address },
          { fieldKey: 'phone', value: phone },
          { fieldKey: 'website', value: website },
        ],
        'campaign_record',
        provUrl,
        'high',
      ),
      ...provenanceRowsFor(
        [{ fieldKey: 'same_as', value: sameAsUrls.join(', ') }],
        'campaign_record',
        provUrl,
        'high',
      ),
    ]);
    setLoadedFrom({
      kind: 'campaign',
      id: campaign.id,
      label: name || campaign.display_id || campaign.id,
    });
    loadSeoPreview(campaign.id);
  };

  const handleAddressChange = (value: string) => {
    if (addressParser.canParse(value)) {
      const parsed = addressParser.parse(value);
      setAddress(parsed.address_line1 ?? value);
      setCity((prev) => parsed.city ?? prev);
      setState((prev) => (parsed.state && US_STATES.includes(parsed.state) ? parsed.state : prev));
      setZipCode((prev) => parsed.postal_code ?? prev);
    } else {
      setAddress(value);
    }
  };

  const handleGeocodeAddress = async () => {
    if (!address.trim() || !city.trim() || !zipCode.trim()) {
      setError('Please fill in address, city, and ZIP code before geocoding.');
      return;
    }

    setGeocoding(true);
    setError(null);

    try {
      const coordinates = await geocodeAddress({
        address_line1: address,
        city,
        state,
        postal_code: zipCode,
        country_code: 'US',
      });

      if (coordinates) {
        setLatitude(String(coordinates.latitude));
        setLongitude(String(coordinates.longitude));
      } else {
        setError('Could not find coordinates for this address. Please check the address and try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to geocode address.');
    } finally {
      setGeocoding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (
      !businessName.trim() ||
      !address.trim() ||
      !city.trim() ||
      !state.trim() ||
      !primaryCategory.trim() ||
      !seedBatch.trim()
    ) {
      setError(
        'Business name, address, city, state, primary category, and seed batch are required.',
      );
      return;
    }

    const lat = latitude.trim() ? Number(latitude) : undefined;
    const lng = longitude.trim() ? Number(longitude) : undefined;
    if (latitude.trim() && Number.isNaN(lat)) {
      setError('Latitude must be a number.');
      return;
    }
    if (longitude.trim() && Number.isNaN(lng)) {
      setError('Longitude must be a number.');
      return;
    }

    const payload: CreateSeedRequest = {
      businessName: businessName.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      zipCode: zipCode.trim() || undefined,
      phone: phone.trim() || undefined,
      website: website.trim() || undefined,
      primaryCategory: primaryCategory.trim(),
      slug: slug.trim() || undefined,
      secondaryCategories: secondaryCategories.length > 0
        ? secondaryCategories
        : undefined,
      latitude: lat,
      longitude: lng,
      identityConfidence,
      categoryFit,
      notes: notes.trim() || undefined,
      provenance: provenance
        .filter((row) => row.fieldKey && (row.value || row.sourceName))
        .map((row) => ({
          fieldKey: row.fieldKey,
          value: row.value.trim() || undefined,
          sourceName: row.sourceName.trim() || undefined,
          sourceUrl: row.sourceUrl.trim() || undefined,
          confidence: row.confidence,
          showOnPublic: row.showOnPublic,
        })),
    };

    // SEO enrichment — only send fields that have content.
    if (description.trim()) payload.description = description.trim();
    const keywordList = keywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 15);
    if (keywordList.length > 0) payload.keywords = keywordList;
    const sameAsList = sameAs
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);
    if (sameAsList.length > 0) payload.sameAs = sameAsList;
    if (seoEnrichment) payload.seoEnrichment = seoEnrichment;

    if (snapEbtReported) {
      payload.snapEbtReported = true;
      if (snapEbtAsOf) {
        // Convert date input (yyyy-mm-dd) to an ISO datetime
        const d = new Date(`${snapEbtAsOf}T00:00:00.000Z`);
        if (Number.isNaN(d.getTime())) {
          setError('SNAP/EBT as-of date is invalid.');
          return;
        }
        payload.snapEbtAsOf = d.toISOString();
      }
      if (snapEbtSource.trim()) payload.snapEbtSource = snapEbtSource.trim();
      if (snapEbtSourceName.trim())
        payload.snapEbtSourceName = snapEbtSourceName.trim();
    }

    // Sourced attributes — JSON array of {key, label, sourcePlatform, sourceUrl, asOf}.
    // Each attribute carries its own evidence; never inferred from category labels.
    if (attributesJson.trim()) {
      let parsed: any;
      try {
        parsed = JSON.parse(attributesJson);
      } catch {
        setError('Attributes must be valid JSON (array of { key, label, sourcePlatform, sourceUrl, asOf }).');
        return;
      }
      if (!Array.isArray(parsed)) {
        setError('attributes must be a JSON array of { key, label, sourcePlatform, sourceUrl, asOf }');
        return;
      }
      for (const a of parsed) {
        if (!a || typeof a !== 'object' || !a.key || !a.label) {
          setError('Each attribute requires at least "key" and "label".');
          return;
        }
      }
      payload.attributes = parsed;
      const firstSource = parsed.find((a: any) => a.sourcePlatform || a.sourceUrl);
      if (firstSource) {
        payload.provenance = [
          ...(payload.provenance || []),
          {
            fieldKey: 'attributes',
            sourceName: firstSource.sourcePlatform || undefined,
            sourceUrl: firstSource.sourceUrl || undefined,
            confidence: 'high' as const,
            showOnPublic: true,
          },
        ];
      }
    }

    try {
      setSubmitting(true);
      const seed = await directoryPresenceAdminService.createSeed(payload);
      if (!seed || !seed.id) {
        setError('Seed was created but no id was returned.');
        return;
      }

      // Delegate hours/timezone to the existing tenant business-hours services.
      const hasHours = DAYS.some((day) => !businessHours[day].closed);
      if (hasHours && seed.tenantId) {
        const periods = DAYS.filter((day) => !businessHours[day].closed).map(
          (day) => ({
            day: day.toUpperCase(),
            open: businessHours[day].open,
            close: businessHours[day].close,
          }),
        );
        try {
          await tenantManagementService.updateBusinessHours(seed.tenantId, {
            timezone: businessHoursTimezone,
            periods,
          });
        } catch (hoursErr) {
          clientLogger.warn('Failed to set seed business hours:', {
            detail: hoursErr,
          });
        }
      }

      // When the seed was loaded from a campaign prospect, link it so the
      // funnel analytics + attribute-suggestion miner can find it.
      if (loadedFrom?.kind === 'campaign' && loadedFrom.id) {
        try {
          await directoryPresenceAdminService.linkCampaign(
            seed.id,
            loadedFrom.id,
            'primary',
          );
        } catch (linkErr) {
          clientLogger.warn('Failed to link seed to source campaign:', {
            detail: linkErr,
          });
        }
      }

      router.push(
        `/settings/admin/directory/presence-seeds/${seed.id}`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create presence seed',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Presence Seed"
        description="Seed an unclaimed directory listing from public information."
        backLink={{
          href: '/settings/admin/directory/presence-seeds',
          label: 'Back to seeds',
        }}
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Load from existing prospect */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 max-w-3xl">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Load from existing prospect
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Optional — prefill the form below from a prospect queue entry or a
            business campaign. Everything stays editable.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSourceType('queue')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
              sourceType === 'queue'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Prospect Queue
          </button>
          <button
            type="button"
            onClick={() => setSourceType('campaign')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
              sourceType === 'campaign'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Campaign Prospect
          </button>
        </div>

        <div className="flex gap-2">
          <input
            className={inputClass}
            value={prospectQuery}
            onChange={(e) => setProspectQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && sourceType === 'campaign') {
                e.preventDefault();
                searchCampaignProspects();
              }
            }}
            placeholder={
              sourceType === 'queue'
                ? 'Filter queue entries by name, category, or city...'
                : 'Search campaigns by business name, title, or display ID...'
            }
          />
          {sourceType === 'campaign' && (
            <button
              type="button"
              onClick={searchCampaignProspects}
              disabled={campaignSearching}
              className="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 whitespace-nowrap"
            >
              {campaignSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Search
            </button>
          )}
        </div>

        {sourceType === 'queue' &&
          (queueLoading ? (
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading queue entries...
            </p>
          ) : queueError ? (
            <div className="text-sm text-red-600 flex items-center gap-2">
              {queueError}
              <button
                type="button"
                onClick={loadQueueEntries}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Retry
              </button>
            </div>
          ) : filteredQueueEntries.length === 0 ? (
            <p className="text-sm text-gray-500">
              No queue entries available. Add prospects from an audit surface or
              type the seed manually below.
            </p>
          ) : (
            <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg max-h-72 overflow-y-auto">
              {filteredQueueEntries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => applyQueueEntry(entry)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {entry.business_name || entry.title || entry.id}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {[entry.category, entry.city, entry.state]
                        .filter(Boolean)
                        .join(' · ') || 'No location data'}
                    </p>
                  </div>
                  <div className="text-xs text-gray-400 whitespace-nowrap">
                    {entry.status}
                    {entry.source_kind ? ` · ${entry.source_kind}` : ''}
                  </div>
                </button>
              ))}
            </div>
          ))}

        {sourceType === 'campaign' && campaignResults.length > 0 && (
          <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg max-h-72 overflow-y-auto">
            {campaignResults.map((campaign) => (
              <button
                key={campaign.id}
                type="button"
                onClick={() => applyCampaignProspect(campaign)}
                className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {campaign.business_name || campaign.title || campaign.id}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {[campaign.category, campaign.city, campaign.state]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="text-xs text-gray-400 whitespace-nowrap">
                  {campaign.display_id || campaign.id} · {campaign.stage}
                </div>
              </button>
            ))}
          </div>
        )}

        {loadedFrom && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm flex items-start justify-between gap-3">
            <span>
              Loaded from{' '}
              {loadedFrom.kind === 'queue' ? 'queue prospect' : 'campaign'}{' '}
              <strong>{loadedFrom.label}</strong>. Review every field below —
              nothing is saved until you create the seed.
              {loadedFrom.kind === 'queue' &&
                ' After creating the seed, dismiss the queue entry if it is no longer needed.'}
            </span>
            <button
              type="button"
              onClick={() => setLoadedFrom(null)}
              className="text-green-700 hover:text-green-900 text-xs font-medium whitespace-nowrap"
            >
              Dismiss
            </button>
          </div>
        )}
      </section>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        {/* Identity */}
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Business Identity
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={labelClass}>Business Name *</label>
              <input
                className={inputClass}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
                maxLength={200}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Public Slug</label>
              <input
                className={inputClass}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                maxLength={80}
                placeholder="kaura-international-food-market — auto-generated from business name if left blank"
              />
              <p className="text-xs text-gray-500 mt-1">
                Used in the public URL (/place/your-slug). Lowercase letters, numbers, and dashes only. Will be normalized and de-duplicated.
              </p>
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Street Address *</label>
              <input
                className={inputClass}
                value={address}
                onChange={(e) => handleAddressChange(e.target.value)}
                placeholder="123 Main St, Suite 200, Indianapolis, IN 46214 — paste a full address to auto-split"
                required
                maxLength={300}
              />
              <p className="text-xs text-gray-500 mt-1">
                Paste a full address to auto-fill city, state, and ZIP.
              </p>
            </div>
            <div>
              <label className={labelClass}>City *</label>
              <input
                className={inputClass}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass}>State *</label>
              <select
                className={inputClass}
                value={state}
                onChange={(e) => setState(e.target.value)}
                required
              >
                <option value="">Select state</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>ZIP Code</label>
              <input
                className={inputClass}
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input
                className={inputClass}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Website</label>
              <input
                className={inputClass}
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://"
              />
            </div>
            <div>
              <label className={labelClass}>Latitude</label>
              <input
                className={inputClass}
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="39.7684"
              />
            </div>
            <div>
              <label className={labelClass}>Longitude</label>
              <input
                className={inputClass}
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="-86.1581"
              />
            </div>
            <div className="md:col-span-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">
                    Map Coordinates
                  </h4>
                  <p className="text-xs text-gray-600">
                    Get latitude and longitude for map display
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGeocodeAddress}
                  disabled={geocoding || !address.trim() || !city.trim() || !zipCode.trim()}
                  className="inline-flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {geocoding ? 'Getting...' : 'Get Coordinates'}
                </button>
              </div>
              {latitude && longitude && (
                <div className="mt-2 flex items-center gap-2 text-xs text-green-700">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    Coordinates: {Number(latitude).toFixed(6)}, {Number(longitude).toFixed(6)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Business Hours */}
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Business Hours</h2>
          <p className="text-xs text-gray-500">
            Unsourced hours are omitted from the public listing. When set, hours
            and timezone are sent to the tenant business-hours service so the
            public place page is timezone aware.
          </p>

          <div className="mb-3">
            <label className={labelClass}>Timezone</label>
            <select
              className={inputClass}
              value={businessHoursTimezone}
              onChange={(e) => setBusinessHoursTimezone(e.target.value)}
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
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            {DAYS.map((day) => {
              const h = businessHours[day];
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
                          setBusinessHours((prev) => ({
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
                          className={inputClass}
                          value={h.open}
                          onChange={(e) =>
                            setBusinessHours((prev) => ({
                              ...prev,
                              [day]: { ...prev[day], open: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div className="md:col-span-1 text-center text-xs text-gray-400">
                        to
                      </div>
                      <div className="md:col-span-4">
                        <input
                          type="time"
                          className={inputClass}
                          value={h.close}
                          onChange={(e) =>
                            setBusinessHours((prev) => ({
                              ...prev,
                              [day]: { ...prev[day], close: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </>
                  )}
                  {h.closed && (
                    <div className="md:col-span-9 text-sm text-gray-400">
                      Closed
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Classification */}
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Classification</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <DirectoryCategorySelectorAdapter
                primary={primaryCategory}
                secondary={secondaryCategories}
                onPrimaryChange={setPrimaryCategory}
                onSecondaryChange={setSecondaryCategories}
              />
            </div>
            <div>
              <label className={labelClass}>Seed Batch *</label>
              <input
                className={inputClass}
                value={seedBatch}
                onChange={(e) => setSeedBatch(e.target.value)}
                required
                placeholder="indianapolis-african-grocery-2026"
              />
            </div>
            <div>
              <label className={labelClass}>Identity Confidence *</label>
              <select
                className={inputClass}
                value={identityConfidence}
                onChange={(e) =>
                  setIdentityConfidence(e.target.value as 'high' | 'medium')
                }
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Category Fit *</label>
              <select
                className={inputClass}
                value={categoryFit}
                onChange={(e) =>
                  setCategoryFit(e.target.value as 'verified' | 'probable')
                }
              >
                <option value="verified">Verified</option>
                <option value="probable">Probable</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Notes (internal)</label>
              <textarea
                className={inputClass}
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* SEO Enrichment */}
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">SEO Enrichment</h2>
            {seoLoading && (
              <span className="text-xs text-gray-500 inline-flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading from campaign audit...
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Prefilled by the SEO composer from the source campaign's
            business_analysis audit — the analyst's public narrative becomes the
            description; keywords compose category, audit store format and
            additional categories, intelligence-profile synonyms/subcategories,
            and gold-standard field hints.
            {seoMetaTitle && !seoLoading && (
              <>
                {' '}Composed meta title: <strong>{seoMetaTitle}</strong>
                {!seoHasAudit && ' (Tier A — no business_analysis audit on the campaign yet)'}
              </>
            )}
          </p>
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              className={inputClass}
              rows={3}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Composed by the SEO composer when loaded from a campaign — otherwise write a public-safe description."
            />
          </div>
          <div>
            <label className={labelClass}>Keywords (comma-separated)</label>
            <input
              className={inputClass}
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="african grocery, indianapolis, international foods"
            />
          </div>
          <div>
            <label className={labelClass}>Same As (profile URLs, one per line)</label>
            <textarea
              className={inputClass}
              rows={3}
              value={sameAs}
              onChange={(e) => setSameAs(e.target.value)}
              placeholder={'https://www.google.com/maps/place/...\nhttps://www.yelp.com/biz/...'}
            />
          </div>
        </section>

        {/* SNAP / EBT */}
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">SNAP / EBT</h2>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={snapEbtReported}
                onChange={(e) => setSnapEbtReported(e.target.checked)}
              />
              Reported
            </label>
          </div>
          {snapEbtReported && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>As Of</label>
                <input
                  type="date"
                  className={inputClass}
                  value={snapEbtAsOf}
                  onChange={(e) => setSnapEbtAsOf(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Source</label>
                <input
                  className={inputClass}
                  value={snapEbtSource}
                  onChange={(e) => setSnapEbtSource(e.target.value)}
                  placeholder="snap_retailer_list"
                />
              </div>
              <div>
                <label className={labelClass}>Source Name</label>
                <input
                  className={inputClass}
                  value={snapEbtSourceName}
                  onChange={(e) => setSnapEbtSourceName(e.target.value)}
                  placeholder="USDA SNAP Retailer Locator"
                />
              </div>
            </div>
          )}
          <p className="text-xs text-gray-500">
            Never infer SNAP/EBT from category labels. Only mark reported when
            sourced from the SNAP retailer list, owner confirmation, or an
            in-store photo reviewed by ops.
          </p>
        </section>

        {/* Sourced Attributes */}
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Sourced Attributes</h2>
          <p className="text-xs text-gray-500">
            Optional attribute chips (payments accepted, accessibility, ownership,
            service options). JSON array of{' '}
            <code className="text-xs">{`{ key, label, sourcePlatform, sourceUrl, asOf }`}</code>.
            Each attribute carries its own evidence — never inferred from category
            labels. SNAP/EBT stays in its dedicated section above.
          </p>
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
            rows={6}
            value={attributesJson}
            onChange={(e) => setAttributesJson(e.target.value)}
            placeholder={'[\n  {\n    "key": "accepts_apple_pay",\n    "label": "Apple Pay",\n    "sourcePlatform": "apple_maps",\n    "sourceUrl": "https://maps.apple.com/...",\n    "asOf": "2026-09-09"\n  }\n]'}
          />
        </section>

        {/* Provenance */}
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Field Provenance
            </h2>
            <button
              type="button"
              onClick={addProvenanceRow}
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              <Plus className="w-4 h-4" /> Add row
            </button>
          </div>
          <p className="text-xs text-gray-500">
            A field will not render publicly without a provenance row with
            show-on-public enabled. At minimum, record sources for name and
            address.
          </p>
          <div className="space-y-3">
            {provenance.map((row, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border border-gray-100 rounded-lg p-3"
              >
                <div className="md:col-span-3">
                  <label className={labelClass}>Field</label>
                  <select
                    className={inputClass}
                    value={row.fieldKey}
                    onChange={(e) =>
                      updateProvenanceRow(idx, { fieldKey: e.target.value })
                    }
                  >
                    {PROVENANCE_FIELD_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className={labelClass}>Value</label>
                  <input
                    className={inputClass}
                    value={row.value}
                    onChange={(e) =>
                      updateProvenanceRow(idx, { value: e.target.value })
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Source Name</label>
                  <input
                    className={inputClass}
                    value={row.sourceName}
                    onChange={(e) =>
                      updateProvenanceRow(idx, { sourceName: e.target.value })
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Source URL</label>
                  <input
                    className={inputClass}
                    value={row.sourceUrl}
                    onChange={(e) =>
                      updateProvenanceRow(idx, { sourceUrl: e.target.value })
                    }
                  />
                </div>
                <div className="md:col-span-1">
                  <label className={labelClass}>Confidence</label>
                  <select
                    className={inputClass}
                    value={row.confidence}
                    onChange={(e) =>
                      updateProvenanceRow(idx, {
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
                        updateProvenanceRow(idx, {
                          showOnPublic: e.target.checked,
                        })
                      }
                    />
                    Public
                  </label>
                  <button
                    type="button"
                    onClick={() => removeProvenanceRow(idx)}
                    className="text-red-500 hover:text-red-700"
                    title="Remove row"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Seed'}
          </button>
          <Link
            href="/settings/admin/directory/presence-seeds"
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="w-4 h-4" /> Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
