'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import {
  Container,
  Card,
  Text,
  Title,
  Button,
  TextInput,
  Alert,
  Group,
  Stack,
  Divider,
  Badge,
  Loader,
  Center,
  Box,
  ThemeIcon,
  Paper,
} from '@mantine/core';
import {
  IconCheck,
  IconAlertCircle,
  IconLock,
  IconTag,
  IconDownload,
  IconArrowLeft,
  IconBuildingStore,
  IconPackage,
  IconMail,
  IconUserPlus,
  IconLogIn,
} from '@tabler/icons-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import Link from 'next/link';
import marketingPayPublicService from '@/services/MarketingPayPublicService';
import type { PayPageData, CheckoutResult, PayConfirmResult } from '@/services/MarketingPayPublicService';
import marketingClaimPublicService from '@/services/MarketingClaimPublicService';
import type { ClaimAuthResult } from '@/services/MarketingClaimPublicService';
import customerAuthService from '@/services/CustomerAuthService';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function CheckoutForm({
  ptoken,
  clientSecret,
  amountCents,
  couponCode,
  email,
  onSuccess,
}: {
  ptoken: string;
  clientSecret: string;
  amountCents: number;
  couponCode?: string;
  email?: string;
  onSuccess: (result: PayConfirmResult) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setIsLoading(true);
    setErrorMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/marketing/pay?ptoken=${ptoken}&status=return`,
      },
      redirect: 'if_required',
    });

    if (error) {
      setErrorMessage(error.message || 'An unexpected error occurred.');
      setIsLoading(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      try {
        const result = await marketingPayPublicService.confirmPayment(ptoken, paymentIntent.id, couponCode, undefined, email);
        onSuccess(result);
      } catch (confirmError: any) {
        setErrorMessage(`Payment succeeded but confirmation failed: ${confirmError.message}. Please contact support.`);
      }
      setIsLoading(false);
    } else if (paymentIntent) {
      setErrorMessage(`Payment status: ${paymentIntent.status}. Please try again or contact support.`);
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {errorMessage && (
        <Alert icon={<IconAlertCircle size="1rem" />} title="Payment Error" color="red" mt="md">
          {errorMessage}
        </Alert>
      )}
      <Button
        type="submit"
        disabled={!stripe || isLoading}
        fullWidth
        mt="xl"
        size="lg"
        leftSection={<IconLock size="1rem" />}
      >
        {isLoading ? 'Processing...' : `Pay ${formatPrice(amountCents)}`}
      </Button>
    </form>
  );
}

export default function PayPageClient() {
  const searchParams = useSearchParams();
  const ptoken = searchParams.get('ptoken') || '';
  const status = searchParams.get('status');
  const { customer: authedCustomer, refreshCustomer } = useCustomerAuth();

  const [payData, setPayData] = useState<PayPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<CheckoutResult | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | undefined>(undefined);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [payResult, setPayResult] = useState<PayConfirmResult | null>(null);
  const [initiatingCheckout, setInitiatingCheckout] = useState(false);

  // §7.1 item 1: optional email field (prefilled from campaign.email)
  const [emailInput, setEmailInput] = useState('');

  // §7.1 item 3: success-screen account CTA state (Path A)
  const [claimResult, setClaimResult] = useState<ClaimAuthResult | null>(null);
  const [claimMode, setClaimMode] = useState<'register' | 'login'>('register');
  const [claimPassword, setClaimPassword] = useState('');
  const [claimFirstName, setClaimFirstName] = useState('');
  const [claimLastName, setClaimLastName] = useState('');
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const loadPayData = useCallback(async () => {
    if (!ptoken) {
      setError('Missing payment token. Please use the link from your preview.');
      setLoading(false);
      return;
    }
    try {
      const data = await marketingPayPublicService.getPayPageData(ptoken);
      setPayData(data);
      if (data.couponCode) {
        setCouponInput(data.couponCode);
      }
      if (data.email) {
        setEmailInput(data.email);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load payment page');
    } finally {
      setLoading(false);
    }
  }, [ptoken]);

  useEffect(() => {
    loadPayData();
  }, [loadPayData]);

  const handleApplyCoupon = async () => {
    if (!couponInput.trim() || !payData) return;
    setCouponLoading(true);
    setCouponError(null);
    try {
      const result = await marketingPayPublicService.validateCoupon(ptoken, couponInput.trim(), payData.packagePriceCents);
      setAppliedCoupon(couponInput.trim());
      setCheckout(null);
    } catch (err: any) {
      setCouponError(err.message || 'Invalid coupon code');
      setAppliedCoupon(undefined);
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(undefined);
    setCouponInput('');
    setCouponError(null);
    setCheckout(null);
  };

  const handleInitiateCheckout = async () => {
    if (!payData) return;
    setInitiatingCheckout(true);
    setError(null);
    try {
      const result = await marketingPayPublicService.createCheckout(ptoken, appliedCoupon);
      setCheckout(result);
    } catch (err: any) {
      setError(err.message || 'Failed to start checkout. Please try again.');
    } finally {
      setInitiatingCheckout(false);
    }
  };

  const handlePaymentSuccess = (result: PayConfirmResult) => {
    setPayResult(result);
    setCheckout(null);
  };

  const handleDownloadReceipt = () => {
    if (payResult) {
      window.open(marketingPayPublicService.getReceiptUrl(payResult.campaignId), '_blank');
    }
  };

  // §7.1 item 3: Path A account CTA on the success screen
  const handleClaimAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payResult || !emailInput.trim()) return;
    setClaimError(null);

    if (claimMode === 'register') {
      if (claimPassword.length < 8) {
        setClaimError('Password must be at least 8 characters.');
        return;
      }
    } else {
      if (!claimPassword) {
        setClaimError('Password is required.');
        return;
      }
    }

    setClaimSubmitting(true);
    try {
      const result =
        claimMode === 'register'
          ? await marketingClaimPublicService.claimViaPayRegister(
              ptoken,
              emailInput.trim(),
              claimPassword,
              claimFirstName || undefined,
              claimLastName || undefined,
            )
          : await marketingClaimPublicService.claimViaPayLogin(ptoken, emailInput.trim(), claimPassword);

      if (!result.success) {
        // If the email matches an existing verified customer, prompt login
        if (result.error === 'requires_login') {
          setClaimMode('login');
          setClaimError(result.message || 'An account exists for this email. Please sign in.');
        } else {
          setClaimError(result.error || result.message || 'Failed to create account.');
        }
        return;
      }

      if (result.customer && result.tokens) {
        customerAuthService.applyExternalAuth(result.customer, result.tokens);
        await refreshCustomer();
      }
      setClaimResult(result);
    } catch (err: any) {
      setClaimError(err.message || 'Failed to create account.');
    } finally {
      setClaimSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Container size="sm" className="py-20">
        <Center>
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text c="dimmed">Loading payment page...</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  if (error && !payData) {
    return (
      <Container size="sm" className="py-20">
        <Card withBorder shadow="sm" padding="xl" radius="md">
          <Alert icon={<IconAlertCircle size="1rem" />} title="Error" color="red">
            {error}
          </Alert>
        </Card>
      </Container>
    );
  }

  if (!payData) {
    return (
      <Container size="sm" className="py-20">
        <Card withBorder shadow="sm" padding="xl" radius="md">
          <Text c="dimmed">No payment data available.</Text>
        </Card>
      </Container>
    );
  }

  if (payResult) {
    // §7.1 item 3: if the claim CTA succeeded, show the linked state
    if (claimResult?.success && claimResult.claim) {
      return (
        <Container size="sm" className="py-20">
          <Card withBorder shadow="sm" padding="xl" radius="md">
            <Stack align="center" gap="lg" className="text-center">
              <ThemeIcon size={64} radius="xl" color="green">
                <IconCheck size="2rem" />
              </ThemeIcon>
              <Title order={2}>Payment Successful!</Title>
              <Text size="lg" c="dimmed">
                Thank you! Your payment of <strong>{formatPrice(payResult.amountCents)}</strong> for{' '}
                <strong>{payData.businessName}</strong> has been received.
              </Text>
              <Badge size="lg" variant="light" color="blue">
                {payData.serviceCategoryLabel}
              </Badge>
              <Divider w="100%" my="md" />
              <ThemeIcon size={40} radius="xl" color="green" variant="light">
                <IconCheck size="1.5rem" />
              </ThemeIcon>
              <Title order={4}>Account created &amp; purchase linked</Title>
              <Text size="sm" c="dimmed">
                We linked <strong>{claimResult.claim.campaignsLinked}</strong>{' '}
                {claimResult.claim.campaignsLinked === 1 ? 'purchase' : 'purchases'} to your account.
              </Text>
              <Group>
                <Button
                  leftSection={<IconDownload size="1rem" />}
                  onClick={handleDownloadReceipt}
                  size="md"
                  variant="light"
                >
                  Download Receipt
                </Button>
                <Link href="/account/marketing" style={{ textDecoration: 'none' }}>
                  <Button size="md">Go to your portal</Button>
                </Link>
              </Group>
            </Stack>
          </Card>
        </Container>
      );
    }

    // §7.1 item 3: success screen with account CTA (Path A)
    return (
      <Container size="sm" className="py-20">
        <Card withBorder shadow="sm" padding="xl" radius="md">
          <Stack align="center" gap="lg" className="text-center">
            <ThemeIcon size={64} radius="xl" color="green">
              <IconCheck size="2rem" />
            </ThemeIcon>
            <Title order={2}>Payment Successful!</Title>
            <Text size="lg" c="dimmed">
              Thank you! Your payment of <strong>{formatPrice(payResult.amountCents)}</strong> for{' '}
              <strong>{payData.businessName}</strong> has been received.
            </Text>
            <Badge size="lg" variant="light" color="blue">
              {payData.serviceCategoryLabel}
            </Badge>
            <Divider w="100%" my="md" />
            <Group>
              <Button
                leftSection={<IconDownload size="1rem" />}
                onClick={handleDownloadReceipt}
                size="md"
              >
                Download Receipt
              </Button>
            </Group>
            <Text size="sm" c="dimmed" mt="md">
              We&apos;ll be in touch with next steps shortly. A confirmation email has been sent.
            </Text>
          </Stack>
        </Card>

        {/* §7.1 item 3: Account CTA panel (Path A) */}
        {!authedCustomer && (
          <Card withBorder shadow="sm" padding="xl" radius="md" mt="lg">
            <Stack gap="md">
              <Group gap="sm">
                <ThemeIcon size={36} radius="xl" color="blue" variant="light">
                  <IconUserPlus size="1.2rem" />
                </ThemeIcon>
                <Box>
                  <Text fw={600} size="lg">Create your free account</Text>
                  <Text size="sm" c="dimmed">Track your order, download deliverables, and check out faster next time.</Text>
                </Box>
              </Group>

              <Tabs value={claimMode} onChange={(v) => { setClaimMode(v as 'register' | 'login'); setClaimError(null); }}>
                <Tabs.List>
                  <Tabs.Tab value="register" leftSection={<IconUserPlus size="0.9rem" />}>Create account</Tabs.Tab>
                  <Tabs.Tab value="login" leftSection={<IconLogIn size="0.9rem" />}>I have an account</Tabs.Tab>
                </Tabs.List>

                <form onSubmit={handleClaimAccount}>
                  <Stack gap="sm" mt="md">
                    <TextInput
                      label="Email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="your@email.com"
                      type="email"
                      required
                      leftSection={<IconMail size="1rem" />}
                    />
                    {claimMode === 'register' && (
                      <Group grow>
                        <TextInput
                          label="First name"
                          value={claimFirstName}
                          onChange={(e) => setClaimFirstName(e.target.value)}
                          placeholder="John"
                        />
                        <TextInput
                          label="Last name"
                          value={claimLastName}
                          onChange={(e) => setClaimLastName(e.target.value)}
                          placeholder="Doe"
                        />
                      </Group>
                    )}
                    <TextInput
                      label="Password"
                      type="password"
                      value={claimPassword}
                      onChange={(e) => setClaimPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      leftSection={<IconLock size="1rem" />}
                      description={claimMode === 'register' ? 'At least 8 characters' : undefined}
                    />
                    {claimError && (
                      <Alert icon={<IconAlertCircle size="1rem" />} color="red">{claimError}</Alert>
                    )}
                    <Button type="submit" size="md" fullWidth loading={claimSubmitting}>
                      {claimSubmitting
                        ? 'Creating account...'
                        : claimMode === 'register'
                          ? 'Create account & link purchase'
                          : 'Sign in & link purchase'}
                    </Button>
                  </Stack>
                </form>
              </Tabs>

              <Divider label="or" labelPosition="center" />
              <Link href="/marketing/claim" style={{ textDecoration: 'none' }}>
                <Text size="sm" c="dimmed" ta="center">
                  Already paid before? <Text span c="blue" fw={500}>Track my purchase</Text>
                </Text>
              </Link>
            </Stack>
          </Card>
        )}

        {/* If already authenticated, show a "link to your account" CTA */}
        {authedCustomer && (
          <Card withBorder shadow="sm" padding="xl" radius="md" mt="lg">
            <Stack align="center" gap="md" className="text-center">
              <ThemeIcon size={36} radius="xl" color="blue" variant="light">
                <IconUserPlus size="1.2rem" />
              </ThemeIcon>
              <Text fw={600}>Link this purchase to your account?</Text>
              <Text size="sm" c="dimmed">
                You&apos;re signed in as <strong>{authedCustomer.email}</strong>. Link this purchase to track it in your portal.
              </Text>
              <form onSubmit={handleClaimAccount} style={{ width: '100%' }}>
                <Stack gap="sm">
                  {claimError && (
                    <Alert icon={<IconAlertCircle size="1rem" />} color="red">{claimError}</Alert>
                  )}
                  <Button type="submit" size="md" fullWidth loading={claimSubmitting}>
                    {claimSubmitting ? 'Linking...' : 'Link to my account'}
                  </Button>
                </Stack>
              </form>
            </Stack>
          </Card>
        )}
      </Container>
    );
  }

  if (payData.alreadyPaid) {
    return (
      <Container size="sm" className="py-20">
        <Card withBorder shadow="sm" padding="xl" radius="md">
          <Stack align="center" gap="lg" className="text-center">
            <ThemeIcon size={64} radius="xl" color="green">
              <IconCheck size="2rem" />
            </ThemeIcon>
            <Title order={2}>You&apos;re all set!</Title>
            <Text size="lg" c="dimmed">
              This package for <strong>{payData.businessName}</strong> has already been paid for.
            </Text>
            <Button
              leftSection={<IconDownload size="1rem" />}
              onClick={() => window.open(marketingPayPublicService.getReceiptUrl(payData.campaignId), '_blank')}
              size="md"
              variant="light"
            >
              Download Receipt
            </Button>
          </Stack>
        </Card>

        {/* §7.1 item 5: augment alreadyPaid with account CTA + Track my purchase */}
        {!authedCustomer && (
          <Card withBorder shadow="sm" padding="xl" radius="md" mt="lg">
            <Stack gap="md">
              <Group gap="sm">
                <ThemeIcon size={36} radius="xl" color="blue" variant="light">
                  <IconUserPlus size="1.2rem" />
                </ThemeIcon>
                <Box>
                  <Text fw={600} size="lg">Create your free account</Text>
                  <Text size="sm" c="dimmed">Track your order, download deliverables, and view receipts anytime.</Text>
                </Box>
              </Group>

              <Tabs value={claimMode} onChange={(v) => { setClaimMode(v as 'register' | 'login'); setClaimError(null); }}>
                <Tabs.List>
                  <Tabs.Tab value="register" leftSection={<IconUserPlus size="0.9rem" />}>Create account</Tabs.Tab>
                  <Tabs.Tab value="login" leftSection={<IconLogIn size="0.9rem" />}>I have an account</Tabs.Tab>
                </Tabs.List>

                <form onSubmit={handleClaimAccount}>
                  <Stack gap="sm" mt="md">
                    <TextInput
                      label="Email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="your@email.com"
                      type="email"
                      required
                      leftSection={<IconMail size="1rem" />}
                    />
                    {claimMode === 'register' && (
                      <Group grow>
                        <TextInput
                          label="First name"
                          value={claimFirstName}
                          onChange={(e) => setClaimFirstName(e.target.value)}
                          placeholder="John"
                        />
                        <TextInput
                          label="Last name"
                          value={claimLastName}
                          onChange={(e) => setClaimLastName(e.target.value)}
                          placeholder="Doe"
                        />
                      </Group>
                    )}
                    <TextInput
                      label="Password"
                      type="password"
                      value={claimPassword}
                      onChange={(e) => setClaimPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      leftSection={<IconLock size="1rem" />}
                      description={claimMode === 'register' ? 'At least 8 characters' : undefined}
                    />
                    {claimError && (
                      <Alert icon={<IconAlertCircle size="1rem" />} color="red">{claimError}</Alert>
                    )}
                    <Button type="submit" size="md" fullWidth loading={claimSubmitting}>
                      {claimSubmitting
                        ? 'Creating account...'
                        : claimMode === 'register'
                          ? 'Create account & link purchase'
                          : 'Sign in & link purchase'}
                    </Button>
                  </Stack>
                </form>
              </Tabs>

              <Divider label="or" labelPosition="center" />
              <Link href="/marketing/claim" style={{ textDecoration: 'none' }}>
                <Text size="sm" c="dimmed" ta="center">
                  Already paid before? <Text span c="blue" fw={500}>Track my purchase</Text>
                </Text>
              </Link>
            </Stack>
          </Card>
        )}

        {authedCustomer && (
          <Card withBorder shadow="sm" padding="xl" radius="md" mt="lg">
            <Stack align="center" gap="md" className="text-center">
              <Text size="sm" c="dimmed">
                You&apos;re signed in as <strong>{authedCustomer.email}</strong>.
              </Text>
              <Link href="/account/marketing" style={{ textDecoration: 'none' }}>
                <Button size="md" variant="subtle">Go to your portal</Button>
              </Link>
            </Stack>
          </Card>
        )}
      </Container>
    );
  }

  const displayPrice = checkout?.amountCents || payData.packagePriceCents;
  const discountCents = checkout?.discountCents || 0;
  const originalPrice = checkout?.originalPriceCents || payData.packagePriceCents;

  return (
    <Container size="sm" className="py-10">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <IconBuildingStore size="1.5rem" className="text-blue-600" />
            <Title order={3}>{payData.businessName}</Title>
          </Group>
          <Badge variant="light" color="gray" size="lg">
            {payData.city}
          </Badge>
        </Group>

        <Card withBorder shadow="sm" padding="xl" radius="md">
          <Stack gap="md">
            <Group gap="sm">
              <ThemeIcon size={40} radius="xl" color="blue" variant="light">
                <IconPackage size="1.2rem" />
              </ThemeIcon>
              <Box>
                <Text fw={600} size="lg">{payData.serviceCategoryLabel}</Text>
                <Text size="sm" c="dimmed">Marketing Package</Text>
              </Box>
            </Group>

            <Divider />

            <Box>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed">Package Price</Text>
                <Text fw={600}>{formatPrice(originalPrice)}</Text>
              </Group>

              {discountCents > 0 && (
                <Group justify="space-between" mb="xs">
                  <Text size="sm" c="green">Discount Applied</Text>
                  <Text size="sm" c="green" fw={600}>-{formatPrice(discountCents)}</Text>
                </Group>
              )}

              <Divider my="xs" />

              <Group justify="space-between">
                <Text fw={700} size="lg">Total Due</Text>
                <Text fw={700} size="xl" c="blue">{formatPrice(displayPrice)}</Text>
              </Group>
            </Box>

            <Divider />

            {/* §7.1 item 1: optional email field (prefilled from campaign.email) */}
            {!checkout && (
              <Box>
                <TextInput
                  label="Email (optional)"
                  description="For your receipt and to track your order later"
                  placeholder="your@email.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  type="email"
                  leftSection={<IconMail size="1rem" />}
                />
              </Box>
            )}

            {!checkout && (
              <Box>
                <Text size="sm" fw={500} mb="xs">Have a coupon code?</Text>
                <Group gap="xs">
                  <TextInput
                    placeholder="Enter coupon code"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    disabled={!!appliedCoupon}
                    style={{ flex: 1 }}
                    leftSection={<IconTag size="1rem" />}
                  />
                  {appliedCoupon ? (
                    <Button variant="light" color="red" onClick={handleRemoveCoupon} size="sm">
                      Remove
                    </Button>
                  ) : (
                    <Button
                      variant="light"
                      onClick={handleApplyCoupon}
                      loading={couponLoading}
                      disabled={!couponInput.trim()}
                      size="sm"
                    >
                      Apply
                    </Button>
                  )}
                </Group>
                {couponError && (
                  <Text size="xs" c="red" mt="xs">{couponError}</Text>
                )}
                {appliedCoupon && (
                  <Text size="xs" c="green" mt="xs">Coupon "{appliedCoupon}" applied!</Text>
                )}
              </Box>
            )}

            {!checkout && (
              <Button
                size="lg"
                fullWidth
                onClick={handleInitiateCheckout}
                loading={initiatingCheckout}
                leftSection={<IconLock size="1rem" />}
              >
                Proceed to Payment
              </Button>
            )}

            {checkout && stripePromise && (
              <Elements
                options={{
                  clientSecret: checkout.clientSecret,
                  appearance: { theme: 'stripe' },
                }}
                stripe={stripePromise}
              >
                <CheckoutForm
                  ptoken={ptoken}
                  clientSecret={checkout.clientSecret}
                  amountCents={checkout.amountCents}
                  couponCode={appliedCoupon}
                  email={emailInput || undefined}
                  onSuccess={handlePaymentSuccess}
                />
              </Elements>
            )}

            {checkout && !stripePromise && (
              <Alert icon={<IconAlertCircle size="1rem" />} title="Payment Error" color="red">
                Stripe is not configured. Please contact us to complete your payment.
              </Alert>
            )}

            {error && (
              <Alert icon={<IconAlertCircle size="1rem" />} title="Error" color="red">
                {error}
              </Alert>
            )}
          </Stack>
        </Card>

        <Paper p="md" withBorder radius="md">
          <Group gap="xs" justify="center">
            <IconLock size="0.9rem" className="text-gray-400" />
            <Text size="xs" c="dimmed">
              Secure payment powered by Stripe. Your payment information is encrypted and never stored on our servers.
            </Text>
          </Group>
        </Paper>
      </Stack>
    </Container>
  );
}
