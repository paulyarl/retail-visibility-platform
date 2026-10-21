'use client';

import { useEffect, useState } from 'react';
import { Alert, Stack, Text } from '@mantine/core';
import { IconCheck, IconLink } from '@tabler/icons-react';
import directoryClaimPublicService from '@/services/DirectoryClaimPublicService';
import { clientLogger } from '@/lib/client-logger';

interface ClaimSlugPattern {
  pattern: string;
  slug: string;
  isAvailable: boolean;
  isOwnSlug: boolean;
  description: string;
  unavailableReason?: string;
}

/**
 * Address-aware public-URL picker for the claim flow. The prospect chooses
 * the slug their listing (and storefront) resolves under — saved
 * immediately on select via the token-gated listing PUT, the same write the
 * corrections editor uses. A free-text entry (any personal, cultural, or
 * invented name — it does not have to contain the business name) goes
 * through the same token-gated availability check as the generated
 * patterns; selection there is confirmed explicitly since select = save.
 * Owns the slug field during claim; the corrections editor intentionally no
 * longer carries it.
 */
export default function ClaimSlugPicker({
  token,
  currentSlug,
  onSaved,
}: {
  token: string;
  currentSlug?: string | null;
  onSaved?: () => void;
}) {
  const [patterns, setPatterns] = useState<ClaimSlugPattern[]>([]);
  const [selected, setSelected] = useState(currentSlug ?? '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Free-text entry — checked through the token-gated slug-check endpoint
  // with the same ruleset as the generated patterns.
  const [customInput, setCustomInput] = useState('');
  const [customStatus, setCustomStatus] = useState<{
    state: 'idle' | 'checking' | 'available' | 'unavailable';
    reason?: string;
    own?: boolean;
  }>({ state: 'idle' });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const result = await directoryClaimPublicService.getSlugPatterns(token);
      if (!cancelled) setPatterns(result);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (currentSlug) setSelected((prev) => prev || currentSlug);
  }, [currentSlug]);

  // Same normalization the write path applies (ensureUniqueSlug) — the value
  // checked is the value that gets written.
  const customSlug = customInput
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  // Debounced availability check for the free-text entry.
  useEffect(() => {
    if (!customSlug) {
      setCustomStatus({ state: 'idle' });
      return;
    }
    setCustomStatus({ state: 'checking' });
    const timeoutId = setTimeout(async () => {
      const result = await directoryClaimPublicService.checkSlugAvailability(token, customSlug);
      if (!result) {
        setCustomStatus({ state: 'idle' });
        return;
      }
      setCustomStatus(
        result.available
          ? { state: 'available', own: result.own }
          : { state: 'unavailable', reason: result.code }
      );
    }, 600);
    return () => clearTimeout(timeoutId);
  }, [customSlug, token]);

  const handleSelect = async (slug: string) => {
    if (saving || slug === selected) return;
    const previous = selected;
    setSelected(slug);
    setSaving(true);
    setError(null);
    const result = await directoryClaimPublicService.updateListing(token, { slug });
    setSaving(false);
    if (!result.success) {
      setSelected(previous);
      setError(
        result.error === 'slug_taken'
          ? 'That address was just taken — pick another option.'
          : 'Could not save your web address. Please try again.',
      );
      clientLogger.error('Claim slug save failed', { detail: result.error });
      return;
    }
    onSaved?.();
  };

  if (loading) {
    return <Text size="sm" c="dimmed">Loading your web address options…</Text>;
  }

  const isCustomSelected = !!customSlug && selected === customSlug;

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        Choose your public web address
      </Text>
      <Text size="xs" c="dimmed">
        This is the link customers use to find your listing — and it carries
        over to your storefront.
      </Text>
      <div className="space-y-2">
        {patterns.map((p) => {
          const isSelected = selected === p.slug;
          return (
            <label
              key={p.slug}
              className={`
                flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all
                ${isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : p.isAvailable || p.isOwnSlug
                    ? 'border-gray-200 hover:border-gray-300 bg-white'
                    : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                }
              `}
            >
              <input
                type="radio"
                name="claim-slug"
                value={p.slug}
                checked={isSelected}
                disabled={!p.isAvailable || saving}
                onChange={() => handleSelect(p.slug)}
                className="mt-1"
              />
              <div>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded">
                    /directory/{p.slug}
                  </code>
                  {p.isOwnSlug && (
                    <span className="text-xs text-purple-600 font-medium inline-flex items-center gap-0.5">
                      <IconCheck size={12} /> Current
                    </span>
                  )}
                  {!p.isAvailable && !p.isOwnSlug && (
                    <span className="text-xs text-red-500 font-medium">
                      {p.unavailableReason === 'reserved_place_slug' ? 'Reserved' : 'Taken'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">{p.description}</p>
              </div>
            </label>
          );
        })}

        {/* Free-text entry — any personal, cultural, or invented name; same
            availability ruleset as the suggestions. Selection is an explicit
            button because selecting saves immediately. */}
        <div
          className={`
            flex items-start gap-3 p-3 rounded-lg border-2 transition-all
            ${isCustomSelected
              ? 'border-blue-500 bg-blue-50'
              : 'border-dashed border-gray-300 bg-white'
            }
          `}
        >
          <input
            type="radio"
            name="claim-slug"
            checked={isCustomSelected}
            readOnly
            className="mt-1"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono bg-gray-100 px-2 py-0.5 rounded">
                /directory/{customSlug || 'your-address'}
              </code>
              {customStatus.state === 'checking' && (
                <span className="text-xs text-gray-500 font-medium">Checking…</span>
              )}
              {customStatus.state === 'available' && (
                customStatus.own ? (
                  <span className="text-xs text-purple-600 font-medium inline-flex items-center gap-0.5">
                    <IconCheck size={12} /> Current
                  </span>
                ) : (
                  <span className="text-xs text-green-600 font-medium inline-flex items-center gap-0.5">
                    <IconCheck size={12} /> Available
                  </span>
                )
              )}
              {customStatus.state === 'unavailable' && (
                <span className="text-xs text-red-500 font-medium">
                  {customStatus.reason === 'reserved_place_slug' ? 'Reserved' : 'Taken'}
                </span>
              )}
            </div>
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="Or type your own…"
                disabled={saving}
                className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                disabled={customStatus.state !== 'available' || saving}
                onClick={() => handleSelect(customSlug)}
                className="text-xs font-medium px-3 py-1 rounded bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700"
              >
                Use this address
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Lowercase letters, numbers, and hyphens — any name you like, checked for availability as you type.
            </p>
          </div>
        </div>
      </div>
      {saving && (
        <Text size="xs" c="dimmed">Saving your web address…</Text>
      )}
      {error && (
        <Alert color="red" variant="light">{error}</Alert>
      )}
      {selected && !saving && !error && (
        <Text size="xs" c="teal" className="inline-flex items-center gap-1">
          <IconLink size={12} />
          Saved — your listing will be at /directory/{selected}
        </Text>
      )}
    </Stack>
  );
}
