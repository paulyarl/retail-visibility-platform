'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Badge, Button, Modal, Group, Text, Stack, Alert, Loader, SegmentedControl } from '@mantine/core';
import { IconCreditCard, IconPlus, IconTrash, IconStar, IconCheck, IconAlertCircle, IconBrandPaypal } from '@tabler/icons-react';
import { subscriptionBillingService, type TierPricing, type PaymentMethod, type SubscriptionPreview } from '@/services/SubscriptionBillingService';
import { PayPalSmartButtons } from './PayPalButtons';

// Stripe packages are optional - may not be installed or configured
let stripePromise: Promise<any> | null = null;
let StripeElements: React.ComponentType<any> | null = null;
let StripeCardElement: React.ComponentType<any> | null = null;
let useStripeHook: (() => any) | null = null;
let useElementsHook: (() => any) | null = null;

// Get Stripe publishable key from either env var name
function getStripePublishableKey(): string | undefined {
  // console.log(`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: ${process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}`);
  // console.log(`NEXT_PUBLIC_STRIPE_PUBLIC_KEY: ${process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY}`);
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY;
}

// Check if Stripe is properly configured
function isStripeConfigured(): boolean {
  const key = getStripePublishableKey();
  return !!(key && key.length > 0 && key.startsWith('pk_'));
}

// Dynamically load Stripe packages (optional - may not be installed)
async function loadStripePackages(): Promise<boolean> {
  // Check if Stripe is configured before loading
  if (!isStripeConfigured()) {
    // console.warn('[SelfServiceBilling] Stripe not configured - missing or invalid Stripe publishable key');
    return false;
  }
  
  try {
    const [stripeJs, stripeReact] = await Promise.all([
      import('@stripe/stripe-js').catch(() => null),
      import('@stripe/react-stripe-js').catch(() => null),
    ]);
    console.log(`[SelfServiceBilling] stripeJs: ${stripeJs}`);
    console.log(`[SelfServiceBilling] stripeReact: ${stripeReact}`);
    
    if (stripeJs && stripeReact) {
      stripePromise = stripeJs.loadStripe(getStripePublishableKey()!);
      StripeElements = stripeReact.Elements;
      StripeCardElement = stripeReact.CardElement;
      useStripeHook = stripeReact.useStripe;
      useElementsHook = stripeReact.useElements;
      console.log(`[SelfServiceBilling] Stripe packages loaded successfully`);
      console.log(`StripeElements: ${StripeElements}`);
      console.log(`StripeCardElement: ${StripeCardElement}`);
      console.log(`useStripeHook: ${useStripeHook}`);
      console.log(`useElementsHook: ${useElementsHook}`);
      return true;
    }
  } catch (e) {
    console.warn('[SelfServiceBilling] Stripe packages not available');
  }
  return false;
}

interface SelfServiceBillingProps {
  tenantId: string;
  currentTier?: string;
  subscriptionStatus?: string;
  onTierChange?: (newTier: string) => void;
}

