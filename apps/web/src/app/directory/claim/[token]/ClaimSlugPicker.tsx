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
}

/**
 * Address-aware public-URL picker for the claim flow. The prospect chooses
 * the slug their listing (and storefront) resolves under — saved
 * immediately on select via the token-gated listing PUT, the same write the
 * corrections editor uses. Owns the slug field during claim; the corrections
 * editor intentionally no longer carries it.
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
  if (patterns.length === 0) return null;

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
                    <span className="text-xs text-red-500 font-medium">Taken</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">{p.description}</p>
              </div>
            </label>
          );
        })}
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
