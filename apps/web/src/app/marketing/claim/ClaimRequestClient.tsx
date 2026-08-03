'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Container,
  Card,
  Text,
  Title,
  Button,
  TextInput,
  Alert,
  Stack,
  ThemeIcon,
  Center,
  Group,
} from '@mantine/core';
import { IconMail, IconCheck, IconArrowLeft, IconPackage } from '@tabler/icons-react';
import marketingClaimPublicService from '@/services/MarketingClaimPublicService';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';

/**
 * /marketing/claim — "Track my purchase" entry page (§7.1a, Path B).
 *
 * Single email field + submit. Always shows the generic confirmation
 * ("If we found purchases for this email, we've sent you a link") regardless
 * of matches (enumeration resistance). Linked from the pay page footer,
 * receipt emails, and the customer login page.
 */
export default function ClaimRequestClient() {
  const searchParams = useSearchParams();
  const prefilledEmail = searchParams?.get('email') || '';
  const { settings } = usePlatformSettings();

  const [email, setEmail] = useState(prefilledEmail);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await marketingClaimPublicService.requestClaimInvite(email.trim());
      setSubmitted(true);
    } catch (err: any) {
      // Even on error, show the generic confirmation (enumeration resistance)
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Container size="sm" className="py-20">
        <Card withBorder shadow="sm" padding="xl" radius="md">
          <Stack align="center" gap="lg" className="text-center">
            <ThemeIcon size={64} radius="xl" color="blue">
              <IconMail size="2rem" />
            </ThemeIcon>
            <Title order={2}>Check your email</Title>
            <Text size="lg" c="dimmed">
              If we found any purchases for <strong>{email}</strong>, we&apos;ve sent you a link to claim your account.
            </Text>
            <Text size="sm" c="dimmed">
              The link expires in 24 hours. If you don&apos;t see it, check your spam folder.
            </Text>
            <Group>
              <Button variant="subtle" leftSection={<IconArrowLeft size="1rem" />} onClick={() => setSubmitted(false)}>
                Use a different email
              </Button>
              <Link href="/" style={{ textDecoration: 'none' }}>
                <Button variant="subtle">Back to home</Button>
              </Link>
            </Group>
          </Stack>
        </Card>
      </Container>
    );
  }

  return (
    <Container size="sm" className="py-20">
      <Stack gap="lg">
        <Group justify="center">
          <ThemeIcon size={48} radius="xl" color="blue" variant="light">
            <IconPackage size="1.5rem" />
          </ThemeIcon>
        </Group>
        <Title order={2} ta="center">
          Track your purchase
        </Title>
        <Text ta="center" c="dimmed" size="lg">
          Enter the email you used to pay. We&apos;ll send you a link to create your account and track your order.
        </Text>

        <Card withBorder shadow="sm" padding="xl" radius="md">
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              <TextInput
                label="Email address"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                size="md"
                leftSection={<IconMail size="1rem" />}
                disabled={submitting}
              />
              {error && (
                <Alert color="red">{error}</Alert>
              )}
              <Button type="submit" size="lg" fullWidth loading={submitting}>
                {submitting ? 'Sending...' : 'Send claim link'}
              </Button>
            </Stack>
          </form>
        </Card>

        <Center>
          <Group gap="xs">
            <Text size="sm" c="dimmed">Already have an account?</Text>
            <Link href="/customerlogin" style={{ textDecoration: 'none' }}>
              <Text size="sm" c="blue" fw={500}>Sign in</Text>
            </Link>
          </Group>
        </Center>

        <Center>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <Text size="xs" c="dimmed">{settings?.platformName || 'VisibleShelf'}</Text>
          </Link>
        </Center>
      </Stack>
    </Container>
  );
}
