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
  Progress,
  Divider,
  ThemeIcon,
  Paper,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconArrowLeft,
  IconArrowRight,
  IconClock,
  IconExternalLink,
  IconRefresh,
  IconAlertTriangle,
} from '@tabler/icons-react';
import Link from 'next/link';
import diagnosticGalleryPublicService, {
  type GalleryData,
} from '@/services/DiagnosticGalleryPublicService';
import { useGalleryTracking } from './useGalleryTracking';

export default function GalleryClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [data, setData] = useState<GalleryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [countdown, setCountdown] = useState<string>('');

  // Fetch gallery data on mount
  useEffect(() => {
    if (!token) {
      setError('No token provided');
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const result = await diagnosticGalleryPublicService.getGallery(token);
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load gallery');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Countdown timer — client-side setInterval
  useEffect(() => {
    if (!data || data.expired || !data.token?.expiresAt) return;
    const expiresAt = new Date(data.token.expiresAt).getTime();

    const updateCountdown = () => {
      const now = Date.now();
      const diff = expiresAt - now;
      if (diff <= 0) {
        setCountdown('Expired');
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      if (days > 0) {
        setCountdown(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setCountdown(`${minutes}m ${seconds}s`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [data]);

  const isActive = !!(data && !data.expired && data.gallery);
  const screenshots = data?.screenshots ?? [];
  const totalScreenshots = screenshots.length;

  const tracking = useGalleryTracking({
    token,
    active: isActive,
    totalScreenshots,
  });

  // Carousel navigation
  const goToSlide = useCallback(
    (newSlide: number) => {
      if (!isActive || totalScreenshots === 0) return;
      const clamped = Math.max(0, Math.min(newSlide, totalScreenshots - 1));
      if (clamped === currentSlide) return;
      const direction = clamped > currentSlide ? 'next' : 'prev';
      setCurrentSlide(clamped);
      tracking.onSlideChange(clamped, direction);
    },
    [isActive, totalScreenshots, currentSlide, tracking]
  );

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        goToSlide(currentSlide + 1);
      } else if (e.key === 'ArrowLeft') {
        goToSlide(currentSlide - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, currentSlide, goToSlide]);

  // ─── Loading state ──────────────────────────────────────────────────
  if (loading) {
    return (
      <Container size="sm" py="xl">
        <Center>
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text c="dimmed">Loading diagnostic gallery...</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  // ─── Error state ────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <Container size="sm" py="xl">
        <Card withBorder shadow="sm" p="xl" radius="md">
          <Stack align="center" gap="md" ta="center">
            <ThemeIcon color="red" size={64} radius="xl">
              <IconAlertTriangle size={32} />
            </ThemeIcon>
            <Title order={3}>Gallery Unavailable</Title>
            <Text c="dimmed">
              {error || 'This diagnostic gallery could not be loaded. The link may be invalid or expired.'}
            </Text>
          </Stack>
        </Card>
      </Container>
    );
  }

  // ─── Expired state ──────────────────────────────────────────────────
  if (data.expired) {
    return (
      <Container size="sm" py="xl">
        <Card withBorder shadow="sm" p="xl" radius="md">
          <Stack align="center" gap="lg" ta="center">
            <ThemeIcon color="orange" size={64} radius="xl">
              <IconClock size={32} />
            </ThemeIcon>
            <Title order={3}>Diagnostic Report Expired</Title>
            <Text c="dimmed" size="lg">
              {data.businessName ? `${data.businessName}'s` : 'This'} diagnostic report link has expired.
            </Text>
            {data.expiredAt && (
              <Text size="sm" c="dimmed">
                Expired on {new Date(data.expiredAt).toLocaleDateString()}
              </Text>
            )}
            <Divider w="100%" />
            <Stack gap="sm" align="center">
              <Text fw={500}>Need a fresh diagnostic?</Text>
              <Button
                component={Link}
                href={data.reactivationUrl || '/marketing/claim?expired=true'}
                leftSection={<IconRefresh size={18} />}
                size="lg"
              >
                Request Fresh Scan
              </Button>
            </Stack>
          </Stack>
        </Card>
      </Container>
    );
  }

  // ─── Active gallery ─────────────────────────────────────────────────
  const gallery = data.gallery!;
  const campaign = data.campaign;
  const ctaAmount = gallery.ctaAmountCents;
  const ctaAmountDisplay = ctaAmount != null ? `$${(ctaAmount / 100).toFixed(2)}` : null;

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Card withBorder shadow="sm" p="lg" radius="md">
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Stack gap="xs">
              {gallery.archetype && (
                <Badge variant="light" color="blue" size="sm">
                  {gallery.archetype} Diagnostic
                </Badge>
              )}
              <Title order={2}>{gallery.title || 'Diagnostic Report'}</Title>
              {gallery.subtitle && (
                <Text c="dimmed" size="md">
                  {gallery.subtitle}
                </Text>
              )}
              {campaign?.businessName && (
                <Text size="sm" c="dimmed" fw={500}>
                  {campaign.businessName}
                </Text>
              )}
            </Stack>
            {countdown && (
              <Badge variant="light" color="orange" size="lg" leftSection={<IconClock size={14} />}>
                {countdown}
              </Badge>
            )}
          </Group>
        </Card>

        {/* Friction Summary */}
        {gallery.frictionSummary && Object.keys(gallery.frictionSummary).length > 0 && (
          <Card withBorder p="lg" radius="md" bg="gray.0">
            <Stack gap="sm">
              <Text fw={600} size="sm" c="dimmed" tt="uppercase">
                What We Found
              </Text>
              {Object.entries(gallery.frictionSummary).map(([key, value]) => (
                <Group key={key} gap="xs">
                  <Text size="sm" fw={500} c="dimmed">
                    {key.replace(/_/g, ' ')}:
                  </Text>
                  <Text size="sm">{String(value)}</Text>
                </Group>
              ))}
            </Stack>
          </Card>
        )}

        {/* Screenshot Carousel */}
        {totalScreenshots > 0 && (
          <Card withBorder shadow="sm" p="0" radius="md" style={{ overflow: 'hidden' }}>
            <Box style={{ position: 'relative' }}>
              {/* Screenshot image */}
              <Box style={{ minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa' }}>
                {screenshots[currentSlide]?.signedUrl ? (
                  <Image
                    src={screenshots[currentSlide].signedUrl!}
                    alt={screenshots[currentSlide].fileName || `Screenshot ${currentSlide + 1}`}
                    fit="contain"
                    style={{ maxHeight: 500, width: '100%' }}
                  />
                ) : (
                  <Text c="dimmed">Screenshot unavailable</Text>
                )}
              </Box>

              {/* Navigation arrows */}
              {totalScreenshots > 1 && (
                <>
                  <ActionIcon
                    variant="filled"
                    color="dark"
                    size="lg"
                    radius="xl"
                    style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
                    onClick={() => goToSlide(currentSlide - 1)}
                    disabled={currentSlide === 0}
                    aria-label="Previous screenshot"
                  >
                    <IconArrowLeft size={20} />
                  </ActionIcon>
                  <ActionIcon
                    variant="filled"
                    color="dark"
                    size="lg"
                    radius="xl"
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}
                    onClick={() => goToSlide(currentSlide + 1)}
                    disabled={currentSlide === totalScreenshots - 1}
                    aria-label="Next screenshot"
                  >
                    <IconArrowRight size={20} />
                  </ActionIcon>
                </>
              )}

              {/* Slide counter + progress */}
              {totalScreenshots > 1 && (
                <Box p="sm" style={{ background: 'rgba(255,255,255,0.9)' }}>
                  <Group justify="space-between" mb={4}>
                    <Text size="sm" c="dimmed">
                      {currentSlide + 1} of {totalScreenshots}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Use arrow keys to navigate
                    </Text>
                  </Group>
                  <Progress
                    value={((currentSlide + 1) / totalScreenshots) * 100}
                    size="sm"
                    color="blue"
                  />
                </Box>
              )}
            </Box>
          </Card>
        )}

        {/* CTA */}
        <Card withBorder shadow="sm" p="lg" radius="md">
          <Stack gap="md" align="center" ta="center">
            <Title order={4}>Ready to Fix This?</Title>
            <Text c="dimmed">
              {gallery.ctaLabel || 'Start Recovery'} — get your diagnostic report and action plan today.
            </Text>
            {ctaAmountDisplay && (
              <Badge variant="filled" color="green" size="lg">
                {ctaAmountDisplay}
              </Badge>
            )}
            <Button
              component={Link}
              href={data.payUrl || `/marketing/pay?ptoken=${token}`}
              size="lg"
              leftSection={<IconExternalLink size={18} />}
              onClick={tracking.onCtaClick}
              onMouseEnter={tracking.onCtaHoverStart}
              onMouseLeave={tracking.onCtaHoverEnd}
            >
              {gallery.ctaLabel || 'Start Recovery'}
            </Button>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
