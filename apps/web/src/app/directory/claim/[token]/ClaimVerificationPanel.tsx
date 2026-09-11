'use client';

/**
 * ClaimVerificationPanel — the claim-time owner verification step
 * (migration 274).
 *
 * Before the claim can be submitted the owner must review and confirm two
 * datapoints about their business:
 *
 *   + categories — primary + secondary. Selections from the platform
 *     directory / registered vocab are minted immediately. Labels the owner
 *     types that aren't in the vocab are held as owner_proposed_categories
 *     for operator acceptance — an abuse gate, never written straight to the
 *     listing.
 *   + attributes — sourced attribute chips are shown as toggles (on by
 *     default); the owner can reject any of them, add suggested chips from
 *     the attribute-definition library, or add custom ones. The owner is
 *     authoritative — the submitted set becomes the listing's attributes.
 *
 * The confirmation checkbox is the contract of consent: the parent gates
 * the Claim button on `onChange` emitting a non-null verification. The
 * backend mints the payload at claim submit (POST /claim/:token/initiate)
 * with provenance source_name='owner_claim'.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { IconCheck, IconClock, IconPlus, IconTag, IconX } from '@tabler/icons-react';
import DirectoryCategorySelectorAdapter from '@/components/directory/DirectoryCategorySelectorAdapter';
import { useDirectoryCategories } from '@/hooks/directory/useDirectoryCategories';
import placesBrowsePublicService from '@/services/PlacesBrowsePublicService';
import directoryClaimPublicService, {
  ClaimListingAttribute,
  DirectoryClaimSummary,
  OwnerClaimVerification,
} from '@/services/DirectoryClaimPublicService';

interface AttrRow {
  key: string;
  label: string;
  on: boolean;
  /** True when the owner added this chip (vs. sourced from an audit). */
  ownerAdded: boolean;
}

