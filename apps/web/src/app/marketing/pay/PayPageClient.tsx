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
} from '@tabler/icons-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import marketingPayPublicService from '@/services/MarketingPayPublicService';
import type { PayPageData, CheckoutResult, PayConfirmResult } from '@/services/MarketingPayPublicService';

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
  onSuccess,
}: {
  ptoken: string;
  clientSecret: string;
  amountCents: number;
  couponCode?: string;
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
        const result = await marketingPayPublicService.confirmPayment(ptoken, paymentIntent.id, couponCode);
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
              We'll be in touch with next steps shortly. A confirmation email has been sent.
            </Text>
          </Stack>
        </Card>
      </Container>
    );
  }

  if (payData.alreadyPaid) {
    return (
      <Container size="sm" className="py-20">
        <Card withBorder shadow="sm" padding="xl" radius="md">
          <Stack align="center" gap="lg" className="text-center">
            <ThemeIcon size={64} radius="xl" color="blue">
              <IconCheck size="2rem" />
            </ThemeIcon>
            <Title order={2}>Already Paid</Title>
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
