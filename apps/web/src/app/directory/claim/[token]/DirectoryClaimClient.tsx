'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DirectoryClaimListingEditor from './DirectoryClaimListingEditor';
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
  Grid,
  Loader,
  Badge,
  Divider,
  TextInput,
  PasswordInput,
  PinInput,
  List,
} from '@mantine/core';
import {
  IconCheck,
  IconAlertCircle,
  IconMapPin,
  IconPhone,
  IconClock,
  IconArrowLeft,
  IconArrowRight,
  IconShoppingCart,
  IconShieldCheck,
  IconSparkles,
} from '@tabler/icons-react';
import directoryClaimPublicService, {
  DirectoryClaimSummary,
  DirectoryClaimAcceptResult,
} from '@/services/DirectoryClaimPublicService';
import directoryPresenceUpgradeService from '@/services/DirectoryPresenceUpgradeService';
import type { UpgradeTierOption } from '@/services/DirectoryPresenceUpgradeService';
import customerAuthService from '@/services/CustomerAuthService';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';

type PageState = 'loading' | 'valid' | 'expired' | 'claimed' | 'invalid' | 'success' | 'otp_sent' | 'pending_approval';

/**
 * Best-effort platform (Auth0) session detection for success-screen CTAs.
 * Auth0's real session cookie (appSession) is httpOnly and invisible to
 * document.cookie; the SDK sets non-httpOnly auth0_email / auth0_id marker
 * cookies at login (lib/auth0.ts onCallback). A false negative is benign —
 * /auth/login bounces an authenticated user straight back to the returnTo
 * target (see .devin/skills/fix-auth0-redirect-loop.md).
 */
function detectPlatformSession(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    document.cookie.includes('auth0_email=') ||
    document.cookie.includes('auth0_id=') ||
    document.cookie.includes('auth0.')
  );
}

