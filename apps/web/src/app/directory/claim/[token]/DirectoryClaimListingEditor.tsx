'use client';

import { useState, useEffect, useRef } from 'react';
import { clientLogger } from '@/lib/client-logger';
import { geocodeAddress } from '@/lib/validation/businessProfile';
import directoryClaimPublicService, {
  DirectoryClaimSummary,
} from '@/services/DirectoryClaimPublicService';
import DirectoryCategorySelectorAdapter from '@/components/directory/DirectoryCategorySelectorAdapter';
import {
  Button,
  TextInput,
  Textarea,
  Select,
  Stack,
  Group,
  Text,
  Divider,
  Card,
  Alert,
} from '@mantine/core';

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

function to24Hour(time12: string): string {
  if (!time12) return '';
  if (/^\d{1,2}:\d{2}$/.test(time12)) return time12;
  const match = time12.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return time12;
  let h = parseInt(match[1], 10);
  const m = match[2];
  const period = match[3].toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${h.toString().padStart(2, '0')}:${m}`;
}

function parseHours(raw: any): Record<string, DayHours> {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_HOURS };
  const result: Record<string, DayHours> = { ...EMPTY_HOURS };
  for (const day of DAYS) {
    const d = raw[day];
    if (d && typeof d === 'object') {
      result[day] = {
        open: to24Hour(d.open ?? '09:00'),
        close: to24Hour(d.close ?? '18:00'),
        closed: d.closed ?? false,
      };
    }
  }
  return result;
}

const TIMEZONE_OPTIONS = [
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
];

export default function DirectoryClaimListingEditor({
  token,
  summary,
  onSaved,
  includeCategories = true,
}: {
  token: string;
  summary: DirectoryClaimSummary;
  onSaved: () => void;
  /** False on the pre-claim screen — ClaimVerificationPanel owns the
   *  category consent contract there, so the editor must not offer a second
   *  category editor whose save would be overwritten at claim submit. */
  includeCategories?: boolean;
}) {
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editZipCode, setEditZipCode] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editLatitude, setEditLatitude] = useState('');
  const [editLongitude, setEditLongitude] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editSocialLinks, setEditSocialLinks] = useState<{ platform: string; url: string }[]>([]);
  const [editPrimaryCategory, setEditPrimaryCategory] = useState('');
  const [editSecondaryCategories, setEditSecondaryCategories] = useState<string[]>([]);
  const [editHours, setEditHours] = useState<Record<string, DayHours>>({ ...EMPTY_HOURS });
  const [editTimezone, setEditTimezone] = useState('America/New_York');
  // Only send businessHours when the owner actually touched them — the empty
  // form state is "every day closed", which would wrongly overwrite a listing
  // that has no sourced hours yet.
  const [hoursTouched, setHoursTouched] = useState(false);

  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Business logo — uploads immediately on pick (the claim token is the
  // capability; same write as the tenant logo endpoint: tenant profile +
  // listing logo_url).
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditAddress(summary.address ?? '');
    setEditCity(summary.city ?? '');
    setEditState(summary.state ?? '');
    setEditZipCode(summary.zipCode ?? '');
    setEditPhone(summary.phone ?? '');
    setEditEmail(summary.email ?? '');
    setEditWebsite(summary.website ?? '');
    setEditLatitude(summary.latitude != null ? String(summary.latitude) : '');
    setEditLongitude(summary.longitude != null ? String(summary.longitude) : '');
    setEditPrimaryCategory(summary.primaryCategory ?? '');
    setEditNotes(summary.notes ?? '');
    setEditSocialLinks(Array.isArray(summary.socialLinks) ? summary.socialLinks : []);
    setEditSecondaryCategories(Array.isArray(summary.secondaryCategories) ? summary.secondaryCategories : []);
    setEditHours(parseHours(summary.businessHours));
    setEditTimezone(summary.businessHours?.timezone || 'America/New_York');
    setLogoUrl(summary.logoUrl ?? null);
  }, [summary]);

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Logo must be an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Logo must be under 5 MB.');
      return;
    }
    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
    if (!dataUrl) {
      setError('Failed to read the logo file.');
      return;
    }
    setLogoUploading(true);
    setError(null);
    setSuccess(null);
    const result = await directoryClaimPublicService.uploadClaimLogo(token, dataUrl, file.type);
    setLogoUploading(false);
    if (result.success && result.url) {
      setLogoUrl(result.url);
      setSuccess('Logo updated.');
    } else {
      setError(result.error === 'file_too_large' ? 'Logo must be under 5 MB.' : 'Failed to upload the logo.');
    }
  };

  const handleGetCoordinates = async () => {
    if (!editAddress.trim() || !editCity.trim() || !editZipCode.trim()) {
      setError('Please fill in address, city, and ZIP code before geocoding.');
      return;
    }
    setGeocoding(true);
    setError(null);
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
        setError('Could not find coordinates for this address.');
      }
    } catch (err) {
      clientLogger.error('Failed to geocode claim address:', { detail: err });
      setError(err instanceof Error ? err.message : 'Failed to geocode address.');
    } finally {
      setGeocoding(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload: Record<string, any> = {
      address: editAddress.trim() || undefined,
      city: editCity.trim() || undefined,
      state: editState.trim() || undefined,
      zipCode: editZipCode.trim() || null,
      phone: editPhone.trim() || null,
      email: editEmail.trim() || null,
      website: editWebsite.trim() || null,
      latitude: editLatitude.trim() && !Number.isNaN(Number(editLatitude)) ? Number(editLatitude) : null,
      longitude: editLongitude.trim() && !Number.isNaN(Number(editLongitude)) ? Number(editLongitude) : null,
      notes: editNotes.trim() || null,
      socialLinks: editSocialLinks.filter((s) => s.platform.trim() && s.url.trim()),
    };

    if (includeCategories) {
      payload.primaryCategory = editPrimaryCategory.trim() || null;
      payload.secondaryCategories = editSecondaryCategories;
    }

    if (hoursTouched) {
      const hoursObj: Record<string, DayHours> = {};
      for (const day of DAYS) {
        hoursObj[day] = editHours[day];
      }
      payload.businessHours = { ...hoursObj, timezone: editTimezone };
    }

    const result = await directoryClaimPublicService.updateListing(token, payload);
    setSaving(false);
    if (result.success) {
      setSuccess('Listing updated successfully.');
      onSaved();
    } else {
      setError(result.error || 'Failed to save changes.');
    }
  };

  return (
    <Card withBorder shadow="sm" padding="lg" radius="md" mt="md">
      <Stack gap="md">
        <div>
          <Text fw={600} size="lg">
            Review and update your listing (optional)
          </Text>
          <Text size="sm" c="dimmed">
            These changes are optional but help the approval team verify your business and publish accurate information.
          </Text>
        </div>

        {error && (
          <Alert color="red" variant="light" icon={<span>!</span>}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert color="green" variant="light" icon={<span>&check;</span>}>
            {success}
          </Alert>
        )}

        <Divider />

        <Stack gap="sm">
          <Text size="sm" fw={500}>
            Business identity
          </Text>
          <TextInput
            label="Business name"
            value={summary.businessName}
            disabled
            description="To correct the business name, note it in the corrections field below — our team reviews name changes."
          />
          {includeCategories && (
            <DirectoryCategorySelectorAdapter
              primary={editPrimaryCategory}
              secondary={editSecondaryCategories}
              onPrimaryChange={setEditPrimaryCategory}
              onSecondaryChange={setEditSecondaryCategories}
              disabled={false}
            />
          )}
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Business logo"
                className="h-12 w-12 object-contain rounded border border-gray-200 bg-white"
              />
            ) : (
              <div className="h-12 w-12 rounded border border-dashed border-gray-300 bg-gray-50" />
            )}
            <div>
              <Text size="sm">Logo</Text>
              <Text size="xs" c="dimmed">
                Shown on your public listing and QR codes. Saves on upload.
              </Text>
              <Button
                variant="subtle"
                size="xs"
                onClick={() => logoFileRef.current?.click()}
                loading={logoUploading}
              >
                {logoUrl ? 'Replace logo' : 'Upload logo'}
              </Button>
            </div>
            <input
              ref={logoFileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleLogoFile}
              className="hidden"
            />
          </div>
        </Stack>

        <Divider />

        <Stack gap="sm">
          <Text size="sm" fw={500}>
            Location
          </Text>
          <TextInput
            label="Street address"
            value={editAddress}
            onChange={(e) => setEditAddress(e.currentTarget.value)}
          />
          <Group grow align="flex-start">
            <TextInput
              label="City"
              value={editCity}
              onChange={(e) => setEditCity(e.currentTarget.value)}
            />
            <Select
              label="State"
              data={US_STATES.map((s) => ({ value: s, label: s }))}
              value={editState}
              onChange={(v) => setEditState(v || '')}
              searchable
            />
            <TextInput
              label="ZIP"
              value={editZipCode}
              onChange={(e) => setEditZipCode(e.currentTarget.value)}
            />
          </Group>
          <Group grow align="flex-start">
            <TextInput
              label="Latitude"
              value={editLatitude}
              onChange={(e) => setEditLatitude(e.currentTarget.value)}
              placeholder="39.7684"
            />
            <TextInput
              label="Longitude"
              value={editLongitude}
              onChange={(e) => setEditLongitude(e.currentTarget.value)}
              placeholder="-86.1581"
            />
            <Button
              variant="light"
              onClick={handleGetCoordinates}
              loading={geocoding}
              mt={24}
            >
              Get Coordinates
            </Button>
          </Group>
        </Stack>

        <Divider />

        <Stack gap="sm">
          <Text size="sm" fw={500}>
            Contact
          </Text>
          <TextInput
            label="Phone"
            value={editPhone}
            onChange={(e) => setEditPhone(e.currentTarget.value)}
          />
          <TextInput
            label="Email"
            type="email"
            value={editEmail}
            onChange={(e) => setEditEmail(e.currentTarget.value)}
          />
          <TextInput
            label="Website"
            value={editWebsite}
            onChange={(e) => setEditWebsite(e.currentTarget.value)}
          />
        </Stack>

        <Divider />

        <Stack gap="sm">
          <Text size="sm" fw={500}>
            Correction notes for the reviewer
          </Text>
          <Textarea
            label="Notes"
            description="Use this for any other corrections, including the business name."
            value={editNotes}
            onChange={(e) => setEditNotes(e.currentTarget.value)}
            minRows={3}
          />
        </Stack>

        <Divider />

        <Stack gap="sm">
          <Text size="sm" fw={500}>
            Social media profiles
          </Text>
          {editSocialLinks.map((s, idx) => (
            <Group key={idx} grow align="flex-start">
              <TextInput
                label="Platform"
                value={s.platform}
                onChange={(e) =>
                  setEditSocialLinks((prev) =>
                    prev.map((p, i) => (i === idx ? { ...p, platform: e.currentTarget.value } : p))
                  )
                }
                placeholder="Facebook"
              />
              <TextInput
                label="Profile URL"
                value={s.url}
                onChange={(e) =>
                  setEditSocialLinks((prev) =>
                    prev.map((p, i) => (i === idx ? { ...p, url: e.currentTarget.value } : p))
                  )
                }
                placeholder="https://..."
              />
              <Button
                variant="subtle"
                color="red"
                onClick={() => setEditSocialLinks((prev) => prev.filter((_, i) => i !== idx))}
              >
                Remove
              </Button>
            </Group>
          ))}
          <Group>
            <Button
              variant="light"
              onClick={() => setEditSocialLinks((prev) => [...prev, { platform: '', url: '' }])}
            >
              Add Social Link
            </Button>
          </Group>
        </Stack>

        <Divider />

        <Stack gap="sm">
          <Text size="sm" fw={500}>
            Business hours
          </Text>
          <Select
            label="Timezone"
            data={TIMEZONE_OPTIONS.map((tz) => ({ value: tz, label: tz }))}
            value={editTimezone}
            onChange={(v) => { setHoursTouched(true); setEditTimezone(v || 'America/New_York'); }}
            searchable
          />
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
                        onChange={(e) => {
                          setHoursTouched(true);
                          setEditHours((prev) => ({
                            ...prev,
                            [day]: { ...prev[day], closed: !e.target.checked },
                          }));
                        }}
                      />
                      <span className="capitalize">{day}</span>
                    </label>
                  </div>
                  {!h.closed ? (
                    <>
                      <div className="md:col-span-4">
                        <input
                          type="time"
                          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                          value={h.open}
                          onChange={(e) => {
                            setHoursTouched(true);
                            setEditHours((prev) => ({
                              ...prev,
                              [day]: { ...prev[day], open: e.target.value },
                            }));
                          }}
                        />
                      </div>
                      <div className="md:col-span-1 text-center text-xs text-gray-400">to</div>
                      <div className="md:col-span-4">
                        <input
                          type="time"
                          className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm"
                          value={h.close}
                          onChange={(e) => {
                            setHoursTouched(true);
                            setEditHours((prev) => ({
                              ...prev,
                              [day]: { ...prev[day], close: e.target.value },
                            }));
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="md:col-span-9 text-sm text-gray-400">Closed</div>
                  )}
                </div>
              );
            })}
          </div>
        </Stack>

        <Group justify="flex-end">
          <Button onClick={handleSave}
            variant='gradient' style={{ color: 'white' }}
            loading={saving} leftSection={<span>+</span>}>
            Save Listing Updates
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
