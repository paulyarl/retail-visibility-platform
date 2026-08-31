'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import directoryPresenceAdminService, {
  CreateSeedRequest,
} from '@/services/DirectoryPresenceAdminService';
import { tenantManagementService } from '@/services/TenantManagementService';
import { clientLogger } from '@/lib/client-logger';
import { addressParser } from '@/lib/address-parser';
import { geocodeAddress } from '@/lib/validation/businessProfile';
import DirectoryCategorySelectorAdapter from '@/components/directory/DirectoryCategorySelectorAdapter';
import { Plus, ArrowLeft, Trash2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

const PROVENANCE_FIELD_KEYS = [
  'name',
  'address',
  'phone',
  'snap_ebt',
  'hours',
  'specialty_line',
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

  // Provenance rows
  const [provenance, setProvenance] = useState<ProvenanceRow[]>([
    { ...EMPTY_PROVENANCE_ROW },
    { ...EMPTY_PROVENANCE_ROW, fieldKey: 'address' },
  ]);

  const addProvenanceRow = () =>
    setProvenance((rows) => [...rows, { ...EMPTY_PROVENANCE_ROW }]);
  const removeProvenanceRow = (idx: number) =>
    setProvenance((rows) => rows.filter((_, i) => i !== idx));
  const updateProvenanceRow = (idx: number, patch: Partial<ProvenanceRow>) =>
    setProvenance((rows) =>
      rows.map((row, i) => (i === idx ? { ...row, ...patch } : row)),
    );

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
      seedBatch: seedBatch.trim(),
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
