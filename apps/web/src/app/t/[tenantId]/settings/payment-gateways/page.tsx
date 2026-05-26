'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@mantine/core';
import { Input } from '@/components/ui/Input';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import { CreditCard, Lock, AlertCircle, CheckCircle, Trash2, ShoppingBag, Package, Crown, Info } from 'lucide-react';
import { Switch } from '@/components/ui/Switch';
import { tenantInfoService } from '@/services/TenantInfoService';
import { tenantTierService } from '@/services/TenantTierService';
import { useTierConfig } from '@/lib/tiers/useTierConfig';
import { useCommerceCapability, usePaymentGatewayCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import Link from 'next/link';
import OAuthConnectButton from '@/components/payment-gateways/OAuthConnectButton';

export const dynamic = 'force-dynamic';

interface PaymentGateway {
  id: string;
  gateway_type: string;
  is_active: boolean;
  is_default: boolean;
  config: any;
  last_verified_at?: string;
  verification_status?: string;
  created_at: string;
  updated_at: string;
}

export default function PaymentGatewaysPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tenantId = params?.tenantId as string;

  const { hasAccess, loading: accessLoading, accessReason } = useAccessControl(
    tenantId,
    AccessPresets.SUPPORT_OR_TENANT_ADMIN
  );
  const tierConfig = useTierConfig();

  // Capability-aware resolution
  const commerceCap = useCommerceCapability(tenantId);
  const paymentCap = usePaymentGatewayCapability(tenantId);

  // Derived capability flags (null = still loading)
  const commerceDisabled = commerceCap.data ? !commerceCap.data.enabled || commerceCap.data.paymentType === 'none' : null;
  const paypalAllowed = paymentCap.data ? paymentCap.data.allowedGateways.includes('paypal') : null;
  const squareAllowed = paymentCap.data ? paymentCap.data.allowedGateways.includes('square') : null;
  const stripeAllowed = paymentCap.data ? paymentCap.data.allowedGateways.includes('stripe') : null;

  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [oauthSuccess, setOauthSuccess] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [showPayPalForm, setShowPayPalForm] = useState(false);
  const [editingPayPalId, setEditingPayPalId] = useState<string | null>(null);
  const [paypalForm, setPaypalForm] = useState({
    mode: 'sandbox' as 'sandbox' | 'live',
    client_id: '',
    client_secret: '',
    display_name: '',
    is_active: true,
    is_default: true,
  });
  const [showSquareForm, setShowSquareForm] = useState(false);
  const [editingSquareId, setEditingSquareId] = useState<string | null>(null);
  const [squareForm, setSquareForm] = useState({
    environment: 'sandbox' as 'sandbox' | 'production',
    application_id: '',
    access_token: '',
    location_id: '',
    display_name: '',
    is_active: true,
    is_default: false,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [oauthStatus, setOauthStatus] = useState<{
    paypal?: { connected: boolean; merchantId?: string; expiresAt?: Date };
    square?: { connected: boolean; merchantId?: string; expiresAt?: Date };
  }>({});
  const [tenantTier, setTenantTier] = useState<string>('discovery');
  const [showSquareTestTokenInput, setShowSquareTestTokenInput] = useState(false);
  const [squareTestToken, setSquareTestToken] = useState({
    accessToken: '',
    merchantId: '',
    applicationId: '',
    locationId: '',
  });
  const [savingTestToken, setSavingTestToken] = useState(false);
  const [testTokenError, setTestTokenError] = useState<string | null>(null);
  const [testTokenSuccess, setTestTokenSuccess] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stripeConnect, setStripeConnect] = useState<{
    connected: boolean;
    status: string | null;
    payoutsEnabled: boolean;
    paymentsEnabled: boolean;
    feePercent?: number;
  } | null>(null);
  const [stripeOnboardingLoading, setStripeOnboardingLoading] = useState(false);
  const [gatewaySettings, setGatewaySettings] = useState<{
    gateway_enabled: boolean;
    stripe_enabled: boolean;
    paypal_enabled: boolean;
    square_enabled: boolean;
    clover_enabled: boolean;
  } | null>(null);

  useEffect(() => {
    if (hasAccess && tenantId) {
      loadGateways();
      loadOAuthStatus();
      loadTenantTier();
      checkAdminStatus();
      loadGatewaySettings();
    }
  }, [hasAccess, tenantId]);

  const checkAdminStatus = async () => {
    try {
      // Use TenantInfoService for reliable role check
      const data = await tenantInfoService.getCurrentUser();

      if (data?.user) {
        const user = data.user;
        // console.log('[PaymentGateways] User from service:', user);
        const role = user?.role?.toUpperCase();
        const adminCheck = role === 'PLATFORM_ADMIN' || role === 'ADMIN';
        // console.log('[PaymentGateways] Role:', role, 'Is admin:', adminCheck);
        setIsAdmin(adminCheck);
      } else {
        console.log('[PaymentGateways] No user data returned');
      }
    } catch (err) {
      console.error('[PaymentGateways] Failed to check admin status:', err);
    }
  };

  useEffect(() => {
    // Check for OAuth callback messages
    const connected = searchParams?.get('connected');
    const success = searchParams?.get('success');
    const errorParam = searchParams?.get('error');
    const message = searchParams?.get('message');
    const stripeConnectStatus = searchParams?.get('stripe_connect');

    if (connected && success === 'true') {
      const gatewayName = connected === 'paypal' ? 'PayPal' : 'Square';
      setOauthSuccess(`${gatewayName} connected successfully!`);
      // Reload OAuth status after successful connection
      loadOAuthStatus();
      loadGateways();
    } else if (stripeConnectStatus === 'complete') {
      // Handle Stripe Connect completion
      setOauthSuccess('Stripe Connect onboarding completed! Refreshing status...');
      // Call the refresh endpoint to update status
      refreshStripeConnectStatus();
      // Reload gateways after a short delay
      setTimeout(() => {
        loadGateways();
      }, 2000);
    } else if (errorParam) {
      const decodedMessage = message ? decodeURIComponent(message) : 'OAuth connection failed';
      setOauthError(decodedMessage);
    }
  }, [searchParams]);

  const loadTenantTier = async () => {
    try {
      const tierData = await tenantTierService.getTenantTier(tenantId);
      if (tierData?.tier) {
        setTenantTier(tierData.tier);
      } else if (tierData?.subscription_tier) {
        setTenantTier(tierData.subscription_tier);
      }
    } catch (err) {
      console.error('Failed to load tenant tier:', err);
    }
  };

  const loadOAuthStatus = async () => {
    try {
      // Load PayPal OAuth status
      const paypalData = await tenantInfoService.getOAuthStatus(tenantId, 'paypal');
      if (paypalData) {
        setOauthStatus(prev => ({ ...prev, paypal: paypalData }));
      }

      // Load Square OAuth status
      const squareData = await tenantInfoService.getOAuthStatus(tenantId, 'square');
      if (squareData) {
        setOauthStatus(prev => ({ ...prev, square: squareData }));
      }
    } catch (err) {
      console.error('Failed to load OAuth status:', err);
    }
  };

  const loadGateways = async () => {
    try {
      setLoading(true);
      setError(null);

      const { gateways, stripeConnect } = await tenantInfoService.getPaymentGatewaysWithStripeConnect(tenantId);
      setGateways(gateways);
      setStripeConnect(stripeConnect);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStripeConnectOnboard = async () => {
    try {
      setStripeOnboardingLoading(true);
      const result = await tenantInfoService.startStripeConnectOnboarding(tenantId);

      if (result.success && result.onboardingUrl) {
        window.location.href = result.onboardingUrl;
      } else {
        setError(result.error || 'Failed to start Stripe Connect onboarding');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect Stripe');
    } finally {
      setStripeOnboardingLoading(false);
    }
  };

  const refreshStripeConnectStatus = async () => {
    try {
      const result = await tenantInfoService.refreshStripeConnectStatus(tenantId);
      if (!result.success) {
        console.error('Failed to refresh Stripe Connect status:', result.error);
      }
    } catch (err: any) {
      console.error('Error refreshing Stripe Connect status:', err);
    }
  };

  const handleEditPayPal = (gateway: PaymentGateway) => {
    setEditingPayPalId(gateway.id);
    setPaypalForm({
      mode: gateway.config?.mode || 'sandbox',
      client_id: gateway.config?.client_id || '',
      client_secret: gateway.config?.client_secret || '',
      display_name: gateway.config?.display_name || '',
      is_active: gateway.is_active,
      is_default: gateway.is_default,
    });
    setShowPayPalForm(true);
  };

  const handleSavePayPal = async () => {
    try {
      setSaving(true);
      setSaveError(null);
      setSaveSuccess(false);
      if (!paypalForm.client_id || !paypalForm.client_secret) {
        setSaveError('Client ID and Client Secret are required');
        return;
      }

      const url = editingPayPalId
        ? `/api/tenants/${tenantId}/payment-gateways/${editingPayPalId}`
        : `/api/tenants/${tenantId}/payment-gateways`;

      const method = editingPayPalId ? 'put' : 'post';

      const data = await tenantInfoService.savePayPalGateway(tenantId, {
        gateway_type: 'paypal',
        mode: paypalForm.mode,
        client_id: paypalForm.client_id,
        client_secret: paypalForm.client_secret,
        display_name: paypalForm.display_name,
        is_active: paypalForm.is_active,
        is_default: paypalForm.is_default,
      });

      if (!data) {
        throw new Error('Failed to save PayPal configuration');
      }
      setSaveSuccess(true);
      setShowPayPalForm(false);
      setEditingPayPalId(null);
      setPaypalForm({
        mode: 'sandbox',
        client_id: '',
        client_secret: '',
        display_name: '',
        is_active: true,
        is_default: true,
      });
      await loadGateways();
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditSquare = (gateway: PaymentGateway) => {
    setEditingSquareId(gateway.id);
    setSquareForm({
      environment: gateway.config?.environment || 'sandbox',
      application_id: gateway.config?.application_id || '',
      access_token: gateway.config?.access_token || '',
      location_id: gateway.config?.location_id || '',
      display_name: gateway.config?.display_name || '',
      is_active: gateway.is_active,
      is_default: gateway.is_default,
    });
    setShowSquareForm(true);
  };

  const handleSaveSquare = async () => {
    try {
      setSaving(true);
      setSaveError(null);
      setSaveSuccess(false);
      if (!squareForm.application_id || !squareForm.access_token || !squareForm.location_id) {
        setSaveError('Application ID, Access Token, and Location ID are required');
        return;
      }

      const url = editingSquareId
        ? `/api/tenants/${tenantId}/payment-gateways/${editingSquareId}`
        : `/api/tenants/${tenantId}/payment-gateways`;

      const method = editingSquareId ? 'put' : 'post';

      const data = await tenantInfoService.saveSquareGateway(tenantId, {
        gateway_type: 'square',
        environment: squareForm.environment,
        application_id: squareForm.application_id,
        access_token: squareForm.access_token,
        location_id: squareForm.location_id,
        display_name: squareForm.display_name,
        is_active: squareForm.is_active,
        is_default: squareForm.is_default,
      });

      if (!data) {
        throw new Error('Failed to save Square configuration');
      }
      setSaveSuccess(true);
      setShowSquareForm(false);
      setEditingSquareId(null);
      setSquareForm({
        environment: 'sandbox',
        application_id: '',
        access_token: '',
        location_id: '',
        display_name: '',
        is_active: true,
        is_default: false,
      });
      await loadGateways();
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const loadGatewaySettings = async () => {
    try {
      const settings = await tenantInfoService.getPaymentGatewaySettings(tenantId);
      if (settings) {
        setGatewaySettings(settings);
      }
    } catch (err) {
      console.error('Failed to load gateway settings:', err);
    }
  };

  const handleGatewayPreferenceToggle = async (key: 'stripe_enabled' | 'paypal_enabled' | 'square_enabled' | 'clover_enabled' | 'gateway_enabled', value: boolean) => {
    try {
      const result = await tenantInfoService.updatePaymentGatewaySettings(tenantId, { [key]: value });
      if (result) {
        setGatewaySettings(result);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update gateway preference');
    }
  };

  const handleToggleActive = async (gatewayId: string, currentStatus: boolean) => {
    try {
      const result = await tenantInfoService.updatePaymentGatewayStatus(tenantId, gatewayId, !currentStatus);

      if (!result) throw new Error('Failed to update gateway status');
      await loadGateways();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSetDefault = async (gatewayId: string) => {
    try {
      const result = await tenantInfoService.setDefaultPaymentGateway(tenantId, gatewayId);

      if (!result) throw new Error('Failed to set default gateway');
      await loadGateways();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (gatewayId: string) => {
    if (!confirm('Are you sure you want to delete this payment gateway?')) return;
    try {
      const result = await tenantInfoService.deletePaymentGateway(tenantId, gatewayId);

      if (!result) throw new Error('Failed to delete gateway');
      await loadGateways();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSaveSquareTestToken = async () => {
    try {
      setSavingTestToken(true);
      setTestTokenError(null);
      setTestTokenSuccess(false);

      if (!squareTestToken.accessToken) {
        setTestTokenError('Access token is required');
        return;
      }

      if (!squareTestToken.applicationId || !squareTestToken.locationId) {
        setTestTokenError('Application ID and Location ID are required for checkout');
        return;
      }

      const result = await tenantInfoService.registerSquareTestToken(tenantId, {
        accessToken: squareTestToken.accessToken,
        merchantId: squareTestToken.merchantId || undefined,
        applicationId: squareTestToken.applicationId,
        locationId: squareTestToken.locationId,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to register test token');
      }

      setTestTokenSuccess(true);
      setSquareTestToken({ accessToken: '', merchantId: '', applicationId: '', locationId: '' });
      setShowSquareTestTokenInput(false);
      await loadOAuthStatus();
      await loadGateways();
    } catch (err: any) {
      setTestTokenError(err.message);
    } finally {
      setSavingTestToken(false);
    }
  };

  if (accessLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-neutral-200 rounded w-1/4 mb-4"></div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <Lock className="w-8 h-8 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Access Restricted</h2>
          <p className="text-neutral-600">{accessReason}</p>
        </div>
      </div>
    );
  }

  const paypalGateways = gateways.filter(g => g.gateway_type === 'paypal');
  const squareGateways = gateways.filter(g => g.gateway_type === 'square');
  const stripeGateways = gateways.filter(g => g.gateway_type === 'stripe');
  const canUseAdvancedPayment = tierConfig.checkTierFeature(tenantTier, 'payment_client_credentials');

  // Check if OAuth connections exist (these show as gateways with empty config but OAuth status)
  const hasPayPalOAuth = oauthStatus.paypal?.connected;
  const hasSquareOAuth = oauthStatus.square?.connected;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Payment Gateways</h1>
        <p className="text-neutral-600">Configure payment processors to accept online orders</p>
        <div className="flex gap-2 mt-3">
          <Link href={`/t/${tenantId}/orders`}>
            <Button variant="outline" size="sm">
              <ShoppingBag className="h-4 w-4 mr-2" />
              Order Management
            </Button>
          </Link>
          <Link href={`/t/${tenantId}/settings/fulfillment`}>
            <Button variant="outline" size="sm">
              <Package className="h-4 w-4 mr-2" />
              Fulfillment Settings
            </Button>
          </Link>
          <Link href={`/t/${tenantId}/settings/commerce`}>
            <Button variant="outline" size="sm">
              <CreditCard className="h-4 w-4 mr-2" />
              Commerce Settings
            </Button>
          </Link>
        </div>
      </div>

      {saveSuccess && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-green-800">Payment gateway configured successfully!</p>
        </div>
      )}

      {oauthSuccess && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-green-800">{oauthSuccess}</p>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {oauthError && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">OAuth Error: {oauthError}</p>
        </div>
      )}

      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <CreditCard className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Enable Shopping Cart Features</h3>
            <p className="text-sm text-blue-800">
              Configure at least one active payment gateway to enable shopping cart and checkout on your storefront.
            </p>
          </div>
        </div>
      </div>

      {/* Capability-based Checkout Behavior Info */}
      {commerceCap.data && paymentCap.data && (
        <div className={`mb-6 rounded-lg p-4 ${commerceCap.data.enabled && paymentCap.data.checkoutAvailable
          ? 'bg-green-50 border border-green-200'
          : 'bg-amber-50 border border-amber-200'
          }`}>
          <div className="flex items-start gap-3">
            {commerceCap.data.enabled && paymentCap.data.checkoutAvailable ? (
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
            )}
            <div>
              <h3 className={`font-semibold mb-2 ${commerceCap.data.enabled && paymentCap.data.checkoutAvailable
                ? 'text-green-900'
                : 'text-amber-900'
                }`}>Checkout Capability Status</h3>
              <div className="space-y-2 text-sm">
                {!commerceCap.data.enabled && (
                  <div className="flex items-start gap-2 text-amber-800">
                    <span className="font-medium min-w-[120px]">Commerce:</span>
                    <span>Checkout is <strong>disabled</strong> - customers can browse but cannot place orders online.</span>
                  </div>
                )}
                {commerceCap.data.enabled && commerceCap.data.paymentType === 'deposit' && (
                  <div className="flex items-start gap-2 text-amber-800">
                    <span className="font-medium min-w-[120px]">Commerce:</span>
                    <span>Deposit checkout only - customers pay a deposit to reserve items, with balance due at pickup.</span>
                  </div>
                )}
                {commerceCap.data.enabled && (commerceCap.data.paymentType === 'full' || commerceCap.data.paymentType === 'both') && (
                  <div className="flex items-start gap-2 text-green-800">
                    <span className="font-medium min-w-[120px]">Commerce:</span>
                    <span>Full checkout available - customers can complete full payment{commerceCap.data.paymentType === 'both' ? ' or deposit payment' : ''} at checkout.</span>
                  </div>
                )}
                {paymentCap.data.checkoutAvailable && (
                  <div className="flex items-start gap-2 text-green-800">
                    <span className="font-medium min-w-[120px]">Payment:</span>
                    <span>At least one payment gateway is available - checkout is operational.</span>
                  </div>
                )}
                {!paymentCap.data.checkoutAvailable && (
                  <div className="flex items-start gap-2 text-amber-800">
                    <span className="font-medium min-w-[120px]">Payment:</span>
                    <span>No active payment gateways - configure a gateway below to enable checkout.</span>
                  </div>
                )}
              </div>
              {commerceCap.data.isFlexible && (
                <p className="text-xs text-green-700 mt-3">
                  Your plan supports flexible checkout options across all payment types.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="h-64 bg-neutral-200 rounded animate-pulse"></div>
      ) : (
        <div className="space-y-6">
          {/* PayPal Gateways */}
          {paypalAllowed === false ? (
            <Card>
              <CardContent className="pt-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-yellow-800">PayPal Not Available</h3>
                      <p className="text-sm text-yellow-700 mt-1">
                        PayPal is not available on your current subscription tier. Upgrade to access PayPal payment processing.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">PayPal</h2>
                    <p className="text-sm text-neutral-600">Accept payments via PayPal</p>
                  </div>
                </div>
                {/* Merchant preference toggle */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                  <Switch
                    id="paypal-preference-toggle"
                    checked={gatewaySettings?.paypal_enabled !== false}
                    onCheckedChange={(checked) => handleGatewayPreferenceToggle('paypal_enabled', checked)}
                  />
                  <label htmlFor="paypal-preference-toggle" className="text-sm font-medium text-neutral-900">
                    PayPal enabled
                  </label>
                </div>
              </div>
              {canUseAdvancedPayment && paypalGateways.length > 0 && (
                <div className="mb-4">
                  <Button onClick={() => setShowPayPalForm(true)} size="sm"
                    variant='gradient' style={{ color: 'white' }}>
                    <CreditCard className="w-5 h-5 text-white mt-0.5" />
                    Add Another PayPal Account
                  </Button>
                </div>
              )}

              {showPayPalForm ? (
                <Card>
                  <CardContent>
                    <div className="space-y-4">
                      {saveError && (
                        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
                          {saveError}
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium mb-1">Account Name (Optional)</label>
                        <Input
                          value={paypalForm.display_name}
                          onChange={(e) => setPaypalForm({ ...paypalForm, display_name: e.target.value })}
                          placeholder="e.g., Main Store, Wholesale, etc."
                        />
                        <p className="text-xs text-neutral-500 mt-1">Helps identify this account if you have multiple</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Mode</label>
                        <select
                          className="w-full px-3 py-2 border rounded-lg"
                          value={paypalForm.mode}
                          onChange={(e) => setPaypalForm({ ...paypalForm, mode: e.target.value as 'sandbox' | 'live' })}
                        >
                          <option value="sandbox">Sandbox (Testing)</option>
                          <option value="live">Live (Production)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Client ID</label>
                        <Input
                          value={paypalForm.client_id}
                          onChange={(e) => setPaypalForm({ ...paypalForm, client_id: e.target.value })}
                          placeholder="Enter PayPal Client ID"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Client Secret</label>
                        <Input
                          type="password"
                          value={paypalForm.client_secret}
                          onChange={(e) => setPaypalForm({ ...paypalForm, client_secret: e.target.value })}
                          placeholder="Enter PayPal Client Secret"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="is_active"
                          checked={paypalForm.is_active}
                          onCheckedChange={(checked) => setPaypalForm({ ...paypalForm, is_active: checked })}
                        />
                        <label htmlFor="is_active" className="text-sm">Activate immediately</label>
                      </div>
                      <div className="flex gap-2 pt-4 border-t">
                        <Button onClick={handleSavePayPal} disabled={saving}>
                          {saving ? 'Saving...' : 'Save Configuration'}
                        </Button>
                        <Button variant="outline" onClick={() => setShowPayPalForm(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : paypalGateways.length > 0 || hasPayPalOAuth ? (
                <div className="space-y-4">
                  {paypalGateways.map((gateway) => (
                    <Card key={gateway.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle>{gateway.config?.display_name || 'PayPal Account'}</CardTitle>
                            <p className="text-sm text-neutral-600">
                              {gateway.config?.client_id
                                ? `Mode: ${gateway.config?.mode || 'Unknown'}`
                                : hasPayPalOAuth
                                  ? 'Connected via OAuth'
                                  : 'Mode: Unknown'
                              }
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {gateway.is_default && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                                Default
                              </span>
                            )}
                            <span className={`px-2 py-1 text-xs font-medium rounded ${gateway.is_active ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-600'
                              }`}>
                              {gateway.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {/* Enable/Disable Toggle */}
                          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                            <Switch
                              id={`paypal-enable-${gateway.id}`}
                              checked={gateway.is_active}
                              onCheckedChange={() => handleToggleActive(gateway.id, gateway.is_active)}
                            />
                            <label htmlFor={`paypal-enable-${gateway.id}`} className="text-sm font-medium text-neutral-900">
                              Enable PayPal payments
                            </label>
                          </div>

                          {gateway.config?.client_id && (
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-neutral-600">Client ID</p>
                                <p className="font-mono text-xs">{gateway.config?.client_id?.substring(0, 20)}...</p>
                              </div>
                            </div>
                          )}
                          <div className="flex gap-2 pt-4 border-t">
                            {gateway.config?.client_id && (
                              <Button variant="outline" size="sm" onClick={() => handleEditPayPal(gateway)}>
                                Edit
                              </Button>
                            )}
                            <Button variant="outline" size="sm" onClick={() => handleToggleActive(gateway.id, gateway.is_active)}>
                              {gateway.is_active ? 'Deactivate' : 'Activate'}
                            </Button>
                            {!gateway.is_default && gateway.is_active && (
                              <Button variant="outline" size="sm" onClick={() => handleSetDefault(gateway.id)}>
                                Set as Default
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(gateway.id)} className="text-red-600">
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-neutral-600 mb-4">No PayPal accounts configured</p>
                    {canUseAdvancedPayment ? (
                      <Button onClick={() => setShowPayPalForm(true)}
                        variant='gradient' style={{ color: 'white' }}>
                        Add PayPal Account
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-neutral-500">
                          Client credentials require a Pro or Enterprise plan
                        </p>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left">
                          <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
                            <Crown className="w-4 h-4" />
                            Upgrade for Advanced Integration
                          </div>
                          <p className="text-xs text-amber-600">
                            Pro and Enterprise plans allow direct API credential configuration for custom integrations.
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* OAuth Connection Section */}
              <Card className="mt-4 border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-lg">OAuth Connection (Recommended)</CardTitle>
                  <p className="text-sm text-neutral-600">
                    Connect your PayPal account securely without storing credentials
                  </p>
                </CardHeader>
                <CardContent>
                  <OAuthConnectButton
                    tenantId={tenantId}
                    gatewayType="paypal"
                    isConnected={oauthStatus.paypal?.connected || false}
                    merchantId={oauthStatus.paypal?.merchantId}
                    expiresAt={oauthStatus.paypal?.expiresAt}
                    onConnectionChange={() => {
                      loadOAuthStatus();
                      loadGateways();
                    }}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Square Gateways */}
          {squareAllowed === false ? (
            <Card>
              <CardContent className="pt-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-yellow-800">Square Not Available</h3>
                      <p className="text-sm text-yellow-700 mt-1">
                        Square is not available on your current subscription tier. Upgrade to access Square payment processing.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Square</h2>
                    <p className="text-sm text-neutral-600">Accept credit/debit cards via Square</p>
                  </div>
                </div>
                {/* Merchant preference toggle */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                  <Switch
                    id="square-preference-toggle"
                    checked={gatewaySettings?.square_enabled !== false}
                    onCheckedChange={(checked) => handleGatewayPreferenceToggle('square_enabled', checked)}
                  />
                  <label htmlFor="square-preference-toggle" className="text-sm font-medium text-neutral-900">
                    Square enabled
                  </label>
                </div>
              </div>
              {canUseAdvancedPayment && squareGateways.length > 0 && (
                <div className="mb-4">
                  <Button onClick={() => setShowSquareForm(true)} size="sm"
                    variant='gradient' style={{ color: 'white' }}>
                    <CreditCard className="w-5 h-5 text-white mt-0.5" />
                    Add Another Square Account
                  </Button>
                </div>
              )}

              {squareGateways.length > 0 || hasSquareOAuth ? (
                <div className="space-y-4">
                  {squareGateways.map((gateway) => (
                    <Card key={gateway.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle>{gateway.config?.display_name || 'Square Account'}</CardTitle>
                            <p className="text-sm text-neutral-600">
                              {gateway.config?.application_id
                                ? `Environment: ${gateway.config?.environment || 'Unknown'}`
                                : hasSquareOAuth
                                  ? 'Connected via OAuth'
                                  : 'Environment: Unknown'
                              }
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {gateway.is_default && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                                Default
                              </span>
                            )}
                            <span className={`px-2 py-1 text-xs font-medium rounded ${gateway.is_active ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-600'
                              }`}>
                              {gateway.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {/* Enable/Disable Toggle */}
                          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                            <Switch
                              id={`square-enable-${gateway.id}`}
                              checked={gateway.is_active}
                              onCheckedChange={() => handleToggleActive(gateway.id, gateway.is_active)}
                            />
                            <label htmlFor={`square-enable-${gateway.id}`} className="text-sm font-medium text-neutral-900">
                              Enable Square payments
                            </label>
                          </div>

                          {gateway.config?.application_id && (
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-neutral-600">Application ID</p>
                                <p className="font-mono text-xs">{gateway.config?.application_id?.substring(0, 20)}...</p>
                              </div>
                              <div>
                                <p className="text-neutral-600">Location ID</p>
                                <p className="font-mono text-xs">{gateway.config?.location_id?.substring(0, 20)}...</p>
                              </div>
                            </div>
                          )}
                          <div className="flex gap-2 pt-4 border-t">
                            {gateway.config?.application_id && (
                              <Button variant="outline" size="sm" onClick={() => handleEditSquare(gateway)}>
                                Edit
                              </Button>
                            )}
                            <Button variant="outline" size="sm" onClick={() => handleToggleActive(gateway.id, gateway.is_active)}>
                              {gateway.is_active ? 'Deactivate' : 'Activate'}
                            </Button>
                            {!gateway.is_default && gateway.is_active && (
                              <Button variant="outline" size="sm" onClick={() => handleSetDefault(gateway.id)}>
                                Set as Default
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(gateway.id)} className="text-red-600">
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : showSquareForm ? (
                <Card>
                  <CardContent>
                    <div className="space-y-4">
                      {saveError && (
                        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
                          {saveError}
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium mb-1">Account Name (Optional)</label>
                        <Input
                          value={squareForm.display_name}
                          onChange={(e) => setSquareForm({ ...squareForm, display_name: e.target.value })}
                          placeholder="e.g., Main Store, Retail Location, etc."
                        />
                        <p className="text-xs text-neutral-500 mt-1">Helps identify this account if you have multiple</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Environment</label>
                        <select
                          className="w-full px-3 py-2 border rounded-lg"
                          value={squareForm.environment}
                          onChange={(e) => setSquareForm({ ...squareForm, environment: e.target.value as 'sandbox' | 'production' })}
                        >
                          <option value="sandbox">Sandbox (Testing)</option>
                          <option value="production">Production (Live)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Application ID</label>
                        <Input
                          value={squareForm.application_id}
                          onChange={(e) => setSquareForm({ ...squareForm, application_id: e.target.value })}
                          placeholder="Enter Square Application ID"
                        />
                        <p className="text-xs text-neutral-500 mt-1">From Square Developer Dashboard</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Access Token</label>
                        <Input
                          type="password"
                          value={squareForm.access_token}
                          onChange={(e) => setSquareForm({ ...squareForm, access_token: e.target.value })}
                          placeholder="Enter Square Access Token"
                        />
                        <p className="text-xs text-neutral-500 mt-1">Keep this secure - never share publicly</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Location ID</label>
                        <Input
                          value={squareForm.location_id}
                          onChange={(e) => setSquareForm({ ...squareForm, location_id: e.target.value })}
                          placeholder="Enter Square Location ID"
                        />
                        <p className="text-xs text-neutral-500 mt-1">The location where payments will be processed</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="square_is_active"
                          checked={squareForm.is_active}
                          onCheckedChange={(checked) => setSquareForm({ ...squareForm, is_active: checked })}
                        />
                        <label htmlFor="square_is_active" className="text-sm">Activate immediately</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="square_is_default"
                          checked={squareForm.is_default}
                          onCheckedChange={(checked) => setSquareForm({ ...squareForm, is_default: checked })}
                        />
                        <label htmlFor="square_is_default" className="text-sm">Set as default payment method</label>
                      </div>
                      <div className="flex gap-2 pt-4 border-t">
                        <Button onClick={handleSaveSquare} disabled={saving}>
                          {saving ? 'Saving...' : 'Save Configuration'}
                        </Button>
                        <Button variant="outline" onClick={() => setShowSquareForm(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-neutral-600 mb-4">No Square accounts configured</p>
                    {canUseAdvancedPayment ? (
                      <Button
                        variant='gradient' style={{ color: 'white' }}
                        onClick={() => setShowSquareForm(true)}>
                        Add Square Account
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-neutral-500">
                          Client credentials require a Pro or Enterprise plan
                        </p>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left">
                          <div className="flex items-center gap-2 text-amber-700 font-medium mb-2">
                            <Crown className="w-4 h-4" />
                            Upgrade for Advanced Integration
                          </div>
                          <p className="text-xs text-amber-600">
                            Pro and Enterprise plans allow direct API credential configuration for custom integrations.
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* OAuth Connection Section */}
              <Card className="mt-4 border-gray-200 bg-gray-50">
                <CardHeader>
                  <CardTitle className="text-lg">OAuth Connection (Recommended)</CardTitle>
                  <p className="text-sm text-neutral-600">
                    Connect your Square account securely without storing credentials
                  </p>
                </CardHeader>
                <CardContent>
                  <OAuthConnectButton
                    tenantId={tenantId}
                    gatewayType="square"
                    isConnected={oauthStatus.square?.connected || false}
                    merchantId={oauthStatus.square?.merchantId}
                    expiresAt={oauthStatus.square?.expiresAt}
                    onConnectionChange={() => {
                      loadOAuthStatus();
                      loadGateways();
                    }}
                  />
                </CardContent>
              </Card>

              {/* Admin-only: Square Test Token Input */}
              {isAdmin && (
                <Card className="mt-4 border-amber-200 bg-amber-50">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Crown className="h-4 w-4 text-amber-600" />
                          Admin: Square Test Token
                        </CardTitle>
                        <p className="text-sm text-neutral-600">
                          Manually register a Square sandbox test token (bypasses OAuth)
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSquareTestTokenInput(!showSquareTestTokenInput)}
                      >
                        {showSquareTestTokenInput ? 'Hide' : 'Show'}
                      </Button>
                    </div>
                  </CardHeader>
                  {showSquareTestTokenInput && (
                    <CardContent>
                      <div className="space-y-4">
                        {testTokenSuccess && (
                          <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-800">
                            Test token registered successfully!
                          </div>
                        )}
                        {testTokenError && (
                          <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
                            {testTokenError}
                          </div>
                        )}
                        <div className="bg-amber-100 border border-amber-300 rounded p-3 text-xs text-amber-800">
                          <strong>How to get a test token:</strong>
                          <ol className="list-decimal ml-4 mt-1 space-y-1">
                            <li>Go to Square Developer Console</li>
                            <li>Navigate to OAuth &gt; Test account authorizations</li>
                            <li>Click "Show token" on an authorized test account</li>
                            <li>Copy the access token and paste it below</li>
                          </ol>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Access Token</label>
                          <Input
                            type="password"
                            value={squareTestToken.accessToken}
                            onChange={(e) => setSquareTestToken({ ...squareTestToken, accessToken: e.target.value })}
                            placeholder="Enter Square test access token"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Application ID</label>
                          <Input
                            value={squareTestToken.applicationId}
                            onChange={(e) => setSquareTestToken({ ...squareTestToken, applicationId: e.target.value })}
                            placeholder="e.g., sandbox-sq0idb-xxxxxxxxxxxx"
                          />
                          <p className="text-xs text-gray-500 mt-1">Found in Square Developer Console &gt; Credentials</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Location ID</label>
                          <Input
                            value={squareTestToken.locationId}
                            onChange={(e) => setSquareTestToken({ ...squareTestToken, locationId: e.target.value })}
                            placeholder="e.g., Lxxxxxxxxxxxxxxx"
                          />
                          <p className="text-xs text-gray-500 mt-1">Found in Square Developer Console &gt; Locations</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Merchant ID (Optional)</label>
                          <Input
                            value={squareTestToken.merchantId}
                            onChange={(e) => setSquareTestToken({ ...squareTestToken, merchantId: e.target.value })}
                            placeholder="Enter Square merchant ID"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleSaveSquareTestToken} disabled={savingTestToken}>
                            {savingTestToken ? 'Registering...' : 'Register Test Token'}
                          </Button>
                          <Button variant="outline" onClick={() => setShowSquareTestTokenInput(false)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}
            </div>
          )}

          {/* Stripe Checkout Gateway */}
          {stripeAllowed === false ? (
            <Card>
              <CardContent className="pt-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-yellow-800">Stripe Not Available</h3>
                      <p className="text-sm text-yellow-700 mt-1">
                        Stripe is not available on your current subscription tier. Upgrade to access Stripe payment processing.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Stripe</h2>
                    <p className="text-sm text-neutral-600">Accept credit/debit cards via Stripe checkout</p>
                  </div>
                </div>
                {/* Merchant preference toggle */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                  <Switch
                    id="stripe-preference-toggle"
                    checked={gatewaySettings?.stripe_enabled !== false}
                    onCheckedChange={(checked) => handleGatewayPreferenceToggle('stripe_enabled', checked)}
                  />
                  <label htmlFor="stripe-preference-toggle" className="text-sm font-medium text-neutral-900">
                    Stripe enabled
                  </label>
                </div>
              </div>

              {stripeGateways.length > 0 || stripeConnect?.connected ? (
                <div className="space-y-4">
                  {stripeGateways.map((gateway) => (
                    <Card key={gateway.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle>{gateway.config?.display_name || 'Stripe Account'}</CardTitle>
                            <p className="text-sm text-neutral-600">
                              Accepts credit and debit cards
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {gateway.is_default && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                                Default
                              </span>
                            )}
                            <span className={`px-2 py-1 text-xs font-medium rounded ${gateway.is_active ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-600'
                              }`}>
                              {gateway.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {/* Enable/Disable Toggle */}
                          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                            <Switch
                              id={`stripe-enable-${gateway.id}`}
                              checked={gateway.is_active}
                              onCheckedChange={() => handleToggleActive(gateway.id, gateway.is_active)}
                            />
                            <label htmlFor={`stripe-enable-${gateway.id}`} className="text-sm font-medium text-neutral-900">
                              Enable Stripe payments
                            </label>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-4 border-t">
                          <Button variant="outline" size="sm" onClick={() => handleToggleActive(gateway.id, gateway.is_active)}>
                            {gateway.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                          {!gateway.is_default && gateway.is_active && (
                            <Button variant="outline" size="sm" onClick={() => handleSetDefault(gateway.id)}>
                              Set as Default
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(gateway.id)} className="text-red-600">
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center py-8">
                      <CreditCard className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                      <h3 className="font-medium text-neutral-900 mb-2">No Stripe Checkout Configured</h3>
                      <p className="text-sm text-neutral-600 mb-4">
                        Connect your Stripe account to accept credit card payments at checkout.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Stripe Connect Status */}
              <Card className="mt-4 border-purple-200 bg-purple-50">
                <CardHeader>
                  <CardTitle className="text-lg">Stripe Connect Status</CardTitle>
                  <p className="text-sm text-neutral-600">
                    {stripeConnect?.connected
                      ? 'Connected - ready to accept Stripe payments'
                      : 'Connect Stripe to enable credit card checkout'
                    }
                  </p>
                </CardHeader>
                <CardContent>
                  {stripeConnect?.connected ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-neutral-600">Status</p>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                              Connected
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="text-neutral-600">Payouts</p>
                          <p className="font-medium">
                            {stripeConnect.payoutsEnabled ? (
                              <span className="text-green-600">Enabled</span>
                            ) : (
                              <span className="text-amber-600">Pending</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-4 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadGateways()}
                        >
                          Refresh Status
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm text-amber-800">
                        <p className="font-medium mb-1">Why connect Stripe?</p>
                        <ul className="list-disc ml-4 space-y-1">
                          <li>Accept credit and debit cards at checkout</li>
                          <li>Automatic platform fee collection</li>
                          <li>Fast payouts to your bank account</li>
                        </ul>
                      </div>
                      <Button
                        onClick={handleStripeConnectOnboard}
                        variant='gradient' style={{ color: 'white' }}
                        disabled={stripeOnboardingLoading}
                        className="w-full text-white bg-black"
                      >
                        {stripeOnboardingLoading ? 'Connecting...' : 'Connect Stripe Account'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Stripe Connect for Payouts (Legacy Info) */}
          <div className="hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Stripe Connect</h2>
                  <p className="text-sm text-neutral-600">Connect Stripe to receive payouts from platform revenue</p>
                </div>
              </div>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Payout Account</CardTitle>
                    <p className="text-sm text-neutral-600">
                      {stripeConnect?.connected
                        ? 'Your Stripe account is connected for receiving payouts'
                        : 'Connect your Stripe account to receive payouts from subscription revenue and platform fees'
                      }
                    </p>
                  </div>
                  {stripeConnect?.connected && (
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                        Connected
                      </span>
                      {stripeConnect.payoutsEnabled && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                          Payouts Active
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {stripeConnect?.connected ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-neutral-600">Status</p>
                        <p className="font-medium capitalize">{stripeConnect.status || 'Active'}</p>
                      </div>
                      <div>
                        <p className="text-neutral-600">Payouts</p>
                        <p className="font-medium">
                          {stripeConnect.payoutsEnabled ? (
                            <span className="text-green-600">Enabled</span>
                          ) : (
                            <span className="text-amber-600">Pending</span>
                          )}
                        </p>
                      </div>
                      {stripeConnect.feePercent && (
                        <div>
                          <p className="text-neutral-600">Custom Fee Override</p>
                          <p className="font-medium">{stripeConnect.feePercent}%</p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 pt-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadGateways()}
                      >
                        Refresh Status
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm text-amber-800">
                      <p className="font-medium mb-1">Why connect Stripe?</p>
                      <ul className="list-disc ml-4 space-y-1">
                        <li>Receive automatic payouts from subscription revenue</li>
                        <li>Collect platform fees from customer orders</li>
                        <li>Track your earnings in real-time</li>
                      </ul>
                    </div>
                    <Button
                      onClick={handleStripeConnectOnboard}
                      variant='gradient' style={{ color: 'white' }}
                      disabled={stripeOnboardingLoading}
                      className="w-full text-white bg-black"
                    >
                      {stripeOnboardingLoading ? 'Connecting...' : 'Connect Stripe Account'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
