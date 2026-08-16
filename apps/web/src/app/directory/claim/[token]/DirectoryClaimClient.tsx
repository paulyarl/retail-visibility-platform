'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Container,
  Card,
  Text,
  Title,
  Button,
  Alert,
  Stack,
  ThemeIcon,
  Center,
  Group,
  Loader,
  Badge,
  Divider,
} from '@mantine/core';
import {
  IconCheck,
  IconAlertCircle,
  IconMapPin,
  IconPhone,
  IconClock,
  IconArrowLeft,
  IconShoppingCart,
} from '@tabler/icons-react';
import directoryClaimPublicService, {
  DirectoryClaimSummary,
} from '@/services/DirectoryClaimPublicService';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';

type PageState = 'loading' | 'valid' | 'expired' | 'claimed' | 'invalid' | 'success';

export default function DirectoryClaimClient() {
  const params = useParams();
  const router = useRouter();
  const { customer, refreshCustomer } = useCustomerAuth();
  const token = (params?.token as string) || '';

  const [state, setState] = useState<PageState>('loading');
  const [summary, setSummary] = useState<DirectoryClaimSummary | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (!token) {
      setState('invalid');
      return;
    }
    try {
      const s = await directoryClaimPublicService.getClaimSummary(token);
      if (!s) {
        setState('invalid');
        return;
      }
      setSummary(s);
      if (s.isExpired) {
        setState('expired');
      } else if (s.isConsumed) {
        setState('claimed');
      } else {
        setState('valid');
      }
    } catch {
      setState('invalid');
    }
  }, [token]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);
    try {
      const result = await directoryClaimPublicService.acceptClaim(token);
      if (result.success) {
        await refreshCustomer();
        setState('success');
      } else {
        setError(result.error || 'claim_failed');
      }
    } catch (err: any) {
      setError(err?.message || 'claim_failed');
    } finally {
      setAccepting(false);
    }
  };

  if (state === 'loading') {
    return (
      <Container size="sm" className="py-12">
        <Center>
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text c="dimmed">Loading claim details...</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  if (state === 'invalid') {
    return (
      <Container size="sm" className="py-12">
        <Card withBorder shadow="sm" padding="xl" radius="md">
          <Stack align="center" gap="md" ta="center">
            <ThemeIcon size={56} radius="xl" color="red">
              <IconAlertCircle size={28} />
            </ThemeIcon>
            <Title order={3}>Claim Link Not Found</Title>
            <Text c="dimmed">
              This claim link is invalid or has been removed. If you believe this is an error, please
              contact support.
            </Text>
            <Button component={Link} href="/directory" variant="light" leftSection={<IconArrowLeft size={16} />}>
              Back to Directory
            </Button>
          </Stack>
        </Card>
      </Container>
    );
  }

  if (state === 'expired') {
    return (
      <Container size="sm" className="py-12">
        <Card withBorder shadow="sm" padding="xl" radius="md">
          <Stack align="center" gap="md" ta="center">
            <ThemeIcon size={56} radius="xl" color="orange">
              <IconClock size={28} />
            </ThemeIcon>
            <Title order={3}>Claim Link Expired</Title>
            <Text c="dimmed">
              This claim link has expired. Claim links are valid for 90 days. Please request a new
              invite from the directory operator.
            </Text>
            <Button component={Link} href="/directory" variant="light" leftSection={<IconArrowLeft size={16} />}>
              Back to Directory
            </Button>
          </Stack>
        </Card>
      </Container>
    );
  }

  if (state === 'claimed') {
    return (
      <Container size="sm" className="py-12">
        <Card withBorder shadow="sm" padding="xl" radius="md">
          <Stack align="center" gap="md" ta="center">
            <ThemeIcon size={56} radius="xl" color="blue">
              <IconCheck size={28} />
            </ThemeIcon>
            <Title order={3}>Already Claimed</Title>
            <Text c="dimmed">
              This listing has already been claimed by its owner. If this is your business and you
              did not claim it, please contact support.
            </Text>
            <Button component={Link} href="/directory" variant="light" leftSection={<IconArrowLeft size={16} />}>
              Back to Directory
            </Button>
          </Stack>
        </Card>
      </Container>
    );
  }

  if (state === 'success') {
    return (
      <Container size="sm" className="py-12">
        <Card withBorder shadow="sm" padding="xl" radius="md">
          <Stack align="center" gap="md" ta="center">
            <ThemeIcon size={56} radius="xl" color="green">
              <IconCheck size={28} />
            </ThemeIcon>
            <Title order={3}>Listing Claimed!</Title>
            <Text>
              You now own the directory listing for{' '}
              <strong>{summary?.businessName}</strong>. You can update your hours, phone number, and
              add a photo from your account dashboard.
            </Text>
            <Group>
              <Button component={Link} href="/account" leftSection={<IconCheck size={16} />}>
                Go to Dashboard
              </Button>
              <Button
                component={Link}
                href="/directory"
                variant="light"
                leftSection={<IconArrowLeft size={16} />}
              >
                Back to Directory
              </Button>
            </Group>
          </Stack>
        </Card>
      </Container>
    );
  }

  // state === 'valid'
  return (
    <Container size="sm" className="py-12">
      <Card withBorder shadow="sm" padding="xl" radius="md">
        <Stack gap="lg">
          {/* Header */}
          <div>
            <Badge color="green" variant="light" mb="sm">
              Unclaimed Directory Listing
            </Badge>
            <Title order={2}>{summary?.businessName}</Title>
            <Text c="dimmed" size="sm" mt="xs">
              {summary?.category} · {summary?.city}, {summary?.state}
            </Text>
          </div>

          <Divider />

          {/* Listing details */}
          <Stack gap="sm">
            <Group gap="xs">
              <ThemeIcon size={20} radius="xl" color="gray" variant="light">
                <IconMapPin size={14} />
              </ThemeIcon>
              <Text size="sm">{summary?.address}</Text>
            </Group>
            {summary?.phone && (
              <Group gap="xs">
                <ThemeIcon size={20} radius="xl" color="gray" variant="light">
                  <IconPhone size={14} />
                </ThemeIcon>
                <Text size="sm">{summary.phone}</Text>
              </Group>
            )}
            {summary?.snapEbtReported && (
              <Group gap="xs">
                <ThemeIcon size={20} radius="xl" color="green" variant="light">
                  <IconShoppingCart size={14} />
                </ThemeIcon>
                <Text size="sm" c="green.7">
                  SNAP/EBT reported
                </Text>
              </Group>
            )}
          </Stack>

          <Alert color="blue" variant="light" icon={<IconAlertCircle size={16} />}>
            You&apos;re already listed on the {summary?.city} {summary?.category} directory from public
            information (address, phone, and SNAP where reported). Claim the listing to fix hours or
            phone and add a photo. This is not an online store.
          </Alert>

          <Divider />

          {/* Claim action */}
          {customer ? (
            <Stack gap="sm">
              <Text size="sm" c="dimmed">
                Signed in as <strong>{customer.email}</strong>
              </Text>
              {error && (
                <Alert color="red" variant="light">
                  {error === 'authentication_required'
                    ? 'Please sign in to claim this listing.'
                    : error === 'already_claimed'
                      ? 'This listing has already been claimed.'
                      : 'Something went wrong. Please try again.'}
                </Alert>
              )}
              <Button
                size="md"
                loading={accepting}
                onClick={handleAccept}
                leftSection={<IconCheck size={18} />}
              >
                Claim This Listing
              </Button>
            </Stack>
          ) : (
            <Stack gap="sm">
              <Text size="sm" c="dimmed">
                Create a free account or sign in to claim this listing.
              </Text>
              <Group>
                <Button component={Link} href={`/register?redirect=${encodeURIComponent(`/directory/claim/${token}`)}`} size="md">
                  Create Account
                </Button>
                <Button
                  component={Link}
                  href={`/login?redirect=${encodeURIComponent(`/directory/claim/${token}`)}`}
                  variant="light"
                  size="md"
                >
                  Sign In
                </Button>
              </Group>
            </Stack>
          )}

          <Divider />

          <Text size="xs" c="dimmed" ta="center">
            Listed from public directories / SNAP / news. Not a claimed profile.
          </Text>
        </Stack>
      </Card>
    </Container>
  );
}
