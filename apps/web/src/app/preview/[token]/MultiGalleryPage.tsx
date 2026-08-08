'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import {
  Container,
  Card,
  Text,
  Title,
  Button,
  Alert,
  Group,
  Stack,
  Badge,
  Loader,
  Center,
  Box,
  Image,
  ActionIcon,
  Divider,
  Paper,
  Accordion,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconArrowLeft,
  IconArrowRight,
  IconClock,
  IconExternalLink,
  IconRefresh,
  IconAlertTriangle,
  IconCheck,
  IconHistory,
} from '@tabler/icons-react';
import Link from 'next/link';
import diagnosticGalleryPublicService, {
  type MultiGalleryData,
  type MultiGallerySiblingSection,
  type CompletedSiblingSection,
} from '@/services/DiagnosticGalleryPublicService';

const ARCHETYPE_COLORS: Record<string, string> = {
  A1: 'blue',
  A2: 'red',
  A3: 'orange',
  A4: 'grape',
  A5: 'teal',
  A6: 'indigo',
};

export default function MultiGalleryPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [data, setData] = useState<MultiGalleryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch multi-gallery data on mount
  useEffect(() => {
    if (!token) {
      setError('No token provided');
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const result = await diagnosticGalleryPublicService.getMultiGallery(token);
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load multi-gallery');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Track gallery_opened on mount
  useEffect(() => {
    if (!token || loading || !data || data.expired) return;
    diagnosticGalleryPublicService.trackEvent(token, {
      eventType: 'gallery_opened',
    }).catch(() => { /* fire-and-forget */ });
  }, [token, loading, data]);

  if (loading) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">Loading multi-diagnostic gallery...</Text>
        </Stack>
      </Center>
    );
  }

  if (error) {
    return (
      <Center h="100vh">
        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="filled" maw={500}>
          {error}
        </Alert>
      </Center>
    );
  }

  if (!data) {
    return (
      <Center h="100vh">
        <Text c="dimmed">No gallery data available</Text>
      </Center>
    );
  }

  if (data.expired) {
    return (
      <Center h="100vh">
        <Stack align="center" gap="lg" maw={500}>
          <IconAlertTriangle size={48} color="orange" />
          <Title order={3}>Gallery Link Expired</Title>
          <Text c="dimmed" ta="center">
            This multi-diagnostic gallery link expired
            {data.expiredAt ? ` on ${new Date(data.expiredAt).toLocaleDateString()}` : ''}.
          </Text>
          {data.reactivationUrl && (
            <Button
              component={Link}
              href={data.reactivationUrl}
              leftSection={<IconRefresh size={16} />}
              size="md"
            >
              Request a New Link
            </Button>
          )}
        </Stack>
      </Center>
    );
  }

  const siblings = data.siblings ?? [];
  if (siblings.length === 0) {
    return (
      <Center h="100vh">
        <Text c="dimmed">No eligible diagnostic galleries found</Text>
      </Center>
    );
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Stack gap="xs">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Title order={2}>
                {data.businessName ?? 'Multi-Diagnostic Gallery'}
              </Title>
              <Text c="dimmed" size="sm">
                {siblings.length} diagnostic {siblings.length === 1 ? 'report' : 'reports'} for your business
              </Text>
            </Stack>
            {data.token?.expiresAt && (
              <Badge variant="light" color="orange" leftSection={<IconClock size={12} />}>
                Expires {new Date(data.token.expiresAt).toLocaleDateString()}
              </Badge>
            )}
          </Group>
        </Stack>

        {/* Sibling sections — accordion for multi-sibling, single for 1 sibling */}
        {siblings.length === 1 ? (
          <SiblingSection section={siblings[0]} token={token} payUrl={data.payUrl} />
        ) : (
          <Accordion chevronPosition="right" variant="separated" defaultValue={siblings[0]?.campaignId}>
            {siblings.map((sibling, idx) => (
              <Accordion.Item key={sibling.campaignId} value={sibling.campaignId}>
                <Accordion.Control>
                  <Group justify="space-between">
                    <Stack gap={2}>
                      <Group gap="sm">
                        <Badge color={ARCHETYPE_COLORS[sibling.archetype] ?? 'gray'} variant="filled" size="sm">
                          {sibling.archetype}
                        </Badge>
                        <Text fw={600}>{sibling.galleryTitle}</Text>
                      </Group>
                      <Text c="dimmed" size="xs">{sibling.gallerySubtitle}</Text>
                    </Stack>
                    {sibling.isPrimarySibling && (
                      <Badge variant="light" color="green" size="xs">Primary</Badge>
                    )}
                  </Group>
                </Accordion.Control>
                <Accordion.Panel>
                  <SiblingSectionContent section={sibling} token={token} payUrl={data.payUrl} />
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        )}

        {/* Completed Work — badge of honor history section (§8.3, §8.4) */}
        {data.completedSiblings && data.completedSiblings.length > 0 && (
          <CompletedWorkSection completedSiblings={data.completedSiblings} />
        )}

        {/* Global CTA */}
        <Card withBorder p="lg" radius="md" bg="var(--mantine-color-blue-0)">
          <Group justify="space-between" align="center">
            <Stack gap={4}>
              <Text fw={700} size="lg">Ready to get started?</Text>
              <Text c="dimmed" size="sm">
                Choose a diagnostic report above to start fixing your visibility gaps.
              </Text>
            </Stack>
            {data.payUrl && (
              <Button
                component={Link}
                href={data.payUrl}
                size="md"
                leftSection={<IconExternalLink size={16} />}
              >
                View Pricing
              </Button>
            )}
          </Group>
        </Card>
      </Stack>
    </Container>
  );
}

// ─── Sibling section (standalone for single-sibling case) ────────────────

function SiblingSection({
  section,
  token,
  payUrl,
}: {
  section: MultiGallerySiblingSection;
  token: string;
  payUrl?: string;
}) {
  return (
    <Card withBorder p="lg" radius="md">
      <SiblingSectionContent section={section} token={token} payUrl={payUrl} />
    </Card>
  );
}

// ─── Sibling section content (shared between accordion + standalone) ─────

function SiblingSectionContent({
  section,
  token,
  payUrl,
}: {
  section: MultiGallerySiblingSection;
  token: string;
  payUrl?: string;
}) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const screenshots = section.screenshots ?? [];

  const nextSlide = useCallback(() => {
    if (screenshots.length === 0) return;
    setCurrentSlide((prev) => (prev + 1) % screenshots.length);
    diagnosticGalleryPublicService.trackEvent(token, {
      eventType: 'carousel_next',
      siblingCampaignId: section.campaignId,
    }).catch(() => {});
  }, [screenshots.length, token, section.campaignId]);

  const prevSlide = useCallback(() => {
    if (screenshots.length === 0) return;
    setCurrentSlide((prev) => (prev - 1 + screenshots.length) % screenshots.length);
    diagnosticGalleryPublicService.trackEvent(token, {
      eventType: 'carousel_prev',
      siblingCampaignId: section.campaignId,
    }).catch(() => {});
  }, [screenshots.length, token, section.campaignId]);

  const onCtaClick = useCallback(() => {
    diagnosticGalleryPublicService.trackEvent(token, {
      eventType: 'cta_clicked',
      siblingCampaignId: section.campaignId,
    }).catch(() => {});
  }, [token, section.campaignId]);

  return (
    <Stack gap="md">
      {/* Archetype badge + title */}
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Group gap="sm">
            <Badge color={ARCHETYPE_COLORS[section.archetype] ?? 'gray'} variant="filled">
              {section.archetype}
            </Badge>
            {section.isPrimarySibling && (
              <Badge variant="light" color="green" size="sm">Primary</Badge>
            )}
          </Group>
          <Title order={4}>{section.galleryTitle}</Title>
          <Text c="dimmed" size="sm">{section.gallerySubtitle}</Text>
        </Stack>
      </Group>

      <Divider />

      {/* Friction summary */}
      {section.frictionSummary && Object.keys(section.frictionSummary).length > 0 && (
        <Paper p="sm" withBorder radius="sm" bg="var(--mantine-color-gray-0)">
          <Stack gap={4}>
            {Object.entries(section.frictionSummary).map(([key, value]) => (
              <Group key={key} justify="space-between">
                <Text size="sm" c="dimmed">{key.replace(/_/g, ' ')}:</Text>
                <Text size="sm" fw={500}>{String(value)}</Text>
              </Group>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Screenshot carousel */}
      {screenshots.length > 0 && (
        <Box>
          <Group justify="center" gap="xs" mb="sm">
            <ActionIcon variant="subtle" onClick={prevSlide} disabled={screenshots.length <= 1}>
              <IconArrowLeft size={16} />
            </ActionIcon>
            <Text size="sm" c="dimmed">
              {currentSlide + 1} / {screenshots.length}
            </Text>
            <ActionIcon variant="subtle" onClick={nextSlide} disabled={screenshots.length <= 1}>
              <IconArrowRight size={16} />
            </ActionIcon>
          </Group>
          {screenshots[currentSlide]?.signedUrl && (
            <Image
              src={screenshots[currentSlide].signedUrl}
              alt={screenshots[currentSlide].fileName}
              radius="md"
              fit="contain"
              mah={400}
            />
          )}
        </Box>
      )}

      {/* CTA */}
      <Group justify="flex-end">
        <Button
          onClick={onCtaClick}
          component={Link}
          href={payUrl || '#'}
          leftSection={<IconExternalLink size={16} />}
        >
          {section.ctaLabel}
          {section.ctaAmountCents != null && (
            <Text span size="sm" opacity={0.8} ml={4}>
              (${(section.ctaAmountCents / 100).toFixed(0)})
            </Text>
          )}
        </Button>
      </Group>
    </Stack>
  );
}

// ─── Completed Work section (badge of honor — §8.3, §8.4) ────────────────

const STAGE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  paid: { label: 'In Progress', color: 'blue' },
  delivered: { label: 'Delivered', color: 'green' },
  retainer_pitched: { label: 'Retainer Pitched', color: 'teal' },
  retainer_won: { label: 'Active Plan', color: 'grape' },
  tenant_onboarded: { label: 'Onboarded', color: 'indigo' },
};

function CompletedWorkSection({ completedSiblings }: { completedSiblings: CompletedSiblingSection[] }) {
  return (
    <Card withBorder p="lg" radius="md" bg="var(--mantine-color-gray-0)">
      <Stack gap="md">
        <Group gap="sm">
          <IconHistory size={20} className="text-gray-500" />
          <Stack gap={0}>
            <Text fw={700} size="sm">Completed Work</Text>
            <Text c="dimmed" size="xs">
              {completedSiblings.length} service{completedSiblings.length !== 1 ? 's' : ''} already purchased — your journey so far
            </Text>
          </Stack>
        </Group>

        <Divider />

        <Stack gap="xs">
          {completedSiblings.map((sibling) => {
            const status = STAGE_STATUS_LABELS[sibling.stage] ?? { label: sibling.stage, color: 'gray' };
            return (
              <Group key={sibling.campaignId} justify="space-between" align="center">
                <Group gap="sm">
                  <IconCheck size={16} className="text-green-600" />
                  <Stack gap={0}>
                    <Group gap="xs">
                      <Badge color={ARCHETYPE_COLORS[sibling.archetype] ?? 'gray'} variant="light" size="sm">
                        {sibling.archetype}
                      </Badge>
                      <Text size="sm" fw={500}>{sibling.galleryTitle}</Text>
                    </Group>
                    <Text c="dimmed" size="xs">
                      {sibling.campaignCategory.replace(/_/g, ' ')}
                      {sibling.engagementCycle > 1 && ` · Cycle ${sibling.engagementCycle}`}
                    </Text>
                  </Stack>
                </Group>
                <Group gap="sm">
                  <Badge variant="light" color={status.color} size="sm">
                    {status.label}
                  </Badge>
                  {sibling.datePaid && (
                    <Text c="dimmed" size="xs">
                      {new Date(sibling.datePaid).toLocaleDateString()}
                    </Text>
                  )}
                </Group>
              </Group>
            );
          })}
        </Stack>
      </Stack>
    </Card>
  );
}