export function SelfServiceBilling({ 
  tenantId, 
  currentTier = 'discovery',
  subscriptionStatus = 'active',
  onTierChange 
}: SelfServiceBillingProps) {
  const [tiers, setTiers] = useState<TierPricing[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [preview, setPreview] = useState<SubscriptionPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Modal states
  const [showAddCard, setShowAddCard] = useState(false);
  const [showConfirmTier, setShowConfirmTier] = useState(false);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    // Set tenant ID in window context for service to use
    if (typeof window !== 'undefined') {
      (window as any).__currentTenantId = tenantId;
    }
    loadData();
  }, [tenantId]);

  // Track if PayPal return is being processed to prevent loops
  const paypalProcessingRef = useRef(false);

  // Handle PayPal return URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paypalStatus = urlParams.get('paypal') || urlParams.get('paypal-token');
    const tokenId = urlParams.get('token') || urlParams.get('approval_token_id') || urlParams.get('token_id') || urlParams.get('PayerID');
    const subscriptionId = urlParams.get('subscription_id');
    const baToken = urlParams.get('ba_token');
    
    console.log('[SelfServiceBilling] PayPal return params:', { paypalStatus, tokenId, subscriptionId, baToken });
    
    if ((paypalStatus === 'success') && !paypalProcessingRef.current) {
      paypalProcessingRef.current = true; // Prevent duplicate calls
      
      // Clean up URL immediately to prevent re-triggering
      window.history.replaceState({}, '', window.location.pathname);
      
      const handlePayPalReturn = async () => {
        try {
          setProcessing(true);
          
          // If we have a subscription_id, the subscription was created
          if (subscriptionId) {
            // Activate the PayPal subscription
            const result = await subscriptionBillingService.activatePayPalSubscription(subscriptionId);
            // console.log('[SelfServiceBilling] PayPal subscription activated:', result);
            
            if (result.success) {
              setSuccess(`Successfully subscribed via PayPal!`);
              if (result.tier) {
                onTierChange?.(result.tier);
              }
            } else {
              setError(result.error || 'Failed to activate PayPal subscription');
            }
          } else if (tokenId || baToken) {
            // This is a billing agreement (payment method) approval
            await subscriptionBillingService.savePayPalPaymentMethod(tokenId || baToken!);
            setSuccess('PayPal payment method added successfully!');
          }
          
          // Reload data
          loadData();
        } catch (err: any) {
          console.error('[SelfServiceBilling] PayPal return error:', err);
          setError(err.message || 'Failed to process PayPal return');
        } finally {
          setProcessing(false);
        }
      };
      handlePayPalReturn();
    } else if (paypalStatus === 'cancel') {
      setError('PayPal authorization was cancelled');
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tiersData, methodsData] = await Promise.all([
        subscriptionBillingService.getTierPricing(),
        subscriptionBillingService.getPaymentMethods(),
      ]);
      setTiers(Array.isArray(tiersData) ? tiersData : []);
      setPaymentMethods(Array.isArray(methodsData) ? methodsData : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  // Preview tier change
  // Quick validation function for immediate feedback
  const getTierValidationStatus = useCallback((tier: string) => {
    if (tier === currentTier) return { allowed: true, reason: 'Current plan' };
    
    const isCurrentTrial = currentTier?.startsWith('trial_');
    const isCurrentPaid = currentTier && !currentTier.startsWith('trial_') && currentTier !== 'discovery';
    const isNewTrial = tier.startsWith('trial_');
    const isNewPaid = !tier.startsWith('trial_') && tier !== 'discovery';

    // Quick frontend validation (same logic as backend)
    if (isCurrentPaid && isNewTrial) {
      return { allowed: false, reason: 'Cannot downgrade from paid plan to trial' };
    }
    
    // Allow trial tier switching during active trial, but not during grace period
    if (isCurrentTrial && isNewTrial) {
      // For frontend, we'll allow different trial tiers but block same tier
      // Backend will handle grace period validation
      if (tier === currentTier) {
        return { allowed: false, reason: 'Cannot renew or extend current trial' };
      }
      // Different trial tiers are allowed (backend will validate grace period)
      return { allowed: true, reason: null };
    }

    return { allowed: true, reason: null };
  }, [currentTier]);

  const handlePreviewTier = useCallback(async (tier: string) => {
    if (tier === currentTier) return;
    
    // Quick frontend validation first
    const validation = getTierValidationStatus(tier);
    if (!validation.allowed) {
      setError(validation.reason || 'This plan change is not allowed');
      return;
    }
    
    try {
      const previewData = await subscriptionBillingService.previewSubscriptionChange(tier, billingCycle);
      setPreview(previewData);
      setSelectedTier(tier);
      setSelectedPaymentMethodId(null); // Reset selection, will default to isDefault
      setShowConfirmTier(true);
    } catch (err: any) {
      // Handle specific validation errors with user-friendly messages
      let errorMessage = 'Failed to preview tier change';
      
      if (err.errorCode) {
        switch (err.errorCode) {
          case 'PAID_TO_TRIAL_NOT_ALLOWED':
            errorMessage = 'Cannot downgrade from paid plan to trial. Please contact support for assistance.';
            break;
          case 'TRIAL_RENEWAL_NOT_ALLOWED':
          case 'TRIAL_CHANGE_NOT_ALLOWED':
            errorMessage = err.message || 'Trial renewals are not allowed. Please select a paid plan to continue.';
            break;
          case 'TRIAL_ALREADY_USED':
            errorMessage = 'You have already used a trial. Only one trial per customer is allowed.';
            break;
          case 'SUBSCRIPTION_CANCELED':
            errorMessage = 'Your subscription is canceled. Please contact support to reactivate.';
            break;
          case 'SUBSCRIPTION_PAST_DUE':
            errorMessage = 'Please update your payment method before changing your subscription.';
            break;
          case 'GRACE_PERIOD_RESTRICTION':
            errorMessage = 'Only plan upgrades are allowed during the grace period.';
            break;
          case 'MANUAL_CONTROL_RESTRICTION':
            errorMessage = 'This subscription is manually managed. Please contact support to make changes.';
            break;
          default:
            errorMessage = err.message || errorMessage;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    }
  }, [currentTier, billingCycle, getTierValidationStatus]);

  // Confirm tier change
  const handleConfirmTierChange = async () => {
    if (!selectedTier) return;

    try {
      setProcessing(true);
      setError(null);

      // Check if payment method is needed
      const tier = tiers.find(t => t.tier === selectedTier);
      const price = billingCycle === 'monthly' 
        ? (tier?.monthlyPriceCents || 0) 
        : (tier?.annualPriceCents || 0);

      let paymentMethodId: string | undefined;
      
      // Use selected payment method, or default if none selected
      const selectedMethod = selectedPaymentMethodId 
        ? paymentMethods.find(m => m.id === selectedPaymentMethodId)
        : paymentMethods.find(m => m.isDefault);
        
      if (price > 0 && !selectedMethod) {
        setError('Please select a payment method before subscribing');
        setShowConfirmTier(false);
        setShowAddCard(true);
        return;
      }
      paymentMethodId = selectedMethod?.id;

      const result = await subscriptionBillingService.subscribe(
        selectedTier,
        paymentMethodId,
        billingCycle
      );

      // console.log('[SelfServiceBilling] Subscribe result:', JSON.stringify(result, null, 2));
      // console.log('[SelfServiceBilling] result.success:', result.success);
      
      // Handle nested response structure: { success: true, data: { success: true, requiresAction: true, ... } }
      const innerData = (result as any).data || result;
      // console.log('[SelfServiceBilling] innerData.requiresAction:', innerData.requiresAction);
      // console.log('[SelfServiceBilling] innerData.clientSecret:', innerData.clientSecret ? 'present' : 'missing');
      // console.log('[SelfServiceBilling] innerData.stripeSubscriptionId:', innerData.stripeSubscriptionId);

      if (result.success || innerData.success) {
        // Check if PayPal redirect is required
        if (innerData.paypalApprovalUrl) {
          // console.log('[SelfServiceBilling] PayPal approval required, redirecting...');
          window.location.href = innerData.paypalApprovalUrl;
          return;
        }
        
        // Check if 3D Secure authentication is required
        const requiresAction = innerData.requiresAction;
        const clientSecret = innerData.clientSecret;
        
        // console.log('[SelfServiceBilling] Checking 3D Secure:', { requiresAction, hasClientSecret: !!clientSecret });
        
        if (requiresAction && clientSecret) {
          // console.log('[SelfServiceBilling] 3D Secure required - loading Stripe...');
          
          // Load Stripe directly to ensure it's available
          let stripe: any = null;
          try {
            const stripeJs = await import('@stripe/stripe-js');
            console.log(`[SelfServiceBilling] stripeJs: ${stripeJs}`);
            const key = getStripePublishableKey();
            console.log('[SelfServiceBilling] Stripe key:', key ? 'present' : 'missing');
            if (key) {
              stripe = await stripeJs.loadStripe(key);
              console.log('[SelfServiceBilling] Stripe loaded:', !!stripe);
            }
          } catch (e) {
            console.error('[SelfServiceBilling] Failed to load Stripe:', e);
          }
          
          if (!stripe) {
            console.error('[SelfServiceBilling] Stripe not available');
            setError('Stripe not configured for payment confirmation');
            return;
          }
          
          // console.log('[SelfServiceBilling] Calling stripe.confirmCardPayment...');
          
          // Confirm the payment with 3D Secure
          const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
            clientSecret
          );
          
          // console.log('[SelfServiceBilling] confirmCardPayment result:', { 
          //   error: confirmError?.message, 
          //   paymentIntentStatus: paymentIntent?.status,
          //   paymentIntentId: paymentIntent?.id
          // });
          
          if (confirmError) {
            setError(`Payment authentication failed: ${confirmError.message}`);
            return;
          }
          
          if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'processing') {
            // Call backend to confirm the subscription and update tenant tier
            // console.log('[SelfServiceBilling] Calling confirm endpoint...');
            const confirmResult = await subscriptionBillingService.confirm(
              paymentIntent.id,
              innerData.stripeSubscriptionId,
              selectedTier
            );
            // console.log('[SelfServiceBilling] Confirm result:', confirmResult);
            
            if (confirmResult.success) {
              setSuccess(`Successfully subscribed to ${selectedTier} tier!`);
              setShowConfirmTier(false);
              onTierChange?.(selectedTier);
              await loadData();
            } else {
              setError(confirmResult.error || 'Failed to confirm subscription');
            }
          } else {
            setError(`Payment status: ${paymentIntent?.status}`);
          }
        } else {
          // No action required - immediate success
          setSuccess(`Successfully subscribed to ${selectedTier} tier!`);
          setShowConfirmTier(false);
          onTierChange?.(selectedTier);
          await loadData();
        }
      } else {
        setError(result.error || 'Failed to subscribe');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process subscription');
    } finally {
      setProcessing(false);
    }
  };

  // Remove payment method
  const handleRemovePaymentMethod = async (methodId: string) => {
    if (!confirm('Are you sure you want to remove this payment method?')) return;

    try {
      await subscriptionBillingService.removePaymentMethod(methodId);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to remove payment method');
    }
  };

  // Set default payment method
  const handleSetDefault = async (methodId: string) => {
    try {
      await subscriptionBillingService.setDefaultPaymentMethod(methodId);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to set default payment method');
    }
  };

  // Add PayPal payment method
  const handleAddPayPal = async () => {
    try {
      setProcessing(true);
      const result = await subscriptionBillingService.createPayPalBillingAgreement();
      // console.log('[PayPal] Billing agreement result:', result);
      // Handle nested response structure
      const approvalUrl = (result as any)?.data?.approvalUrl || result?.approvalUrl;
      if (approvalUrl) {
        window.location.href = approvalUrl;
      } else {
        throw new Error('No approval URL returned from PayPal');
      }
    } catch (err: any) {
      console.error('[PayPal] Error:', err);
      setError(err.message || 'Failed to add PayPal');
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader size="lg" />
      </div>
    );
  }

  const formatPrice = (cents: number) => {
    const safeCents = cents || 0;
    return `$${(safeCents / 100).toFixed(2)}`;
  };

  return (
    <div className="space-y-6">
      {/* Error/Success Alerts */}
      {error && (
        <Alert 
          icon={<IconAlertCircle size="1rem" />} 
          title="Error" 
          color="red" 
          onClose={() => setError(null)}
          withCloseButton
        >
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert 
          icon={<IconCheck size="1rem" />} 
          title="Success" 
          color="green" 
          onClose={() => setSuccess(null)}
          withCloseButton
        >
          {success}
        </Alert>
      )}

      {/* Payment Methods Section */}
      <Card withBorder padding="lg" radius="md">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <IconCreditCard size="1.25rem" />
              Payment Methods
            </h3>
            <Button 
              size="xs" 
              variant="light" 
              leftSection={<IconCreditCard size="1rem" />}
              onClick={() => setShowAddCard(true)}
            >
              Add Card (Stripe)
            </Button>
          </div>

          {paymentMethods.length === 0 ? (
            <div className="space-y-4">
              <div className="text-center py-4 text-neutral-500">
                <IconCreditCard size="2rem" className="mx-auto mb-2 opacity-50" />
                <p>No saved payment methods</p>
              </div>
              
              {/* Payment Options when no saved methods */}
              <div className="space-y-3 pt-2 border-t">
                <Text size="sm" fw={500}>Add a payment method:</Text>
                
                <div className="flex flex-wrap gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    leftSection={<IconCreditCard size="1rem" />}
                    onClick={() => setShowAddCard(true)}
                  >
                    Add Card (Stripe)
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    leftSection={<IconBrandPaypal size="1rem" />}
                    onClick={handleAddPayPal}
                    loading={processing}
                  >
                    Add PayPal
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <div 
                  key={method.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    method.isDefault ? 'border-primary-500 bg-primary-50' : 'border-neutral-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {method.gatewayType === 'paypal' ? (
                      <>
                        <div className="w-10 h-6 bg-blue-600 rounded flex items-center justify-center text-white">
                          <IconBrandPaypal size="1rem" />
                        </div>
                        <div>
                          <Text size="sm" fw={500}>
                            PayPal
                          </Text>
                          <Text size="xs" c="neutral">
                            {method.paypalEmail || 'PayPal Account'}
                            {method.isDefault && ' · Default'}
                          </Text>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-10 h-6 bg-gradient-to-r from-blue-600 to-blue-400 rounded flex items-center justify-center text-white text-xs font-bold">
                          {method.cardBrand?.toUpperCase() || 'CARD'}
                        </div>
                        <div>
                          <Text size="sm" fw={500}>
                            {method.cardBrand} ending in {method.cardLast4}
                          </Text>
                          <Text size="xs" c="neutral">
                            Expires {method.expiryMonth}/{method.expiryYear}
                            {method.isDefault && ' · Default'}
                          </Text>
                        </div>
                      </>
                    )}
                  </div>
                  <Group gap="xs">
                    {!method.isDefault && (
                      <Button 
                        size="xs" 
                        variant="subtle" 
                        onClick={() => handleSetDefault(method.id)}
                      >
                        Set Default
                      </Button>
                    )}
                    <Button 
                      size="xs" 
                      variant="subtle" 
                      color="red"
                      onClick={() => handleRemovePaymentMethod(method.id)}
                    >
                      <IconTrash size="1rem" />
                    </Button>
                  </Group>
                </div>
              ))}
              
              {/* Add Payment Method Buttons */}
              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  leftSection={<IconCreditCard size="1rem" />}
                  onClick={() => setShowAddCard(true)}
                >
                  Add Card (Stripe)
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  leftSection={<IconBrandPaypal size="1rem" />}
                  onClick={handleAddPayPal}
                  loading={processing}
                >
                  Add PayPal
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Tier Selection Section */}
      <Card withBorder padding="lg" radius="md">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <IconStar size="1.25rem" />
              Change Plan
            </h3>
            <SegmentedControl
              value={billingCycle}
              onChange={(value) => setBillingCycle(value as 'monthly' | 'annual')}
              data={[
                { label: 'Monthly', value: 'monthly' },
                { label: 'Annual (Save 20%)', value: 'annual' },
              ]}
              size="xs"
            />
          </div>

          {/* Individual Plans Section */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
              <h4 className="text-lg font-semibold text-neutral-900">Individual Plans</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {tiers.filter(tier => !tier.tier.includes('trial') && !tier.tier.includes('chain') && !tier.tier.includes('expired')).map((tier) => {
              const price = billingCycle === 'monthly' 
                ? (tier.monthlyPriceCents || 0)
                : (tier.annualPriceCents || 0);
              const isCurrent = tier.tier === currentTier;
              const isSelected = tier.tier === selectedTier;
              const validation = getTierValidationStatus(tier.tier);
              const isDisabled = !validation.allowed && !isCurrent;

              return (
                <div
                  key={tier.id}
                  className={`relative p-4 rounded-lg border-2 transition-all group ${
                    isCurrent 
                      ? 'border-primary-500 bg-primary-50' 
                      : isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : isDisabled
                          ? 'border-neutral-200 bg-neutral-50 opacity-60 cursor-not-allowed'
                          : 'border-neutral-200 hover:border-blue-300 hover:shadow-md cursor-pointer'
                  }`}
                  onClick={() => !isCurrent && !isDisabled && handlePreviewTier(tier.tier)}
                >
                  {isCurrent && (
                    <Badge 
                      color="green" 
                      variant="filled" 
                      className="absolute -top-2 left-4"
                    >
                      Current
                    </Badge>
                  )}
                  
                  {/* Click indicator for non-current tiers */}
                  {!isCurrent && !isDisabled && (
                    <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Disabled indicator */}
                  {!isCurrent && isDisabled && (
                    <div className="absolute -top-2 -right-2">
                      <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className={`font-semibold capitalize ${isDisabled ? 'text-neutral-500' : ''}`}>
                        {tier.tier.replace(/_/g, ' ')}
                      </h4>
                      {!isCurrent && !isDisabled && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="text-2xl font-bold">
                      {price === 0 ? 'Free / 14-day' : formatPrice(price)}
                      {price > 0 && (
                        <span className="text-sm font-normal text-neutral-500">
                          /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                        </span>
                      )}
                    </div>
                    
                    {/* Payment methods indicator for paid tiers */}
                    {price > 0 && (
                      <div className="flex items-center gap-2 text-xs text-neutral-500">
                        <span>Pay with:</span>
                        <div className="flex items-center gap-1">
                          <IconCreditCard size="0.875rem" />
                          <span>Card</span>
                        </div>
                        <span>·</span>
                        <div className="flex items-center gap-1 text-blue-600">
                          <IconBrandPaypal size="0.875rem" />
                          <span>PayPal</span>
                        </div>
                      </div>
                    )}
                    
                    <ul className="space-y-1 text-xs text-neutral-600">
                      {(tier.features || []).slice(0, 3).map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <IconCheck size="0.75rem" className="text-green-500 mt-0.5" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
            </div>
          </div>

          {/* Trial Plans Section */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-5 bg-green-500 rounded-full"></div>
              <h4 className="text-lg font-semibold text-neutral-900">Trial Plans</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {tiers.filter(tier => tier.tier.startsWith('trial_') && !tier.tier.includes('expired')).map((tier) => {
              const price = billingCycle === 'monthly' 
                ? (tier.monthlyPriceCents || 0)
                : (tier.annualPriceCents || 0);
              const isCurrent = tier.tier === currentTier;
              const isSelected = tier.tier === selectedTier;
              const validation = getTierValidationStatus(tier.tier);
              const isDisabled = !validation.allowed && !isCurrent;

              return (
                <div
                  key={tier.id}
                  className={`relative p-4 rounded-lg border-2 transition-all group ${
                    isCurrent 
                      ? 'border-primary-500 bg-primary-50' 
                      : isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : isDisabled
                          ? 'border-neutral-200 bg-neutral-50 opacity-60 cursor-not-allowed'
                          : 'border-neutral-200 hover:border-blue-300 hover:shadow-md cursor-pointer'
                  }`}
                  onClick={() => !isCurrent && !isDisabled && handlePreviewTier(tier.tier)}
                  title={isDisabled ? (validation.reason || undefined) : undefined}
                >
                  {isCurrent && (
                    <Badge 
                      color="green" 
                      variant="filled" 
                      className="absolute -top-2 left-4"
                    >
                      Current
                    </Badge>
                  )}
                  
                  {/* Click indicator for non-current tiers */}
                  {!isCurrent && (
                    <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-neutral-900">
                        {tier.tier.replace(/_/g, ' ')}
                      </h4>
                      {!isCurrent && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="text-lg font-bold text-neutral-900">
                      {price === 0 ? 'Free / 14-day' : formatPrice(price)}
                      {price > 0 && (
                        <span className="text-sm font-normal text-neutral-500">
                          /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                        </span>
                      )}
                    </div>
                    
                    <ul className="space-y-1 text-xs text-neutral-600">
                      {(tier.features || []).slice(0, 3).map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <IconCheck size="0.75rem" className="text-green-500 mt-0.5" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
            </div>
          </div>

          {/* Organization Plans Section */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-5 bg-purple-500 rounded-full"></div>
              <h4 className="text-lg font-semibold text-neutral-900">Organization Plans</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {tiers.filter(tier => tier.tier.startsWith('chain_') && !tier.tier.includes('expired')).map((tier) => {
              const price = billingCycle === 'monthly' 
                ? (tier.monthlyPriceCents || 0)
                : (tier.annualPriceCents || 0);
              const isCurrent = tier.tier === currentTier;
              const isSelected = tier.tier === selectedTier;
              const validation = getTierValidationStatus(tier.tier);
              const isDisabled = !validation.allowed && !isCurrent;

              return (
                <div
                  key={tier.id}
                  className={`relative p-4 rounded-lg border-2 transition-all group ${
                    isCurrent 
                      ? 'border-primary-500 bg-primary-50' 
                      : isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : isDisabled
                          ? 'border-neutral-200 bg-neutral-50 opacity-60 cursor-not-allowed'
                          : 'border-neutral-200 hover:border-blue-300 hover:shadow-md cursor-pointer'
                  }`}
                  onClick={() => !isCurrent && !isDisabled && handlePreviewTier(tier.tier)}
                  title={isDisabled ? (validation.reason || undefined) : undefined}
                >
                  {isCurrent && (
                    <Badge 
                      color="green" 
                      variant="filled" 
                      className="absolute -top-2 left-4"
                    >
                      Current
                    </Badge>
                  )}
                  
                  {/* Click indicator for non-current tiers */}
                  {!isCurrent && (
                    <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-neutral-900">
                        {tier.tier.replace(/_/g, ' ')}
                      </h4>
                      {!isCurrent && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="text-lg font-bold text-neutral-900">
                      {price === 0 ? 'Free / 14-day' : formatPrice(price)}
                      {price > 0 && (
                        <span className="text-sm font-normal text-neutral-500">
                          /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                        </span>
                      )}
                    </div>
                    
                    {/* Payment methods indicator for paid tiers */}
                    {price > 0 && (
                      <div className="flex items-center gap-2 text-xs text-neutral-500">
                        <span>Pay with:</span>
                        <div className="flex items-center gap-1">
                          <IconCreditCard size="0.875rem" />
                          <span>Card</span>
                        </div>
                        <span>·</span>
                        <div className="flex items-center gap-1 text-blue-600">
                          <IconBrandPaypal size="0.875rem" />
                          <span>PayPal</span>
                        </div>
                      </div>
                    )}
                    
                    <ul className="space-y-1 text-xs text-neutral-600">
                      {(tier.features || []).slice(0, 3).map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <IconCheck size="0.75rem" className="text-green-500 mt-0.5" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </div>
      </Card>

      {/* Add Card Modal */}
      <Modal
        opened={showAddCard}
        onClose={() => setShowAddCard(false)}
        title="Add Payment Method"
        size="md"
      >
        <StripeCardForm 
          onSuccess={async () => {
            setShowAddCard(false);
            await loadData();
          }}
          onCancel={() => setShowAddCard(false)}
        />
      </Modal>

      {/* Confirm Tier Change Modal */}
      <Modal
        opened={showConfirmTier}
        onClose={() => setShowConfirmTier(false)}
        title="Confirm Plan Change"
        size="md"
      >
        {preview && (
          <Stack gap="md">
            <Alert color="blue" variant="light">
              <Text size="sm">
                You are changing from <strong>{preview.currentTier}</strong> to <strong>{preview.newTier}</strong>
              </Text>
            </Alert>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Text>Current plan:</Text>
                <Text fw={500}>{formatPrice(preview.currentPrice || 0)}/{billingCycle === 'monthly' ? 'mo' : 'yr'}</Text>
              </div>
              <div className="flex justify-between">
                <Text>New plan:</Text>
                <Text fw={500}>{formatPrice(preview.newPrice || 0)}/{billingCycle === 'monthly' ? 'mo' : 'yr'}</Text>
              </div>
              {preview.proratedAmount !== 0 && (
                <div className="flex justify-between pt-2 border-t">
                  <Text>Prorated charge today:</Text>
                  <Text fw={700} color={preview.proratedAmount > 0 ? 'red' : 'green'}>
                    {preview.proratedAmount > 0 ? '' : '-'}{formatPrice(Math.abs(preview.proratedAmount || 0))}
                  </Text>
                </div>
              )}
            </div>

            {/* Payment Method Selection */}
            {preview.newPrice > 0 && (
              <div className="pt-2 border-t">
                <Text size="sm" fw={500} mb="xs">Select payment method:</Text>
                <div className="space-y-2">
                  {paymentMethods.map(method => {
                    const isSelected = selectedPaymentMethodId === method.id || 
                      (!selectedPaymentMethodId && method.isDefault);
                    return (
                      <div 
                        key={method.id} 
                        onClick={() => setSelectedPaymentMethodId(method.id)}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-neutral-200 hover:border-neutral-300'
                        }`
                      }
                      >
                        <div className="flex-shrink-0">
                          {method.gatewayType === 'paypal' ? (
                            <div className="w-10 h-6 bg-blue-600 rounded flex items-center justify-center text-white">
                              <IconBrandPaypal size="1rem" />
                            </div>
                          ) : (
                            <div className="w-10 h-6 bg-purple-600 rounded flex items-center justify-center text-white text-xs font-bold">
                              {method.cardBrand?.toUpperCase() || 'CARD'}
                            </div>
                          )}
                        </div>
                        <div className="flex-grow">
                          <Text size="sm" fw={500}>
                            {method.gatewayType === 'paypal' 
                              ? 'PayPal' 
                              : `${method.cardBrand || 'Card'} ending in ${method.cardLast4}`}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {method.gatewayType === 'paypal' 
                              ? method.paypalEmail || 'PayPal Account' 
                              : 'Credit/Debit Card'}
                          </Text>
                        </div>
                        <div className="flex-shrink-0">
                          {method.isDefault && (
                            <Badge size="xs" variant="light" color="green">Default</Badge>
                          )}
                          {isSelected && (
                            <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center ml-2">
                              <IconCheck size="0.75rem" className="text-white" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {paymentMethods.length === 0 && (
                  <Alert color="yellow" variant="light" mt="sm">
                    <Text size="sm">No payment methods saved. Please add a payment method first.</Text>
                  </Alert>
                )}
              </div>
            )}

            {/* Confirm Button */}
            <Group justify="flex-end" mt="md">
              <Button variant="subtle" onClick={() => setShowConfirmTier(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleConfirmTierChange} 
                loading={processing}
                disabled={preview.newPrice > 0 && paymentMethods.length === 0}
                leftSection={<IconCreditCard size="1rem" />}
              >
                Confirm & Pay
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </div>
  );
}

// Stripe Card Form Component
function StripeCardForm({ 
  onSuccess, 
  onCancel 
}: { 
  onSuccess: () => void; 
  onCancel: () => void;
}) {
  const stripe = useStripeHook?.();
  const elements = useElementsHook?.();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements || !StripeCardElement) {
      setError('Stripe not loaded. Please refresh and try again.');
      return;
    }

    const cardElement = elements.getElement(StripeCardElement);
    if (!cardElement) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Create payment method
      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (stripeError) {
        setError(stripeError.message || 'Failed to create payment method');
        return;
      }

      // Save to backend
      await subscriptionBillingService.addPaymentMethod({
        gatewayType: 'stripe',
        paymentMethodToken: paymentMethod.id,
        cardLast4: paymentMethod.card?.last4,
        cardBrand: paymentMethod.card?.brand,
        expiryMonth: paymentMethod.card?.exp_month,
        expiryYear: paymentMethod.card?.exp_year,
      });

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to add payment method');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        <div className="p-4 border rounded-lg">
          {StripeCardElement ? (
            <StripeCardElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#1f2937',
                    '::placeholder': {
                      color: '#9ca3af',
                    },
                  },
                  invalid: {
                    color: '#ef4444',
                  },
                },
              }}
            />
          ) : (
            <Text c="neutral.500">Loading payment form...</Text>
          )}
        </div>

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading} disabled={!stripe} leftSection={<IconCreditCard size="1rem" />}>
            Add Card (Stripe)
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

// Wrapper component with Stripe Elements
export function SelfServiceBillingWithStripe(props: SelfServiceBillingProps) {
  const [stripeLoaded, setStripeLoaded] = useState(false);
  const [stripeAvailable, setStripeAvailable] = useState(false);

  useEffect(() => {
    loadStripePackages().then(available => {
      setStripeAvailable(available);
      setStripeLoaded(true);
    });
  }, []);

  // Show loading state
  if (!stripeLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader size="lg" />
      </div>
    );
  }

  // Stripe not configured - show billing UI with info banner
  if (!stripeAvailable || !StripeElements || !stripePromise) {
    return (
      <div className="space-y-4">
        <Alert color="blue" title="Payment Processing Not Configured" icon={<IconAlertCircle size="1rem" />}>
          <Text size="sm">
            Online payments are not yet configured for this platform. You can still view your subscription and tier options.
            Contact support to add a payment method.
          </Text>
        </Alert>
        <SelfServiceBilling {...props} />
      </div>
    );
  }

  // Stripe configured - wrap with Elements
  return (
    <StripeElements stripe={stripePromise}>
      <SelfServiceBilling {...props} />
    </StripeElements>
  );
}
