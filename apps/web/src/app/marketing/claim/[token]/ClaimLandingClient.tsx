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
  TextInput,
  PasswordInput,
  Alert,
  Stack,
  Tabs,
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
  IconMail,
  IconLock,
  IconUser,
  IconPackage,
  IconArrowLeft,
  IconClock,
} from '@tabler/icons-react';
import marketingClaimPublicService, {
  ClaimTokenSummary,
  ClaimAuthResult,
} from '@/services/MarketingClaimPublicService';
import customerAuthService from '@/services/CustomerAuthService';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';

type PageState = 'loading' | 'valid' | 'expired' | 'claimed' | 'invalid' | 'success';

export default function ClaimLandingClient() {
  const params = useParams();
  const router = useRouter();
  const { refreshCustomer } = useCustomerAuth();
  const { settings } = usePlatformSettings();
  const token = (params?.token as string) || '';

  const [state, setState] = useState<PageState>('loading');
  const [summary, setSummary] = useState<ClaimTokenSummary | null>(null);
  const [claimResult, setClaimResult] = useState<ClaimAuthResult | null>(null);

  // Form state
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (!token) {
      setState('invalid');
      return;
    }
    try {
      const s = await marketingClaimPublicService.getClaimSummary(token);
      if (!s) {
        setState('invalid');
        return;
      }
      setSummary(s);
      if (s.isExpired) {
        setState('expired');
      } else if (s.isClaimed) {
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

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password) {
      setError('Password is required.');
      return;
    }

    if (mode === 'register') {
      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const result = await marketingClaimPublicService.completeClaim(token, {
        mode,
        password,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
      });

      if (!result.success || !result.customer || !result.tokens) {
        setError(result.message || result.error || 'Claim failed. Please try again.');
        return;
      }

      // Persist the JWT + customer from the claim endpoint
      customerAuthService.applyExternalAuth(result.customer, result.tokens);
      // Refresh the auth context so the portal sees the logged-in customer
      await refreshCustomer();

      setClaimResult(result);
      setState('success');
    } catch (err: any) {
      setError(err.message || 'Claim failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <Container size="sm" className="py-20">
        <Center>
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text c="dimmed">Validating your claim link...</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  // ── Invalid token ──────────────────────────────────────────────────────
  if (state === 'invalid') {
    return (
      <Container size="sm" className="py-20">
        <Card withBorder shadow="sm" padding="xl" radius="md">
          <Stack align="center" gap="lg" className="text-center">
            <ThemeIcon size={64} radius="xl" color="red">
              <IconAlertCircle size="2rem" />
            </ThemeIcon>
            <Title order={2}>Invalid claim link</Title>
            <Text c="dimmed">This claim link is invalid. Please request a new one.</Text>
            <Link href="/marketing/claim" style={{ textDecoration: 'none' }}>
              <Button leftSection={<IconArrowLeft size="1rem" />}>Request a new link</Button>
            </Link>
          </Stack>
        </Card>
      </Container>
    );
  }

  // ── Expired token ──────────────────────────────────────────────────────
  if (state === 'expired') {
    return (
      <Container size="sm" className="py-20">
        <Card withBorder shadow="sm" padding="xl" radius="md">
          <Stack align="center" gap="lg" className="text-center">
            <ThemeIcon size={64} radius="xl" color="orange">
              <IconClock size="2rem" />
            </ThemeIcon>
            <Title order={2}>This link has expired</Title>
            <Text c="dimmed">
              Claim links expire after 24 hours for security. Please request a new one.
            </Text>
            <Link
              href={summary ? `/marketing/claim?email=${encodeURIComponent(summary.email)}` : '/marketing/claim'}
              style={{ textDecoration: 'none' }}
            >
              <Button leftSection={<IconArrowLeft size="1rem" />}>Request a new link</Button>
            </Link>
          </Stack>
        </Card>
      </Container>
    );
  }

  // ── Already claimed ────────────────────────────────────────────────────
  if (state === 'claimed') {
    return (
      <Container size="sm" className="py-20">
        <Card withBorder shadow="sm" padding="xl" radius="md">
          <Stack align="center" gap="lg" className="text-center">
            <ThemeIcon size={64} radius="xl" color="green">
              <IconCheck size="2rem" />
            </ThemeIcon>
            <Title order={2}>Link already used</Title>
            <Text c="dimmed">This claim link has already been used to create an account.</Text>
            <Link href="/customerlogin" style={{ textDecoration: 'none' }}>
              <Button variant="subtle">Sign in to your account</Button>
            </Link>
          </Stack>
        </Card>
      </Container>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────
  if (state === 'success' && claimResult?.claim) {
    const claim = claimResult.claim;
    return (
      <Container size="sm" className="py-20">
        <Card withBorder shadow="sm" padding="xl" radius="md">
          <Stack align="center" gap="lg" className="text-center">
            <ThemeIcon size={64} radius="xl" color="green">
              <IconCheck size="2rem" />
            </ThemeIcon>
            <Title order={2}>Purchases linked!</Title>
            <Text size="lg" c="dimmed">
              We linked <strong>{claim.campaignsLinked}</strong>{' '}
              {claim.campaignsLinked === 1 ? 'purchase' : 'purchases'} to your account.
            </Text>
            {claim.campaigns.length > 0 && (
              <Stack gap="xs" align="center">
                {claim.campaigns.map((c) => (
                  <Badge key={c.id} size="lg" variant="light" color="blue" leftSection={<IconPackage size="0.8rem" />}>
                    {c.businessName}
                  </Badge>
                ))}
              </Stack>
            )}
            <Divider w="100%" my="md" />
            <Text size="sm" c="dimmed">
              You can now track your orders, download deliverables, and view receipts in your portal.
            </Text>
            <Button size="lg" onClick={() => router.push('/account/marketing')}>
              Go to your portal
            </Button>
          </Stack>
        </Card>
      </Container>
    );
  }

  // ── Valid: show masked summary + register/login form ───────────────────
  if (!summary) {
    return null;
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
          Claim your account
        </Title>

        {/* Masked summary */}
        <Card withBorder shadow="sm" padding="lg" radius="md" bg="gray.0">
          <Stack gap="xs">
            <Text fw={600} size="lg">We found your purchases</Text>
            <Group gap="xs">
              <Text size="sm" c="dimmed">Email:</Text>
              <Text size="sm" fw={500}>{summary.email}</Text>
            </Group>
            <Group gap="xs">
              <Text size="sm" c="dimmed">Purchases found:</Text>
              <Badge variant="light" color="blue">{summary.campaignCount}</Badge>
            </Group>
            {summary.businessInitials && (
              <Group gap="xs">
                <Text size="sm" c="dimmed">Business:</Text>
                <Text size="sm" fw={500}>{summary.businessInitials}</Text>
              </Group>
            )}
            {summary.totalSpentRange && (
              <Group gap="xs">
                <Text size="sm" c="dimmed">Total spent:</Text>
                <Text size="sm" fw={500}>{summary.totalSpentRange}</Text>
              </Group>
            )}
          </Stack>
        </Card>

        {/* Register / Login form (email locked to token's email) */}
        <Card withBorder shadow="sm" padding="xl" radius="md">
          <Tabs value={mode} onChange={(v) => { setMode(v as 'register' | 'login'); setError(null); }}>
            <Tabs.List>
              <Tabs.Tab value="register" leftSection={<IconUser size="1rem" />}>
                Create account
              </Tabs.Tab>
              <Tabs.Tab value="login" leftSection={<IconLock size="1rem" />}>
                Sign in
              </Tabs.Tab>
            </Tabs.List>

            <form onSubmit={handleComplete}>
              <Stack gap="md" mt="md">
                {/* Email is locked to the token's email */}
                <TextInput
                  label="Email"
                  value={summary.email}
                  readOnly
                  disabled
                  leftSection={<IconMail size="1rem" />}
                  description="Locked to your claim link"
                />

                {mode === 'register' && (
                  <>
                    <Group grow>
                      <TextInput
                        label="First name"
                        placeholder="John"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        leftSection={<IconUser size="1rem" />}
                      />
                      <TextInput
                        label="Last name"
                        placeholder="Doe"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </Group>
                    <PasswordInput
                      label="Password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      leftSection={<IconLock size="1rem" />}
                      required
                      description="At least 8 characters"
                    />
                    <PasswordInput
                      label="Confirm password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      leftSection={<IconLock size="1rem" />}
                      required
                    />
                  </>
                )}

                {mode === 'login' && (
                  <PasswordInput
                    label="Password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    leftSection={<IconLock size="1rem" />}
                    required
                  />
                )}

                {error && (
                  <Alert icon={<IconAlertCircle size="1rem" />} color="red">{error}</Alert>
                )}

                <Button type="submit" size="lg" fullWidth loading={submitting}>
                  {submitting
                    ? 'Claiming...'
                    : mode === 'register'
                      ? 'Create account & claim'
                      : 'Sign in & claim'}
                </Button>
              </Stack>
            </form>
          </Tabs>
        </Card>

        <Center>
          <Group gap="xs">
            <Text size="sm" c="dimmed">Wrong email?</Text>
            <Link href="/marketing/claim" style={{ textDecoration: 'none' }}>
              <Text size="sm" c="blue" fw={500}>Request a new link</Text>
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