export default function ClaimVerificationPanel({
  summary,
  onChange,
}: {
  summary: DirectoryClaimSummary;
  /** Emits the verification payload once the consent box is checked and a
   *  primary category exists; null while the owner hasn't confirmed. */
  onChange: (verification: OwnerClaimVerification | null) => void;
}) {
  const [primary, setPrimary] = useState(summary.primaryCategory || summary.category || '');
  const [secondary, setSecondary] = useState<string[]>(
    Array.isArray(summary.secondaryCategories) ? summary.secondaryCategories : [],
  );
  const [attrs, setAttrs] = useState<AttrRow[]>(() =>
    (Array.isArray(summary.attributes) ? summary.attributes : []).map((a: ClaimListingAttribute) => ({
      key: a.key,
      label: a.label,
      on: true,
      ownerAdded: false,
    })),
  );
  const [suggestions, setSuggestions] = useState<{ attributeKey: string; label: string; groupKey: string }[]>([]);
  const [customAttr, setCustomAttr] = useState('');
  const [consent, setConsent] = useState(false);

  const { categories } = useDirectoryCategories();
  const [vocabLabels, setVocabLabels] = useState<string[]>([]);
  const [vocabLoaded, setVocabLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await placesBrowsePublicService.getCategoryVocab();
      if (!cancelled) {
        setVocabLabels((rows ?? []).map((r) => r.label));
        setVocabLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const category = primary || summary.category;
    (async () => {
      const defs = await directoryClaimPublicService.getAttributeDefinitions(category);
      if (!cancelled) setSuggestions(defs);
    })();
    return () => { cancelled = true; };
    // Suggestions follow the primary category the owner lands on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primary]);

  // Known label set = platform directory categories + registered vocab.
  // Until the vocab fetch resolves we don't classify — a selected label is
  // only "proposed" once we can positively say it's not known.
  const knownSet = useMemo(() => {
    const s = new Set<string>();
    for (const c of categories) if (c.name) s.add(c.name.trim().toLowerCase());
    for (const l of vocabLabels) if (l) s.add(l.trim().toLowerCase());
    return s;
  }, [categories, vocabLabels]);

  const proposedPrimary = vocabLoaded && primary && !knownSet.has(primary.trim().toLowerCase());
  const proposedSecondary = vocabLoaded
    ? secondary.filter((s) => s.trim() && !knownSet.has(s.trim().toLowerCase()))
    : [];
  const pendingFromServer = (summary.ownerProposedCategories || []).filter((p) => p.status === 'pending');

  const unselectedSuggestions = useMemo(
    () => suggestions.filter((d) => !attrs.some((a) => a.key === d.attributeKey)),
    [suggestions, attrs],
  );

  useEffect(() => {
    if (!consent || !primary.trim()) {
      onChange(null);
      return;
    }
    onChange({
      primaryCategory: primary.trim(),
      secondaryCategories: secondary.map((s) => s.trim()).filter(Boolean),
      attributes: attrs.filter((a) => a.on).map((a) => ({ key: a.key, label: a.label })),
      confirmed: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consent, primary, secondary, attrs]);

  const addCustomAttr = () => {
    const label = customAttr.trim();
    if (!label) return;
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!key || attrs.some((a) => a.key === key)) {
      setCustomAttr('');
      return;
    }
    setAttrs((prev) => [...prev, { key, label, on: true, ownerAdded: true }]);
    setCustomAttr('');
  };

  return (
    <Card withBorder shadow="xs" padding="lg" radius="md">
      <Stack gap="md">
        <div>
          <Group gap="xs">
            <ThemeIcon size={22} radius="xl" color="blue" variant="light">
              <IconTag size={14} />
            </ThemeIcon>
            <Text fw={600} size="lg">Verify your business info</Text>
          </Group>
          <Text size="sm" c="dimmed" mt={4}>
            Before claiming, please review the categories and attributes we have on file.
            Your confirmation becomes the official record for your listing — the business
            owner, not the platform, attests that this information is accurate.
          </Text>
        </div>

        <Divider />

        {/* Categories */}
        <Stack gap="xs">
          <Text size="sm" fw={500}>Categories</Text>
          <Text size="xs" c="dimmed">
            Confirm the categories your business should be listed under.
          </Text>
          <DirectoryCategorySelectorAdapter
            primary={primary}
            secondary={secondary}
            onPrimaryChange={setPrimary}
            onSecondaryChange={setSecondary}
          />
          {(proposedPrimary || proposedSecondary.length > 0 || pendingFromServer.length > 0) && (
            <Stack gap={4}>
              {proposedPrimary && (
                <Group gap="xs">
                  <Badge color="orange" variant="light" leftSection={<IconClock size={12} />}>
                    {primary} (primary)
                  </Badge>
                  <Text size="xs" c="dimmed">new category — sent for operator review</Text>
                </Group>
              )}
              {proposedSecondary.map((label) => (
                <Group gap="xs" key={label}>
                  <Badge color="orange" variant="light" leftSection={<IconClock size={12} />}>
                    {label}
                  </Badge>
                  <Text size="xs" c="dimmed">new category — sent for operator review</Text>
                </Group>
              ))}
              {pendingFromServer.map((p) => (
                <Group gap="xs" key={p.label}>
                  <Badge color="gray" variant="light" leftSection={<IconClock size={12} />}>
                    {p.label}
                  </Badge>
                  <Text size="xs" c="dimmed">pending operator review</Text>
                </Group>
              ))}
              <Text size="xs" c="dimmed">
                New categories aren&apos;t published until our team approves them.
              </Text>
            </Stack>
          )}
        </Stack>

        <Divider />

        {/* Attributes */}
        <Stack gap="xs">
          <Text size="sm" fw={500}>Attributes</Text>
          <Text size="xs" c="dimmed">
            These details were found on public listings. Keep the ones that are true —
            turn off anything that doesn&apos;t apply, and add anything we missed.
          </Text>
          {attrs.length === 0 && unselectedSuggestions.length === 0 ? (
            <Text size="sm" c="dimmed">No attributes on file for this listing.</Text>
          ) : (
            <Group gap="xs">
              {attrs.map((a) => (
                <Badge
                  key={a.key}
                  size="lg"
                  variant={a.on ? 'filled' : 'outline'}
                  color={a.on ? 'blue' : 'gray'}
                  style={{ cursor: 'pointer', textTransform: 'none' }}
                  rightSection={a.on ? <IconCheck size={12} /> : <IconX size={12} />}
                  onClick={() =>
                    setAttrs((prev) => prev.map((p) => (p.key === a.key ? { ...p, on: !p.on } : p)))
                  }
                >
                  {a.label}
                </Badge>
              ))}
            </Group>
          )}
          {unselectedSuggestions.length > 0 && (
            <Stack gap={4}>
              <Text size="xs" c="dimmed">Suggestions — tap to add:</Text>
              <Group gap="xs">
                {unselectedSuggestions.map((d) => (
                  <Badge
                    key={d.attributeKey}
                    size="lg"
                    variant="light"
                    color="gray"
                    style={{ cursor: 'pointer', textTransform: 'none' }}
                    leftSection={<IconPlus size={12} />}
                    onClick={() =>
                      setAttrs((prev) => [
                        ...prev,
                        { key: d.attributeKey, label: d.label, on: true, ownerAdded: true },
                      ])
                    }
                  >
                    {d.label}
                  </Badge>
                ))}
              </Group>
            </Stack>
          )}
          <Group gap="xs" align="flex-end">
            <TextInput
              label="Add an attribute"
              placeholder="e.g. Wheelchair accessible"
              value={customAttr}
              onChange={(e) => setCustomAttr(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomAttr();
                }
              }}
              size="sm"
              style={{ flex: 1 }}
            />
            <Button variant="light" size="sm" onClick={addCustomAttr} leftSection={<IconPlus size={14} />}>
              Add
            </Button>
          </Group>
        </Stack>

        <Divider />

        <Checkbox
          checked={consent}
          onChange={(e) => setConsent(e.currentTarget.checked)}
          label={
            <Text size="sm">
              I confirm that the categories and attributes above accurately describe my business.
            </Text>
          }
        />
      </Stack>
    </Card>
  );
}
