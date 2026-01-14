'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { CheckoutProgress } from '@/components/checkout/CheckoutProgress';
import { OrderSummary } from '@/components/checkout/OrderSummary';
import { CustomerInfoForm } from '@/components/checkout/CustomerInfoForm';
import FulfillmentMethodForm, { FulfillmentMethod } from '@/components/checkout/FulfillmentMethodForm';
import { ShippingAddressForm } from '@/components/checkout/ShippingAddressForm';
import PayPalPaymentForm from '@/components/checkout/PayPalPaymentForm';
import SquarePaymentForm from '@/components/checkout/SquarePaymentForm';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ArrowLeft, ShoppingCart, Store, CreditCard, Wallet } from 'lucide-react';

type CheckoutStep = 'review' | 'fulfillment' | 'shipping' | 'payment';
type PaymentMethod = 'square' | 'paypal';

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
  
  const { getCart, clearCart, markCartAsPaid, activeCartTenantId, switchCart } = useCart();
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('review');
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod | null>(null);
  const [fulfillmentFee, setFulfillmentFee] = useState<number>(0);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(gatewayType || 'square');
  const [isInitialized, setIsInitialized] = useState(false);
  const [availableGateways, setAvailableGateways] = useState<PaymentMethod[]>([]);

  // Get the cart for this tenant
  const cart = tenantId ? getCart(tenantId) : null;
  const cartItems = cart?.items || [];
  const subtotal = cart?.subtotal || 0;

  // Fetch available payment gateways
  useEffect(() => {
    const fetchPaymentGateways = async () => {
      if (!tenantId) return;
      
      try {
        const response = await fetch(`/api/tenants/${tenantId}/payment-gateways`);
        if (!response.ok) return;
        
        const data = await response.json();
        const gateways = data.gateways || [];
        
        // Extract active gateway types
        const activeTypes = gateways
          .filter((gateway: any) => gateway.is_active)
          .map((gateway: any) => gateway.gateway_type as PaymentMethod);
        
        setAvailableGateways(activeTypes);
        
        // Set default payment method to first available if current selection is not available
        if (activeTypes.length > 0 && !activeTypes.includes(paymentMethod)) {
          setPaymentMethod(activeTypes[0]);
        }
      } catch (error) {
        console.error('Failed to fetch payment gateways:', error);
      }
    };

    fetchPaymentGateways();
  }, [tenantId]);

  // Initialize checkout - switch to cart and validate
  useEffect(() => {
    console.log('[Checkout] Initialization check:', { 
      tenantId, 
      hasCart: !!cart, 
      cartStatus: cart?.status,
      isInitialized 
    });

    if (!tenantId) {
      console.log('[Checkout] No tenant ID, redirecting to /carts');
      router.push('/carts');
      return;
    }

    if (cart) {
      console.log('[Checkout] Cart found:', { 
        tenantId: cart.tenantId, 
        status: cart.status, 
        itemCount: cart.itemCount 
      });

      // Cart exists - check if it's valid for checkout
      if (cart.status === 'paid' || cart.status === 'fulfilled') {
        console.log('[Checkout] Cart already paid, redirecting to /carts');
        router.push('/carts');
        return;
      }
      
      // Valid cart - switch to it and mark as initialized
      if (!isInitialized) {
        console.log('[Checkout] Valid cart, initializing checkout');
        switchCart(tenantId);
        setIsInitialized(true);
      }
    } else if (!isInitialized) {
      // Cart doesn't exist yet - give it a moment to load from localStorage
      console.log('[Checkout] No cart found, waiting for load...');
      const timer = setTimeout(() => {
        const loadedCart = getCart(tenantId);
        if (!loadedCart) {
          console.log('[Checkout] Cart still not found after delay, redirecting');
          router.push('/carts');
        } else {
          console.log('[Checkout] Cart loaded after delay');
          setIsInitialized(true);
        }
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [tenantId, cart, switchCart, router, getCart, isInitialized]);

  const platformFee = Math.round(subtotal * 0.03); // 3% platform fee
  const total = subtotal + platformFee + fulfillmentFee;

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

  const handleCustomerInfoSubmit = (info: CustomerInfo) => {
    setCustomerInfo(info);
    setCurrentStep('fulfillment');
  };

  const handleFulfillmentSubmit = (method: FulfillmentMethod, fee: number) => {
    setFulfillmentMethod(method);
    setFulfillmentFee(fee);
    
    // If pickup, skip shipping address and go to payment
    if (method === 'pickup') {
      setCurrentStep('payment');
    } else {
      setCurrentStep('shipping');
    }
  };

  const handleShippingSubmit = (address: ShippingAddress) => {
    setShippingAddress(address);
    setCurrentStep('payment');
  };

  const handlePaymentSuccess = async (orderNumber: string, gatewayTransactionId?: string) => {
    console.log('[Checkout] Payment success:', {
      orderNumber,
      gatewayTransactionId,
      customerInfo,
      shippingAddress,
      fulfillmentMethod,
      fulfillmentFee,
      tenantId
    });
    
    // Mark this specific tenant's cart as paid after successful payment
    if (tenantId) {
      await markCartAsPaid(tenantId, orderNumber, customerInfo, shippingAddress, fulfillmentMethod || undefined, fulfillmentFee, gatewayTransactionId);
    }
    
    // Save customer email/phone to localStorage for order history lookup
    if (customerInfo?.email) {
      localStorage.setItem('buyer_email', customerInfo.email);
    }
    if (customerInfo?.phone) {
      localStorage.setItem('buyer_phone', customerInfo.phone);
    }
    
    // Redirect to buyer order history
    router.push('/my-orders');
  };

  const handleBack = () => {
    if (currentStep === 'payment') {
      // If pickup, go back to fulfillment, otherwise shipping
      if (fulfillmentMethod === 'pickup') {
        setCurrentStep('fulfillment');
      } else {
        setCurrentStep('shipping');
      }
    } else if (currentStep === 'shipping') {
      setCurrentStep('fulfillment');
    } else if (currentStep === 'fulfillment') {
      setCurrentStep('review');
    } else {
      router.push(`/cart/${tenantId}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <Button
              variant="ghost"
              onClick={handleBack}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            
            {/* Store Branding */}
            <div className="flex items-center gap-3 mb-4 p-4 bg-white rounded-lg border">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                {cart.tenantLogo ? (
                  <img
                    src={cart.tenantLogo}
                    alt={cart.tenantName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Store className="h-6 w-6 text-gray-400" />
                )}
              </div>
              <div>
                <p className="text-sm text-gray-600">Purchasing from</p>
                <p className="font-semibold text-gray-900">{cart.tenantName}</p>
              </div>
            </div>
            
            <h1 className="text-3xl font-bold">Checkout</h1>
          </div>

          {/* Progress Indicator */}
          <CheckoutProgress currentStep={currentStep} />

          {/* Main Content */}
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
                    <ShippingAddressForm
                      initialData={shippingAddress}
                      onSubmit={handleShippingSubmit}
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
                              className={`w-full p-4 rounded-lg border-2 transition-all ${
                                paymentMethod === 'square'
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
                              className={`w-full p-4 rounded-lg border-2 transition-all ${
                                paymentMethod === 'paypal'
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
                        </>
                      )}
                    </div>

                    {/* Conditional Payment Form */}
                    {paymentMethod === 'square' ? (
                      <SquarePaymentForm
                        amount={total}
                        customerInfo={customerInfo}
                        shippingAddress={shippingAddress ?? undefined}
                        fulfillmentMethod={fulfillmentMethod}
                        cartItems={cartItems}
                        onSuccess={handlePaymentSuccess}
                        onBack={() => setCurrentStep('shipping')}
                      />
                    ) : (
                      <PayPalPaymentForm
                        amount={total}
                        customerInfo={customerInfo}
                        shippingAddress={shippingAddress ?? undefined}
                        fulfillmentMethod={fulfillmentMethod}
                        cartItems={cartItems}
                        onSuccess={handlePaymentSuccess}
                        onBack={() => setCurrentStep('shipping')}
                      />
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column - Order Summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-8">
                <OrderSummary
                  items={cartItems}
                  subtotal={subtotal}
                  platformFee={platformFee}
                  shipping={fulfillmentFee}
                  total={total}
                  fulfillmentMethod={fulfillmentMethod || undefined}
                />
              </div>
            </div>
          </div>
        </div>
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