export default function DirectoryClaimClient() {
  const params = useParams();
  const router = useRouter();
  const { customer, refreshCustomer } = useCustomerAuth();
  const token = (params?.token as string) || '';

  const [state, setState] = useState<PageState>('loading');
  const [summary, setSummary] = useState<DirectoryClaimSummary | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [initiating, setInitiating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [claimResult, setClaimResult] = useState<DirectoryClaimAcceptResult | null>(null);
  // Best-effort platform (Auth0) session presence — drives the session-aware
  // success-screen CTAs (see detectPlatformSession).
  const [hasPlatformSession, setHasPlatformSession] = useState(false);

  // Claimant verification fields (for operator-approval claims)
  const [claimantFirstName, setClaimantFirstName] = useState('');
  const [claimantLastName, setClaimantLastName] = useState('');
  const [claimantPhone, setClaimantPhone] = useState('');
  const [claimantBusinessAddress, setClaimantBusinessAddress] = useState('');

  // Proof attachments (uploaded after claim submission, while pending)
  const [uploadedProofs, setUploadedProofs] = useState<Array<{
    attachmentId: string; fileName: string; fileType: string; fileSize: number;
  }>>([]);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);

  // Password setup for promoted OAuth-only customers
  const [platformPassword, setPlatformPassword] = useState('');
  const [platformPasswordConfirm, setPlatformPasswordConfirm] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);
  const [passwordSet, setPasswordSet] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

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

  // Refresh the teaser cards from the authenticated options endpoint when a
  // platform session exists (e.g., an existing platform user claiming from a
  // logged-in browser). Skipped otherwise — that endpoint requires an Auth0
  // session and the options embedded in the accept response are already
  // fresh (claim handoff spec — Data source).
  const refreshTenantId = claimResult?.tenantId;
  useEffect(() => {
    if (state !== 'success' || !hasPlatformSession || !refreshTenantId) return;
    let cancelled = false;
    (async () => {
      const opts = await directoryPresenceUpgradeService.getUpgradeOptions(refreshTenantId);
      if (!cancelled && opts && Array.isArray(opts.upgradeOptions) && opts.upgradeOptions.length > 0) {
        setClaimResult((prev) => prev ? {
          ...prev,
          currentTier: opts.currentTier,
          isGatewayUpgrade: opts.isGatewayUpgrade,
          upgradeOptions: opts.upgradeOptions,
        } : prev);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state, hasPlatformSession, refreshTenantId]);

  const handleInitiate = async () => {
    setInitiating(true);
    setError(null);
    try {
      const result = await directoryClaimPublicService.initiateClaim(token, {
        claimantFirstName: claimantFirstName.trim() || undefined,
        claimantLastName: claimantLastName.trim() || undefined,
        claimantPhone: claimantPhone.trim() || undefined,
        claimantBusinessAddress: claimantBusinessAddress.trim() || undefined,
        // Pass customer identity from the frontend context as a fallback
        // in case the optionalCustomerAuth middleware doesn't parse the JWT
        // (PublicApiSingleton may not forward the Authorization header)
        customerEmail: customer?.email || undefined,
        customerId: customer?.id || undefined,
      });
      if (result.error) {
        setError(result.error);
      } else if (result.verificationRequired) {
        setSentTo(result.sentTo || null);
        setState('otp_sent');
      } else if (result.operatorApprovalRequired) {
        setState('pending_approval');
      } else {
        // No verification required — proceed directly to accept
        await handleAccept();
      }
    } catch (err: any) {
      setError(err?.message || 'initiate_failed');
    } finally {
      setInitiating(false);
    }
  };

  const handleUploadProof = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingProof(true);
    setProofError(null);
    try {
      for (const file of Array.from(files)) {
        const result = await directoryClaimPublicService.uploadProofAttachment(token, file);
        setUploadedProofs((prev) => [...prev, result]);
      }
    } catch (err: any) {
      setProofError(err?.message || 'Failed to upload file');
    } finally {
      setUploadingProof(false);
    }
  };

  const handleAccept = async (code?: string) => {
    setAccepting(true);
    setError(null);
    try {
      const result = await directoryClaimPublicService.acceptClaim(token, code);
      if (result.success) {
        await refreshCustomer();

        setHasPlatformSession(detectPlatformSession());
        setClaimResult(result);
        setState('success');
      } else {
        setError(result.error || 'claim_failed');
        if (result.error === 'otp_max_attempts') {
          // Reset to valid state so user can re-initiate
          setOtpCode('');
          setState('valid');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'claim_failed');
    } finally {
      setAccepting(false);
    }
  };

  const handleSetupPlatformPassword = async () => {
    setPasswordError(null);

    if (!platformPassword) {
      setPasswordError('Password is required');
      return;
    }
    if (platformPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    if (platformPassword !== platformPasswordConfirm) {
      setPasswordError('Passwords do not match');
      return;
    }

    setSettingPassword(true);
    try {
      const result = await customerAuthService.setupPlatformPassword(platformPassword);
      if (result.success && result.userTokens) {
        setPasswordSet(true);
        // Keep the platform tokens on claimResult so the success screen knows
        // a platform account exists. The tokens themselves are not consumed
        // by the web app — platform auth is Auth0 cookie-based (claim
        // handoff spec), so they are no longer written to localStorage.
        setClaimResult((prev) => prev ? {
          ...prev,
          requiresPasswordSetup: false,
          userTokens: result.userTokens,
        } : prev);
      } else {
        setPasswordError(result.error || 'Failed to set password');
      }
    } catch (err: any) {
      setPasswordError(err?.message || 'Failed to set password');
    } finally {
      setSettingPassword(false);
    }
  };

  const handleOtpSubmit = async () => {
    if (otpCode.length !== 6) {
      setError('Please enter the 6-digit code.');
      return;
    }
    await handleAccept(otpCode);
  };

  const handleResendOtp = async () => {
    setInitiating(true);
    setError(null);
    setOtpCode('');
    try {
      const result = await directoryClaimPublicService.initiateClaim(token);
      if (result.error) {
        setError(result.error);
      } else if (result.verificationRequired) {
        setSentTo(result.sentTo || null);
        setError(null);
      }
    } catch (err: any) {
      setError(err?.message || 'resend_failed');
    } finally {
      setInitiating(false);
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

  if (state === 'otp_sent') {
    return (
      <Container size="sm" className="py-12">
        <Card withBorder shadow="sm" padding="xl" radius="md">
          <Stack align="center" gap="md" ta="center">
            <ThemeIcon size={56} radius="xl" color="blue">
              <IconShieldCheck size={28} />
            </ThemeIcon>
            <Title order={3}>Verify Your Identity</Title>
            <Text c="dimmed">
              We sent a 6-digit verification code
              {sentTo ? ` to ${sentTo}` : ''}. Enter it below to complete your claim
              for <strong>{summary?.businessName}</strong>.
            </Text>

            <Stack align="center" gap="md" w="100%">
              <PinInput
                length={6}
                value={otpCode}
                onChange={setOtpCode}
                size="lg"
                gap="xs"
                type="number"
                autoFocus
              />

              {error && (
                <Alert color="red" variant="light" w="100%">
                  {error === 'invalid_otp'
                    ? 'Incorrect code. Please try again.'
                    : error === 'otp_expired'
                      ? 'This code has expired. Please request a new one.'
                      : error === 'otp_max_attempts'
                        ? 'Too many attempts. Please request a new code.'
                        : error}
                </Alert>
              )}

              <Button
                size="md"
                loading={accepting}
                onClick={handleOtpSubmit}
                leftSection={<IconCheck size={18} />}
                disabled={otpCode.length !== 6}
              >
                Verify &amp; Claim
              </Button>

              <Button
                variant="subtle"
                size="xs"
                onClick={handleResendOtp}
                loading={initiating}
              >
                Resend code
              </Button>
            </Stack>
          </Stack>
        </Card>
      </Container>
    );
  }

  if (state === 'pending_approval') {
    return (
      <Container size="sm" className="py-12">
        <Card withBorder shadow="sm" padding="xl" radius="md">
          <Stack gap="md">
            <Stack align="center" gap="md" ta="center">
              <ThemeIcon size={56} radius="xl" color="orange">
                <IconClock size={28} />
              </ThemeIcon>
              <Title order={3}>Claim Submitted for Review</Title>
              <Text c="dimmed">
                Your claim request for <strong>{summary?.businessName}</strong> has been
                submitted. Our team will review it and contact you within 1-2 business days
                to verify ownership.
              </Text>
            </Stack>

            <Divider />

            {/* Proof of ownership upload */}
            <Stack gap="sm">
              <Text size="sm" fw={500}>
                Speed up approval — upload proof of ownership
              </Text>
              <Text size="xs" c="dimmed">
                Provide any of the following to help our team verify you are the business owner.
                Accepted formats: PDF, PNG, JPEG.
              </Text>
              <List size="sm" c="dimmed" spacing={4}>
                <List.Item>Business license or permit</List.Item>
                <List.Item>Utility bill matching the business address</List.Item>
                <List.Item>Photo of the business storefront / interior</List.Item>
                <List.Item>Government-issued ID matching the claimant name</List.Item>
              </List>

              {uploadedProofs.length > 0 && (
                <Stack gap="xs" mt="xs">
                  {uploadedProofs.map((att) => (
                    <Group key={att.attachmentId} gap="xs" align="center">
                      <ThemeIcon size={24} radius="xl" color="green" variant="light">
                        <IconCheck size={14} />
                      </ThemeIcon>
                      <Text size="sm">
                        {att.fileName}{' '}
                        <Text size="xs" c="dimmed" span>
                          ({att.fileType}, {(att.fileSize / 1024).toFixed(0)}KB)
                        </Text>
                      </Text>
                    </Group>
                  ))}
                </Stack>
              )}

              {proofError && (
                <Text size="xs" c="red">{proofError}</Text>
              )}

              <Group gap="sm">
                <label>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                    multiple
                    style={{ display: 'none' }}
                    onChange={(e) => handleUploadProof(e.target.files)}
                    disabled={uploadingProof}
                  />
                  <Button
                    component="span"
                     variant="gradient" style={{ color: 'white' }} 
                    size="sm"
                    loading={uploadingProof}
                    leftSection={<IconShieldCheck size={16} />}
                  >
                    Upload Proof Document
                  </Button>
                </label>
                {uploadedProofs.length > 0 && (
                  <Text size="xs" c="green">
                    {uploadedProofs.length} file{uploadedProofs.length !== 1 ? 's' : ''} uploaded
                  </Text>
                )}
              </Group>
            </Stack>

            {summary && (
              <DirectoryClaimListingEditor
                token={token}
                summary={summary}
                onSaved={loadSummary}
              />
            )}

            <Divider />

            <Stack align="center" gap="sm" ta="center">
              <Text size="sm" c="dimmed">
                You can track your claim and access your account dashboard while you wait.
                Once approved, your Google Business Profile tools will appear there.
              </Text>
              <Group gap="sm">
                <Button component={Link} href="/account" variant="gradient" style={{ color: 'white' }} rightSection={<IconArrowRight size={16} />}>
                  Go to My Account
                </Button>
                <Button component={Link} href="/directory"  variant="gradient" style={{ color: 'white' }}  leftSection={<IconArrowLeft size={16} />}>
                  Back to Directory
                </Button>
              </Group>
            </Stack>
          </Stack>
        </Card>
      </Container>
    );
  }

  if (state === 'success') {
    const tenantId = claimResult?.tenantId;
    const needsPasswordSetup = claimResult?.requiresPasswordSetup && !passwordSet;
    const slug = summary?.slug;

    // Session-aware hrefs (claim handoff spec): /t/{tenantId}/* pages are
    // server-gated on a platform (Auth0) session. A freshly-claimed owner
    // usually has none (customer JWT only), so route through /auth/login
    // preserving the destination — the /t/[tenantId] layout hardcodes its
    // own returnTo to the dashboard and would drop the upgrade context.
    const upgradePath = tenantId ? `/t/${tenantId}/settings/subscription/upgrade` : null;
    const dashboardPath = tenantId ? `/t/${tenantId}/dashboard` : '/account';
    const withReturnTo = (path: string) => `/auth/login?returnTo=${encodeURIComponent(path)}`;
    const upgradeHref = upgradePath
      ? (hasPlatformSession ? upgradePath : withReturnTo(upgradePath))
      : null;
    const dashboardHref = hasPlatformSession ? dashboardPath : withReturnTo(dashboardPath);

    return (
      <Container size="lg" className="py-12">
        <Card withBorder shadow="sm" padding="xl" radius="md">
          <Stack gap="lg">
            <Stack align="center" gap="md" ta="center">
              <ThemeIcon size={56} radius="xl" color="green">
                <IconCheck size={28} />
              </ThemeIcon>
              <Title order={3}>You own the listing for {summary?.businessName}</Title>
              <Text>
                Your free directory listing is live. Shoppers can find you, but it&apos;s still a
                basic listing. Choose a Presence Mode to unlock your full directory entry.
              </Text>
            </Stack>

            {/* Password setup for OAuth-only customers who were promoted */}
            {needsPasswordSetup && (
              <>
                <Alert color="orange" variant="light" icon={<IconShieldCheck size={16} />} w="100%">
                  <Text size="sm">
                    Your business owner account was created from your customer
                    profile. Set a password now to secure your dashboard access.
                    You can also use Google sign-in on the login page.
                  </Text>
                </Alert>

                <Stack gap="sm" w="100%">
                  <PasswordInput
                    label="Create Dashboard Password"
                    placeholder="Minimum 8 characters"
                    value={platformPassword}
                    onChange={(e) => setPlatformPassword(e.target.value)}
                    disabled={settingPassword}
                  />
                  <PasswordInput
                    label="Confirm Password"
                    placeholder="Re-enter your password"
                    value={platformPasswordConfirm}
                    onChange={(e) => setPlatformPasswordConfirm(e.target.value)}
                    disabled={settingPassword}
                    error={passwordError || undefined}
                  />
                  <Button
                    onClick={handleSetupPlatformPassword}
                    loading={settingPassword}
                    leftSection={<IconShieldCheck size={16} />}
                    fullWidth
                  >
                    Set Password & Continue
                  </Button>
                </Stack>
              </>
            )}

            {/* Show after password is set (or if it was never needed) */}
            {!needsPasswordSetup && (
              <>
                {passwordSet && (
                  <Alert color="green" variant="light" icon={<IconCheck size={16} />} w="100%">
                    <Text size="sm">
                      Your dashboard password is set. You can now sign in at
                      the login page with your email and this password.
                    </Text>
                  </Alert>
                )}

                {/* Entry Presence mode teaser (claim handoff spec §2/§4) */}
                <ClaimUpgradeTeaser options={claimResult?.upgradeOptions} />

                <Group justify="center">
                  {upgradeHref && (
                    <Button component={Link} href={upgradeHref} leftSection={<IconSparkles size={16} />}>
                      Upgrade to Starter
                    </Button>
                  )}
                  <Button
                    component={Link}
                    href={dashboardHref}
                    variant="light"
                    leftSection={<IconCheck size={16} />}
                  >
                    Go to Dashboard
                  </Button>
                  {slug && (
                    <Button
                      component={Link}
                      href={`/directory/${slug}`}
                      variant="light"
                      leftSection={<IconMapPin size={16} />}
                    >
                      View Listing
                    </Button>
                  )}
                  <Button
                    component={Link}
                    href="/directory"
                    variant="subtle"
                    leftSection={<IconArrowLeft size={16} />}
                  >
                    Back to Directory
                  </Button>
                </Group>

                <Text size="xs" c="dimmed" ta="center">
                  You&apos;ll sign in with your account email. Your dashboard is at{' '}
                  <strong>{tenantId ? `/t/${tenantId}/dashboard` : 'your account'}</strong>.
                </Text>
              </>
            )}
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

              {/* Claimant verification info — used by operator to verify ownership */}
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  Your contact information
                </Text>
                <Text size="xs" c="dimmed">
                  We use this to verify you are the business owner before approving your claim.
                </Text>
                <Group grow>
                  <TextInput
                    label="First name"
                    placeholder="First name"
                    value={claimantFirstName}
                    onChange={(e) => setClaimantFirstName(e.target.value)}
                    size="sm"
                  />
                  <TextInput
                    label="Last name"
                    placeholder="Last name"
                    value={claimantLastName}
                    onChange={(e) => setClaimantLastName(e.target.value)}
                    size="sm"
                  />
                </Group>
                <TextInput
                  label="Phone number"
                  placeholder="(555) 123-4567"
                  value={claimantPhone}
                  onChange={(e) => setClaimantPhone(e.target.value)}
                  size="sm"
                  leftSection={<IconPhone size={14} />}
                />
                <TextInput
                  label="Business address (optional)"
                  placeholder="123 Main St, Indianapolis, IN 46224"
                  value={claimantBusinessAddress}
                  onChange={(e) => setClaimantBusinessAddress(e.target.value)}
                  size="sm"
                  leftSection={<IconMapPin size={14} />}
                />
              </Stack>

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
                variant='gradient' style={{ color: 'white' }}
                loading={initiating || accepting}
                onClick={handleInitiate}
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
                <Button
                component={Link}
                variant='gradient' style={{ color: 'white' }}
                href={`/customerlogin?redirect=${encodeURIComponent(`/place/claim/${token}`)}&mode=register`}
                size="md">
                  Create Account
                </Button>
                <Button
                  component={Link}
                  href={`/customerlogin?redirect=${encodeURIComponent(`/place/claim/${token}`)}&mode=login`}
                 variant='gradient' style={{ color: 'white' }}
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

// ─── Claim upgrade teaser (claim handoff spec §2/§4) ──────────────────────
//
// Renders the three Entry Presence mode cards on the claim success screen.
// Live values come from the upgradeOptions embedded in the claim accept
// response (or the authenticated refresh when a platform session exists);
// the static fallback below renders only when no options are available.
const FALLBACK_PRESENCE_MODES: UpgradeTierOption[] = [
  {
    tierKey: 'presence',
    name: 'Starter',
    displayName: 'Starter',
    description: null,
    priceMonthly: 19,
    priceAnnual: 228,
    sortOrder: 10,
    billingType: 'subscription',
    mode: 'directory',
    tagline: 'Own your directory listing',
    isPrimary: true,
    newFeatures: [],
  },
  {
    tierKey: 'discovery',
    name: 'Discovery',
    displayName: 'Discovery',
    description: null,
    priceMonthly: 29,
    priceAnnual: 348,
    sortOrder: 20,
    billingType: 'subscription',
    mode: 'google',
    tagline: 'Get found on Google',
    isPrimary: false,
    newFeatures: [],
  },
  {
    tierKey: 'storefront',
    name: 'Storefront',
    displayName: 'Storefront',
    description: null,
    priceMonthly: 59,
    priceAnnual: 708,
    sortOrder: 30,
    billingType: 'subscription',
    mode: 'platform',
    tagline: 'Open your platform store',
    isPrimary: false,
    newFeatures: [],
  },
];

// Curated per-mode unlock copy — must stay within each tier's actual feature
// set (spec copy accuracy rules: no premium layout, no featured products, no
// cart/checkout language; hours/map/contact/QR/SNAP are already free).
const MODE_UNLOCK_COPY: Record<string, string> = {
  presence:
    'Business logo, about/bio, photo gallery, social links, and richer directory layouts (classic / editorial / immersive).',
  discovery:
    'Google Shopping / Search / Maps visibility for your products and store, plus thin directory chrome.',
  storefront:
    'A full, branded /shops/{slug} browse experience with product catalog and Google inherit — browsing only; checkout arrives with Commerce tiers.',
};

function ClaimUpgradeTeaser({ options }: { options?: UpgradeTierOption[] }) {
  const isFallback = !options || options.length === 0;
  const modes = isFallback ? FALLBACK_PRESENCE_MODES : options;
  // Primary (presence) first — mirrors the upgrade page's gateway sort
  const sorted = [...modes].sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));

  return (
    <Stack gap="xs">
      <Text ta="center" fw={500}>
        Choose your Presence Mode
      </Text>
      <Grid gap="md">
        {sorted.map((mode) => (
          <Grid.Col key={mode.tierKey} span={{ base: 12, md: 6, lg: 4 }}>
            <Card withBorder radius="md" padding="md" h="100%" style={{ minHeight: 220 }}>
              <Stack gap="xs" align="center" ta="center">
                <Group gap="xs" justify="center">
                  {mode.mode && (
                    <Badge variant="light" color={mode.isPrimary ? 'blue' : 'gray'}>
                      {mode.mode}
                    </Badge>
                  )}
                  {mode.isPrimary && (
                    <Text size="xs" fw={500} c="blue">
                      Recommended
                    </Text>
                  )}
                </Group>
                <Text fw={700} size="lg">
                  {mode.displayName || mode.name}
                </Text>
                {mode.tagline && (
                  <Text size="sm" fw={500}>
                    {mode.tagline}
                  </Text>
                )}
                <Text fw={700}>
                  {isFallback ? `from $${mode.priceMonthly}/mo` : `$${mode.priceMonthly}/mo`}
                </Text>
                <Text size="sm" c="dimmed">
                  {MODE_UNLOCK_COPY[mode.tierKey] ?? ''}
                </Text>
              </Stack>
            </Card>
          </Grid.Col>
        ))}
      </Grid>
      <Text size="xs" c="dimmed" ta="center">
        Start with a Presence Mode. Later, add checkout with <strong>Commitment</strong>,{' '}
        <strong>E-commerce</strong>, or <strong>Omnichannel</strong>, then scale with{' '}
        <strong>Professional</strong>, <strong>Organization</strong>, or <strong>Enterprise</strong>{' '}
        tools. You can also buy individual features à la carte from the Feature Store at any time.
      </Text>
    </Stack>
  );
}
