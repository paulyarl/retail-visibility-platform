'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMultiCart } from '@/hooks/useMultiCart';
import { CheckoutProgress } from '@/components/checkout/CheckoutProgress';
import { OrderSummary } from '@/components/checkout/OrderSummary';
import { CustomerInfoForm } from '@/components/checkout/CustomerInfoForm';
import FulfillmentMethodForm, { FulfillmentMethod } from '@/components/checkout/FulfillmentMethodForm';
import { ShippingAddressFormWithSaved } from '@/components/checkout/ShippingAddressFormWithSaved';
import { GuestSavePaymentMethodPrompt } from '@/components/checkout/GuestSavePaymentMethodPrompt';
import { OrderBump } from '@/components/checkout/OrderBump';
import CouponInput from '@/components/checkout/CouponInput';
import PayPalPaymentForm from '@/components/checkout/PayPalPaymentForm';
import SquarePaymentForm from '@/components/checkout/SquarePaymentForm';
import StripePaymentForm from '@/components/checkout/StripePaymentForm';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ArrowLeft, ShoppingCart, Store, CreditCard, Wallet, Phone, Mail, MapPin, Globe } from 'lucide-react';
import { customerOrderService } from '@/services/CustomerOrderService';
import { getCart, clearCart, validateFulfillmentMethod } from '@/lib/cart/cartManager';
import { tenantPublicService } from '@/services/TenantPublicService';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { usePublicCommerceCapability, usePublicPaymentGatewayCapability } from '@/hooks/tenant-access/usePublicCapabilityAccess';
import { customerPaymentMethodsService } from '@/services/CustomerPaymentMethodsService';
import { customerAuthService } from '@/services/CustomerAuthService';
import { publicPlatformFeeService } from '@/services/PublicPlatformFeeService';
import { checkoutService } from '@/services/CheckoutService';

type CheckoutStep = 'review' | 'fulfillment' | 'shipping' | 'payment';
type PaymentMethod = 'square' | 'paypal' | 'stripe';

interface CustomerInfo {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

interface ShippingAddress {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

function CheckoutPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenantId = searchParams?.get('tenantId');
  const gatewayType = searchParams?.get('gatewayType') as PaymentMethod | null;

  const { carts } = useMultiCart();
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('review');
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod | null>(null);
  const [fulfillmentFee, setFulfillmentFee] = useState<number>(0);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(gatewayType || 'square');
  const [isInitialized, setIsInitialized] = useState(false);
  const [availableGateways, setAvailableGateways] = useState<PaymentMethod[]>([]);
  const [savePaymentMethod, setSavePaymentMethod] = useState(false);
  const [showGuestSavePrompt, setShowGuestSavePrompt] = useState(false);
  const [pendingPaymentMethodToken, setPendingPaymentMethodToken] = useState<string | null>(null);
  const { isAuthenticated } = useCustomerAuth();

  // Capability-aware commerce and payment gateway resolution
  const commerceCap = usePublicCommerceCapability(tenantId);
  const paymentCap = usePublicPaymentGatewayCapability(tenantId);

  // Tier 3 Commitment - Deposit state
  const [tenantTier, setTenantTier] = useState<string | null>(null);
  const [checkoutMode, setCheckoutMode] = useState<'deposit' | 'full_payment' | 'disabled'>('full_payment');
  const [depositOption, setDepositOption] = useState<'required' | 'optional' | 'none'>('none');
  const [depositInfo, setDepositInfo] = useState<{
    depositPercentage: number;
    depositCents: number;
    remainingBalanceCents: number;
    pickupDeadline: Date;
  } | null>(null);
  // Deposit config now comes from unified capability service (commerceCap.state.checkoutMode)
  // Tenant contact info for disabled checkout
  const [tenantContact, setTenantContact] = useState<{
    business_name: string;
    phone_number?: string;
    email?: string;
    website?: string;
    address?: {
      street: string;
      city: string;
      state: string;
      zip: string;
      country: string;
    };
  } | null>(null);
  // Tenant display info (name, logo) - fetched from API for reliability
  const [tenantDisplayName, setTenantDisplayName] = useState<string | null>(null);
  const [tenantDisplayLogo, setTenantDisplayLogo] = useState<string | null>(null);
  // Square config for tenant-specific credentials
  const [squareConfig, setSquareConfig] = useState<{ applicationId: string; locationId: string } | null>(null);
  // Dynamic platform fee percentage from admin settings
  const [platformFeePercentage, setPlatformFeePercentage] = useState<number>(3.0);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [couponDiscount, setCouponDiscount] = useState<number>(0);

  // Get the cart for this tenant (gateway selected at checkout)
  const cart = tenantId ? getCart(tenantId) : null;
  const cartItems = cart?.items || [];
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price_cents * item.quantity), 0);

  // Fetch tenant profile for name and logo
  useEffect(() => {
    const fetchTenantProfile = async () => {
      if (!tenantId) return;

      try {
        const profile = await tenantPublicService.getPublicTenantProfile(tenantId);
        if (profile) {
          const data = (profile as any).data || profile;
          setTenantDisplayName(data.name || data.business_name || null);
          setTenantDisplayLogo(data.logo_url || data.logoUrl || null);
        }
      } catch {
        // Failed to fetch tenant profile — non-critical
      }
    };

    fetchTenantProfile();
  }, [tenantId]);

  // Fetch available payment gateways and tenant tier info (public endpoint for checkout)
  useEffect(() => {
    const fetchPaymentGatewaysAndTier = async () => {
      if (!tenantId) return;

      try {
        // Fetch payment gateways
        // Use CustomerOrderService for public checkout - no auth required
        const { gateways, tenant_tier, commerce_features } = await customerOrderService.getPaymentGateways(tenantId);

        // console.log('[Checkout] Payment gateways data:', gateways, 'Tenant tier:', tenant_tier);

        // Extract active gateway types
        const activeTypes = gateways
          .filter((gateway: any) => gateway.is_active)
          .map((gateway: any) => gateway.gateway_type as PaymentMethod);

        // console.log('[Checkout] Active gateway types:', activeTypes);
        setAvailableGateways(activeTypes);

        // Extract Square config from active Square gateway
        const squareGateway = gateways.find((g: any) => g.gateway_type === 'square' && g.is_active);
        // console.log('[Checkout] Square gateway found:', squareGateway);
        // console.log('[Checkout] Square gateway config:', squareGateway?.config);
        // console.log('[Checkout] Square gateway config keys:', squareGateway?.config ? Object.keys(squareGateway.config) : 'no config');

        if (squareGateway?.config) {
          const config = squareGateway.config;
          // console.log('[Checkout] Config fields:', {
          //   application_id: config.application_id,
          //   location_id: config.location_id,
          //   applicationId: config.applicationId, // Check alternative field name
          //   locationId: config.locationId, // Check alternative field name
          // });

          if (config.application_id && config.location_id) {
            // console.log('[Checkout] Setting Square config:', {
            //   applicationId: config.application_id,
            //   locationId: config.location_id
            // });
            setSquareConfig({
              applicationId: config.application_id,
              locationId: config.location_id
            });
          } else {
            // Square config missing required fields
          }
        } else {
          // No Square config found
        }

        // Set default payment method to first available if current selection is not available
        if (activeTypes.length > 0 && !activeTypes.includes(paymentMethod)) {
          // Set default to first available gateway
          setPaymentMethod(activeTypes[0]);
        }

        // Fetch tenant tier information for deposit calculation
        const tier = tenant_tier;

        if (tier) {
          setTenantTier(tier);
        }

        // Determine checkout mode based on commerce features (V2 feature-based approach)
        // Falls back to tier-based logic if commerce_features is empty (backward compatible)
        if (commerce_features && commerce_features.length > 0) {
          // Step 1: Check if commerce is disabled
          if (commerce_features.includes('commerce_disabled')) {
            setCheckoutMode('disabled');
            setDepositOption('none');
            // Fetch tenant contact info for display
            fetchTenantContact(tenantId);
          }
          // Step 2: Check deposit-only commerce
          else if (commerce_features.includes('commerce_deposit_only')) {
            setCheckoutMode('deposit');
            setDepositOption('required');
          }
          // Step 3: Check flexible commerce (both options)
          else if (commerce_features.includes('commerce_flexible')) {
            setCheckoutMode('full_payment'); // Default to full payment
            setDepositOption('optional'); // Customer can choose deposit
          }
          // Step 4: Check full payment commerce
          else if (commerce_features.includes('commerce_full_payment')) {
            setCheckoutMode('full_payment');
            setDepositOption('none');
          }
          // Step 5: commerce_enabled but no specific path — default to full payment
          else if (commerce_features.includes('commerce_enabled')) {
            setCheckoutMode('full_payment');
            setDepositOption('none');
          }
          // No commerce features — disabled
          else {
            setCheckoutMode('disabled');
            setDepositOption('none');
            fetchTenantContact(tenantId);
          }
        } else if (tier) {
          // Fallback: tier-based logic for backward compatibility
          const effectiveTier = tier.startsWith('trial_') ? tier.replace('trial_', '') : tier;

          if (effectiveTier === 'storefront' || effectiveTier === 'starter' || effectiveTier === 'google_only' || effectiveTier === 'discovery') {
            setCheckoutMode('disabled');
            setDepositOption('none');
            fetchTenantContact(tenantId);
          }
          else if (effectiveTier === 'commitment') {
            setCheckoutMode('deposit');
            setDepositOption('required');
          }
          else if (effectiveTier === 'professional' || effectiveTier === 'enterprise') {
            setCheckoutMode('full_payment');
            setDepositOption('optional');
          }
          else {
            setCheckoutMode('full_payment');
            setDepositOption('none');
          }
        }

        // console.log('[Checkout] Tenant tier:', tier, 'Commerce features:', commerce_features, 'Checkout mode:', checkoutMode, 'Deposit option:', depositOption);
      } catch {
        // Failed to fetch payment gateways — checkout will show disabled state
      }
    };

    fetchPaymentGatewaysAndTier();
  }, [tenantId]);

  // Capability-aware override: when capability data is available, use it as the
  // authoritative source for checkout mode and gateway filtering, superseding
  // the legacy commerce_features / tier-based logic above.
  useEffect(() => {
    if (!tenantId) return;

    // Commerce capability overrides checkout mode (use effective state = tier allows AND merchant enabled)
    if (commerceCap.data) {
      const effectivePaymentType = commerceCap.data.effectivePaymentType ?? commerceCap.data.paymentType;
      const { enabled } = commerceCap.data;
      if (!enabled || effectivePaymentType === 'none') {
        setCheckoutMode('disabled');
        setDepositOption('none');
        fetchTenantContact(tenantId);
      } else if (effectivePaymentType === 'deposit') {
        setCheckoutMode('deposit');
        setDepositOption('required');
      } else if (effectivePaymentType === 'flexible') {
        setCheckoutMode('full_payment');
        setDepositOption('optional');
      } else {
        // 'full' or fallback
        setCheckoutMode('full_payment');
        setDepositOption('none');
      }
    }

    // Payment gateway capability filters available gateways
    // Use effectiveGateways (tier-allowed AND merchant-enabled) when available
    if (paymentCap.data && paymentCap.data.enabled) {
      const effectiveGateways = paymentCap.data.effectiveGateways ?? paymentCap.data.allowedGateways;
      const mapped = effectiveGateways.filter((g): g is PaymentMethod =>
        ['square', 'paypal', 'stripe'].includes(g)
      );
      if (mapped.length > 0) {
        setAvailableGateways(prev => {
          // Only override if capability gateways are a subset (more restrictive)
          const hasRestriction = prev.length === 0 || mapped.length < prev.length;
          return hasRestriction ? mapped : prev;
        });
        // Set default if current selection not in allowed list
        setPaymentMethod(prev => mapped.includes(prev) ? prev : mapped[0]);
      }
    }
  }, [tenantId, commerceCap.data, paymentCap.data]);

  // Fetch tenant contact info for disabled checkout
  const fetchTenantContact = async (tid: string) => {
    try {
      const profile = await tenantPublicService.getPublicTenantProfile(tid);
      // console.log('[Checkout] Tenant profile:', profile);
      if (profile) {
        // Handle both response formats - data nested or direct
        const data = (profile as any).data || profile;
        setTenantContact({
          business_name: data.name || data.business_name || cart?.tenant_name || 'Store',
          phone_number: data.phoneNumber || data.phone_number,
          email: data.email,
          website: data.website,
          address: data.addressLine1 ? {
            street: data.addressLine1,
            city: data.city,
            state: data.state,
            zip: data.postalCode,
            country: data.countryCode || 'US',
          } : undefined,
        });
      }
    } catch {
      // Failed to fetch tenant contact — non-critical
    }
  };

  // Initialize checkout - validate cart exists
  useEffect(() => {
    // console.log('[Checkout] Initialization check:', { 
    //   tenantId,
    //   gatewayType,
    //   hasCart: !!cart,
    //   itemCount: cart?.items?.length,
    //   isInitialized 
    // });

    if (!tenantId || !gatewayType) {
      // console.log('[Checkout] Missing tenant ID or gateway type, redirecting to /carts');
      router.push('/carts');
      return;
    }

    if (cart) {
      // console.log('[Checkout] Cart found:', { 
      //   tenantId: cart.tenant_id,
      //   itemCount: cart.items.length
      // });

      // Valid cart - mark as initialized
      if (!isInitialized) {
        // console.log('[Checkout] Valid cart, initializing checkout');
        setIsInitialized(true);
      }
    } else if (!isInitialized) {
      // Cart doesn't exist yet - give it a moment to load from localStorage
      // No cart found, waiting for load
      const timer = setTimeout(() => {
        const loadedCart = tenantId ? getCart(tenantId) : null;
        if (!loadedCart) {
          // Cart still not found after delay, redirecting
          router.push('/carts');
        } else {
          // Cart loaded after delay
          setIsInitialized(true);
        }
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [tenantId, gatewayType, cart, router, isInitialized]);

  const platformFee = platformFeePercentage > 0
    ? Math.round(subtotal * (platformFeePercentage / 100))
    : 0;
  const total = Math.max(0, subtotal + platformFee + fulfillmentFee + taxAmount - couponDiscount);

  // Fetch dynamic platform fee percentage
  useEffect(() => {
    const fetchPlatformFee = async () => {
      try {
        const percentage = await publicPlatformFeeService.getPlatformFeePercentage();
        setPlatformFeePercentage(percentage);
      } catch {
        // Failed to fetch platform fee — using default
      }
    };

    fetchPlatformFee();
  }, []);

  // Calculate tax when shipping address or fulfillment changes
  useEffect(() => {
    const fetchTax = async () => {
      if (!tenantId || subtotal <= 0) {
        setTaxAmount(0);
        return;
      }

      // Only calculate tax for delivery/shipping (not pickup — tax is based on ship-to address)
      if (fulfillmentMethod === 'pickup' || !shippingAddress) {
        setTaxAmount(0);
        return;
      }

      try {
        const taxCents = await checkoutService.calculateTax({
          tenant_id: tenantId,
          subtotal_cents: subtotal,
          shipping_cents: fulfillmentFee,
          shipping_address: {
            line1: shippingAddress.addressLine1,
            line2: shippingAddress.addressLine2,
            city: shippingAddress.city,
            state: shippingAddress.state,
            postalCode: shippingAddress.postalCode,
            country: shippingAddress.country || 'US',
          },
          line_items: cartItems.map(item => ({
            amountCents: item.price_cents * item.quantity,
            reference: item.product_sku || item.product_id,
          })),
        });

        setTaxAmount(taxCents);
      } catch {
        // Tax calculation failed — proceed with zero tax
      }
    };

    fetchTax();
  }, [tenantId, subtotal, fulfillmentFee, fulfillmentMethod, shippingAddress, cartItems]);

  // Calculate deposit for Tier 3 commitment — matches backend logic exactly
  useEffect(() => {
    if (checkoutMode === 'deposit' && total > 0) {
      // Deposit config comes from unified capability service
      const checkoutCfg = commerceCap.data?.checkoutMode;
      const percentage = checkoutCfg?.deposit_percentage ?? 15;
      const minDeposit = checkoutCfg?.deposit_min_cents ?? 500;
      const maxDeposit = checkoutCfg?.deposit_max_cents ?? 5000;

      // Calculate deposit amount (same formula as backend)
      let depositCents = Math.round(total * (percentage / 100));
      let depositPercentage = percentage;

      // Apply min/max constraints (same as backend getDepositPercentageForOrder)
      if (depositCents < minDeposit) {
        depositPercentage = Math.round((minDeposit / total) * 100);
        depositCents = Math.round(total * (depositPercentage / 100));
      } else if (depositCents > maxDeposit) {
        depositPercentage = Math.round((maxDeposit / total) * 100);
        depositCents = Math.round(total * (depositPercentage / 100));
      }

      const remainingBalanceCents = total - depositCents;
      const pickupDeadline = new Date();
      pickupDeadline.setHours(pickupDeadline.getHours() + 48); // 48 hours

      setDepositInfo({
        depositPercentage,
        depositCents,
        remainingBalanceCents,
        pickupDeadline,
      });

      // console.log('[Checkout] Deposit calculated:', {
      //   total,
      //   depositPercentage,
      //   depositCents,
      //   remainingBalanceCents,
      //   minDeposit,
      //   maxDeposit,
      // });
    } else {
      setDepositInfo(null);
    }
  }, [checkoutMode, total, commerceCap.data?.checkoutMode]);

  // Map cart items to payment form format
  const mappedCartItems = useMemo(() => cartItems.map(item => ({
    id: item.product_id,
    name: item.product_name,
    sku: item.product_sku || '',
    quantity: item.quantity,
    unitPrice: item.price_cents, // Keep in cents - OrderSummary.formatCurrency expects cents
    listPrice: item.list_price_cents,
    imageUrl: item.product_image,
    inventoryItemId: item.product_id,
    tenantId: tenantId || ''
  })), [cartItems, tenantId]);

  if (!tenantId || !cart) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ShoppingCart className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  const handleCustomerInfoSubmit = (info: CustomerInfo, custId?: string, addrId?: string) => {
    setCustomerInfo(info);
    setCustomerId(custId || null);
    setSelectedAddressId(addrId || null);
    setCurrentStep('fulfillment');
  };

  const handleFulfillmentSubmit = (method: FulfillmentMethod, fee: number) => {
    const validation = validateFulfillmentMethod(cartItems, method);
    if (!validation.valid) {
      alert(validation.reason);
      return;
    }

    setFulfillmentMethod(method);
    setFulfillmentFee(fee);

    // If pickup, skip shipping address and go to payment
    if (method === 'pickup') {
      setCurrentStep('payment');
    } else {
      setCurrentStep('shipping');
    }
  };

  const handleShippingSubmit = (address: ShippingAddress, isNew?: boolean) => {
    setShippingAddress(address);
    setCurrentStep('payment');
  };

  const handlePaymentSuccess = async (orderNumber: string, gatewayTransactionId?: string, paymentMethodDetails?: { token?: string; cardLast4?: string; cardBrand?: string; expiryMonth?: number; expiryYear?: string }) => {
    // Clear the cart after successful payment
    if (tenantId) {
      clearCart(tenantId);
      window.dispatchEvent(new Event('cart-updated'));
    }

    // Save customer email/phone to localStorage for order history lookup
    if (customerInfo?.email) {
      localStorage.setItem('buyer_email', customerInfo.email);
    }
    if (customerInfo?.phone) {
      localStorage.setItem('buyer_phone', customerInfo.phone);
    }

    // Handle payment method saving
    if (savePaymentMethod && tenantId) {
      const isLoggedIn = customerAuthService.isAuthenticated();
      if (isLoggedIn && paymentMethodDetails?.token) {
        try {
          await customerPaymentMethodsService.addPaymentMethod({
            tenantId,
            gatewayType: paymentMethod,
            paymentMethodToken: paymentMethodDetails.token,
            type: paymentMethod === 'paypal' ? 'paypal' : 'card',
            cardLast4: paymentMethodDetails.cardLast4,
            cardBrand: paymentMethodDetails.cardBrand,
            expiryMonth: paymentMethodDetails.expiryMonth,
            expiryYear: paymentMethodDetails.expiryYear,
          });
          // Payment method saved successfully
        } catch {
          // Failed to save payment method — non-critical, order still completes
        }
      } else if (!isLoggedIn && paymentMethodDetails?.token) {
        // Guest user: store token and show account creation prompt
        setPendingPaymentMethodToken(paymentMethodDetails.token);
        setShowGuestSavePrompt(true);
        return; // Don't redirect yet
      }
    }

    // Redirect to order history (account page if logged in, my-orders for guests)
    const isLoggedIn = customerAuthService.isAuthenticated();
    router.push(isLoggedIn ? '/account/orders' : '/my-orders');
  };

  const handleBack = () => {
    if (currentStep === 'payment') {
      setCurrentStep('shipping');
    } else if (currentStep === 'shipping') {
      setCurrentStep('fulfillment');
    } else if (currentStep === 'fulfillment') {
      setCurrentStep('review');
    } else {
      router.push('/carts');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back
              </Button>
              {currentStep === 'review' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/carts')}
                >
                  <ShoppingCart className="mr-1.5 h-4 w-4" />
                  Edit Cart
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                {(tenantDisplayLogo || cart.tenant_logo) ? (
                  <img
                    src={tenantDisplayLogo || cart.tenant_logo || ''}
                    alt={tenantDisplayName || cart.tenant_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Store className="h-4 w-4 text-gray-400" />
                )}
              </div>
              <span className="text-sm font-medium text-gray-700 truncate">{tenantDisplayName || cart.tenant_name}</span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold">Checkout</h1>
        </div>

        {/* Progress Indicator */}
        <CheckoutProgress currentStep={currentStep} />

        {/* Checkout Disabled Panel for Storefront/Starter tier */}
        {checkoutMode === 'disabled' && (
          <Card className="mt-6 border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="text-amber-800 flex items-center gap-2">
                <Store className="h-5 w-5" />
                Online Checkout Unavailable
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-amber-700">
                This store is currently unable to process online payments. However, you can still contact them directly to place your order!
              </p>

              {tenantContact && (
                <div className="bg-white rounded-lg p-4 border border-amber-200">
                  <h3 className="font-semibold text-gray-900 mb-3">Contact {tenantContact.business_name}</h3>
                  <div className="space-y-2 text-sm">
                    {tenantContact.phone_number && (
                      <a
                        href={`tel:${tenantContact.phone_number}`}
                        className="flex items-center gap-2 text-gray-700 hover:text-primary-600"
                      >
                        <Phone className="h-4 w-4 text-gray-400" />
                        {tenantContact.phone_number}
                      </a>
                    )}
                    {tenantContact.email && (
                      <a
                        href={`mailto:${tenantContact.email}`}
                        className="flex items-center gap-2 text-gray-700 hover:text-primary-600"
                      >
                        <Mail className="h-4 w-4 text-gray-400" />
                        {tenantContact.email}
                      </a>
                    )}
                    {tenantContact.website && (
                      <a
                        href={tenantContact.website.startsWith('http') ? tenantContact.website : `https://${tenantContact.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-gray-700 hover:text-primary-600"
                      >
                        <Globe className="h-4 w-4 text-gray-400" />
                        {tenantContact.website}
                      </a>
                    )}
                    {tenantContact.address && (
                      <div className="flex items-start gap-2 text-gray-700">
                        <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                        <span>
                          {tenantContact.address.street}
                          {tenantContact.address.city && `, ${tenantContact.address.city}`}
                          {tenantContact.address.state && `, ${tenantContact.address.state}`}
                          {tenantContact.address.zip && ` ${tenantContact.address.zip}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => router.push(`/tenant/${tenantId}`)}
                >
                  <Store className="mr-2 h-4 w-4" />
                  Continue Browsing
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => router.push('/directory')}
                >
                  Explore Other Stores
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content - Only show if checkout is enabled */}
        {checkoutMode !== 'disabled' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
            {/* Left Column - Forms */}
            <div className="lg:col-span-2 space-y-6">
              {/* Step 1: Review & Customer Info */}
              {currentStep === 'review' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Customer Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CustomerInfoForm
                      initialData={customerInfo}
                      onSubmit={handleCustomerInfoSubmit}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Coupon Input (review step) */}
              {currentStep === 'review' && tenantId && cartItems.length > 0 && (
                <CouponInput
                  tenantId={tenantId}
                  onDiscountApplied={(discountCents) => setCouponDiscount(discountCents)}
                />
              )}

              {/* Order Bump Offer (review step) */}
              {currentStep === 'review' && tenantId && cartItems.length > 0 && (
                <OrderBump
                  tenantId={tenantId}
                  triggerProductId={cartItems[0]?.product_id}
                  cartValueCents={subtotal}
                  customerId={customerId || undefined}
                />
              )}

              {/* Step 2: Fulfillment Method */}
              {currentStep === 'fulfillment' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Fulfillment Method</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FulfillmentMethodForm
                      tenantId={tenantId}
                      subtotal={subtotal}
                      initialMethod={fulfillmentMethod || undefined}
                      onSubmit={handleFulfillmentSubmit}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Step 3: Shipping Address (only for delivery/shipping) */}
              {currentStep === 'shipping' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Shipping Address</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ShippingAddressFormWithSaved
                      initialData={shippingAddress}
                      onSubmit={handleShippingSubmit}
                      selectedAddressId={selectedAddressId}
                      onAddressSelect={setSelectedAddressId}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Step 4: Payment */}
              {currentStep === 'payment' && customerInfo && fulfillmentMethod && (
                fulfillmentMethod === 'pickup' || shippingAddress
              ) && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Payment Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Payment Method Selector */}
                      <div className="space-y-3">
                        <h3 className="font-medium text-neutral-900 dark:text-white">
                          Select Payment Method
                        </h3>

                        {/* Only show available payment gateways */}
                        {availableGateways.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            <CreditCard className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                            <p>No payment methods are configured</p>
                            <p className="text-sm">Please contact the store to set up payment options</p>
                          </div>
                        ) : (
                          <>
                            {/* Square Option - Only show if configured */}
                            {availableGateways.includes('square') && (
                              <button
                                onClick={() => setPaymentMethod('square')}
                                aria-pressed={paymentMethod === 'square'}
                                className={`w-full p-4 rounded-lg border-2 transition-all ${paymentMethod === 'square'
                                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                                    : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                                  }`}
                              >
                                <div className="flex items-center gap-3">
                                  <CreditCard className="h-6 w-6 text-primary-600" />
                                  <div className="text-left flex-1">
                                    <div className="font-medium text-neutral-900 dark:text-white">
                                      Credit or Debit Card
                                    </div>
                                    <div className="text-sm text-neutral-600 dark:text-neutral-400">
                                      Visa, Mastercard, Amex, Discover
                                    </div>
                                  </div>
                                  {paymentMethod === 'square' && (
                                    <div className="w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center">
                                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                              </button>
                            )}

                            {/* PayPal Option - Only show if configured */}
                            {availableGateways.includes('paypal') && (
                              <button
                                onClick={() => setPaymentMethod('paypal')}
                                aria-pressed={paymentMethod === 'paypal'}
                                className={`w-full p-4 rounded-lg border-2 transition-all ${paymentMethod === 'paypal'
                                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                                    : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                                  }`}
                              >
                                <div className="flex items-center gap-3">
                                  <Wallet className="h-6 w-6 text-[#0070BA]" />
                                  <div className="text-left flex-1">
                                    <div className="font-medium text-neutral-900 dark:text-white">
                                      PayPal
                                    </div>
                                    <div className="text-sm text-neutral-600 dark:text-neutral-400">
                                      Pay with your PayPal account
                                    </div>
                                  </div>
                                  {paymentMethod === 'paypal' && (
                                    <div className="w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center">
                                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                              </button>
                            )}
                            {/* Stripe Option - Only show if configured */}
                            {availableGateways.includes('stripe') && (
                              <button
                                onClick={() => setPaymentMethod('stripe')}
                                aria-pressed={paymentMethod === 'stripe'}
                                className={`w-full p-4 rounded-lg border-2 transition-all ${paymentMethod === 'stripe'
                                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                                    : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300'
                                  }`}
                              >
                                <div className="flex items-center gap-3">
                                  <CreditCard className="h-6 w-6 text-purple-600" />
                                  <div className="text-left flex-1">
                                    <div className="font-medium text-neutral-900 dark:text-white">
                                      Credit or Debit Card (Stripe)
                                    </div>
                                    <div className="text-sm text-neutral-600 dark:text-neutral-400">
                                      Visa, Mastercard, Amex, Discover
                                    </div>
                                  </div>
                                  {paymentMethod === 'stripe' && (
                                    <div className="w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center">
                                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                              </button>
                            )}
                          </>
                        )}
                      </div>

                      {/* Save Payment Method Option */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            id="savePaymentMethod"
                            checked={savePaymentMethod}
                            onChange={(e) => setSavePaymentMethod(e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 mt-0.5"
                          />
                          <label htmlFor="savePaymentMethod" className="text-sm text-blue-700">
                            {isAuthenticated
                              ? 'Save this payment method for future purchases'
                              : 'Save this payment method for faster checkout (you\'ll create an account after payment)'}
                          </label>
                        </div>
                      </div>

                      {/* Conditional Payment Form - only show if gateways are available */}
                      {availableGateways.length > 0 && (
                        paymentMethod === 'square' ? (
                          <SquarePaymentForm
                            amount={checkoutMode === 'deposit' && depositInfo ? depositInfo.depositCents : total}
                            customerInfo={customerInfo}
                            shippingAddress={shippingAddress ?? undefined}
                            fulfillmentMethod={fulfillmentMethod}
                            cartItems={mappedCartItems}
                            onSuccess={handlePaymentSuccess}
                            onBack={() => setCurrentStep('shipping')}
                            squareConfig={squareConfig}
                            checkoutMode={checkoutMode}
                          />
                        ) : paymentMethod === 'stripe' ? (
                          <StripePaymentForm
                            amount={checkoutMode === 'deposit' && depositInfo ? depositInfo.depositCents : total}
                            customerInfo={customerInfo}
                            shippingAddress={shippingAddress ?? undefined}
                            fulfillmentMethod={fulfillmentMethod}
                            cartItems={mappedCartItems}
                            onSuccess={handlePaymentSuccess}
                            onBack={() => setCurrentStep('shipping')}
                            tenantId={tenantId || ''}
                            savePaymentMethod={savePaymentMethod}
                            checkoutMode={checkoutMode}
                          />
                        ) : (
                          <PayPalPaymentForm
                            amount={checkoutMode === 'deposit' && depositInfo ? depositInfo.depositCents : total}
                            customerInfo={customerInfo}
                            shippingAddress={shippingAddress ?? undefined}
                            fulfillmentMethod={fulfillmentMethod}
                            cartItems={mappedCartItems}
                            onSuccess={handlePaymentSuccess}
                            onBack={() => setCurrentStep('shipping')}
                            checkoutMode={checkoutMode}
                          />
                        )
                      )}
                    </CardContent>
                  </Card>
                )}
            </div>

            {/* Right Column - Order Summary */}
            <div className="lg:col-span-1">
              <div className="lg:sticky lg:top-8">
                <OrderSummary
                  items={mappedCartItems}
                  subtotal={subtotal}
                  platformFee={platformFee}
                  platformFeePercentage={platformFeePercentage}
                  shipping={fulfillmentFee}
                  total={total}
                  tax={taxAmount}
                  fulfillmentMethod={fulfillmentMethod || undefined}
                  // Tier 3 Commitment - Deposit fields
                  checkoutMode={checkoutMode}
                  depositOption={depositOption}
                  depositAmount={depositInfo?.depositCents}
                  remainingBalance={depositInfo?.remainingBalanceCents}
                  depositPercentage={depositInfo?.depositPercentage}
                  pickupDeadline={depositInfo?.pickupDeadline}
                  onCheckoutModeChange={(mode) => {
                    setCheckoutMode(mode);
                    // Customer selected checkout mode
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Guest Save Payment Method Prompt */}
      {showGuestSavePrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Save Your Payment Method?</h3>
            <p className="text-sm text-gray-600">
              Create an account to save this payment method for faster checkout next time.
            </p>

            <GuestSavePaymentMethodPrompt
              customerInfo={customerInfo}
              tenantId={tenantId || ''}
              paymentMethod={paymentMethod}
              pendingToken={pendingPaymentMethodToken}
              onSaved={() => {
                setShowGuestSavePrompt(false);
                router.push('/account/orders');
              }}
              onSkip={() => {
                setShowGuestSavePrompt(false);
                router.push('/my-orders');
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading checkout...</p>
        </div>
      </div>
    }>
      <CheckoutPageContent />
    </Suspense>
  );
}
