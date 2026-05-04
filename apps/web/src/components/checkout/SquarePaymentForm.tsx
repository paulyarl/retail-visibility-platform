'use client';

import { useEffect, useState } from 'react';
import { Button } from '@mantine/core';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Loader2, CreditCard, Lock } from 'lucide-react';
import { customerOrderService } from '@/services/CustomerOrderService';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import { validateMinimumPaymentAmount } from '@/utils/paymentValidation';

interface SquarePaymentFormProps {
  amount: number;
  customerInfo: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
  shippingAddress?: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  fulfillmentMethod?: 'pickup' | 'delivery' | 'shipping';
  cartItems: Array<{
    id: string;
    name: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    listPrice?: number;
    imageUrl?: string;
    inventoryItemId?: string;
    tenantId: string;
  }>;
  onSuccess: (orderNumber: string, gatewayTransactionId?: string) => void;
  onBack: () => void;
  squareConfig?: { applicationId: string; locationId: string } | null;
}

interface SquarePaymentFormContentProps extends SquarePaymentFormProps {
  orderId: string;
  orderNumber: string;
  paymentId: string;
}

function SquarePaymentFormContent({
  amount,
  customerInfo,
  shippingAddress,
  cartItems,
  onSuccess,
  onBack,
  orderId,
  orderNumber,
  paymentId,
  squareConfig,
}: SquarePaymentFormContentProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState<any>(null);
  const [payments, setPayments] = useState<any>(null);

  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;
    let retryTimeout: NodeJS.Timeout;
    
    const initializeSquare = async () => {
      console.log('[SquarePaymentForm] initializeSquare called', {
        hasSquareConfig: !!squareConfig,
        squareConfig,
        hasWindowSquare: !!window.Square,
        cardInitialized: !!card,
        retryCount
      });
      
      try {
        // Check if Square.js is loaded
        if (!window.Square) {
          console.log('[SquarePaymentForm] Square.js not yet loaded, waiting...');
          throw new Error('Square.js failed to load. Please refresh the page.');
        }

        // Use tenant-specific Square config or fall back to env vars
        const appId = squareConfig?.applicationId || process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID;
        const locationId = squareConfig?.locationId || process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;
        
        console.log('[SquarePaymentForm] Config check', {
          appId: appId ? 'present' : 'missing',
          locationId: locationId ? 'present' : 'missing',
          source: squareConfig ? 'tenant-config' : 'env-vars'
        });
        
        if (!appId || !locationId) {
          // Config not yet loaded - will retry when squareConfig updates
          console.log('[SquarePaymentForm] Waiting for Square config...');
          return;
        }

        console.log('[SquarePaymentForm] Initializing Square payments with appId:', appId);
        
        // Initialize Square payments
        const paymentsInstance = window.Square.payments(appId, locationId);
        
        if (!paymentsInstance) {
          throw new Error('Failed to initialize Square payments instance');
        }

        console.log('[SquarePaymentForm] Payments instance created, creating card...');
        setPayments(paymentsInstance);

        // Add timeout for card creation
        const cardPromise = paymentsInstance.card();
        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error('Card initialization timed out')), 10000);
        });
        
        const cardInstance = await Promise.race([cardPromise, timeoutPromise]) as any;
        
        if (!cardInstance) {
          throw new Error('Failed to create card instance');
        }
        
        console.log('[SquarePaymentForm] Card instance created, attaching to DOM...');
        await cardInstance.attach('#card-container');
        console.log('[SquarePaymentForm] Card attached successfully');
        setCard(cardInstance);
      } catch (err) {
        console.error('[SquarePaymentForm] Initialization error:', err);
        
        // Retry on timeout or SDK initialization errors
        const errorMessage = err instanceof Error ? err.message : '';
        if ((errorMessage.includes('timed out') || errorMessage.includes('unable to be initialized')) && retryCount < maxRetries) {
          retryCount++;
          console.log(`[SquarePaymentForm] Retrying initialization (attempt ${retryCount}/${maxRetries})...`);
          retryTimeout = setTimeout(initializeSquare, 2000);
        } else {
          setError(err instanceof Error ? err.message : 'Failed to initialize Square payment form');
        }
      }
    };

    initializeSquare();

    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      if (card) {
        card.destroy();
      }
    };
  }, [squareConfig]);

  const handlePayment = async () => {
    if (!card || !payments) {
      setError('Payment form not initialized');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Tokenize card
      const result = await card.tokenize();
      
      if (result.status === 'OK') {
        const token = result.token;

        try {
          // Process payment with backend
          const response = await customerOrderService.processSquarePayment({
            orderId,
            paymentId,
            sourceId: token,
            amount,
            customerInfo,
            shippingAddress,
            cartItems,
          });

          if (!response) {
            throw new Error('Payment failed');
          }

          const { payment } = response;
          
          // Success - call onSuccess with order number and transaction ID
          onSuccess(orderNumber, payment.id);
        } catch (paymentError) {
          console.error('Backend payment error:', paymentError);
          setError(paymentError instanceof Error ? paymentError.message : 'Payment processing failed');
          setIsProcessing(false);
        }
      } else {
        // Handle tokenization errors gracefully
        const errors = result.errors || [];
        const errorMessage = errors.map((e: any) => e.message).join(', ');
        console.error('Square tokenization errors:', errors);
        setError(errorMessage || 'Card validation failed');
        setIsProcessing(false);
      }
    } catch (err) {
      console.error('Square payment error:', err);
      setError(err instanceof Error ? err.message : 'Payment processing failed');
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {/* Square Card Container - always rendered so Square SDK can attach */}
        <div 
          id="card-container" 
          className="min-h-[200px] p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
        >
          {/* Show loading inside container until card is ready */}
          {!card && !error && (
            <div className="flex items-center justify-center h-full min-h-[168px]">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <p className="ml-3 text-gray-600">Loading payment form...</p>
            </div>
          )}
        </div>

        {/* Security Badge */}
        <div className="flex items-center justify-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
          <Lock className="h-4 w-4" />
          <span>Secure payment powered by Square</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isProcessing}
          className="flex-1"
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={handlePayment}
          disabled={isProcessing || !card}
          className="flex-1"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Pay ${(amount / 100).toFixed(2)}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default function SquarePaymentForm(props: SquarePaymentFormProps) {
  const [orderId, setOrderId] = useState<string>('');
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [paymentId, setPaymentId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { settings: platformSettings } = usePlatformSettings();

  // Validate minimum payment amount using platform-wide settings
  const paymentValidation = validateMinimumPaymentAmount(props.amount, platformSettings?.minimumPaymentAmount);
  
  if (!paymentValidation.isValid) {
    console.log('[Square] Amount validation failed:', paymentValidation);
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800 font-medium">Payment Amount Too Low</p>
        <p className="text-red-600 text-sm mt-1">{paymentValidation.message}</p>
      </div>
    );
  }

  // Destructure props for useEffect dependencies
  const { customerInfo, shippingAddress, cartItems, amount } = props;

  useEffect(() => {
    const initializePayment = async () => {
      try {
        // Create order
        const orderResponse = await customerOrderService.createCheckoutOrder({
          customerInfo: {
            email: customerInfo.email,
            firstName: customerInfo.firstName,
            lastName: customerInfo.lastName,
            phone: customerInfo.phone,
          },
          cartItems: cartItems.map((item) => ({
            id: item.inventoryItemId,
            sku: item.sku,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            listPrice: item.listPrice,
            image_url: item.imageUrl,
            tenant_id: item.tenantId,
          })),
          fulfillmentMethod: 'pickup',
          shippingAddress: shippingAddress,
          paymentMethod: 'square',
        });

        if (!orderResponse) {
          throw new Error('Failed to create order - no response');
        }

        // Check for error response
        if (!orderResponse.success) {
          const errorMsg = orderResponse.message || orderResponse.error || 'Failed to create order';
          console.error('[SquarePaymentForm] Order creation failed:', orderResponse);
          throw new Error(errorMsg);
        }

        const responseData = orderResponse.data || orderResponse;
        const order = responseData.order;
        const payment = responseData.payment;
        
        if (!order?.id) {
          console.error('[SquarePaymentForm] Invalid order response:', orderResponse);
          throw new Error('Order creation returned invalid data');
        }
        
        setOrderId(order.id);
        setOrderNumber(order.order_number);
        
        // Payment is created by the backend during order creation
        if (payment?.id) {
          setPaymentId(payment.id);
        }
        setIsLoading(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize payment';
        setError(errorMessage);
        setIsLoading(false);
      }
    };

    initializePayment();
  }, [customerInfo, shippingAddress, cartItems, amount]);

  // Load Square.js script
  useEffect(() => {
    if (document.getElementById('square-js')) {
      return; // Already loaded
    }

    const script = document.createElement('script');
    script.id = 'square-js';
    script.src = 'https://sandbox.web.squarecdn.com/v1/square.js';
    script.async = true;
    script.onload = () => {
      console.log('Square.js loaded successfully');
    };
    script.onerror = (error) => {
      console.error('Failed to load Square.js script:', error);
      setError('Failed to load Square payment form. Please refresh the page.');
    };
    document.body.appendChild(script);

    // Cleanup function
    return () => {
      const existingScript = document.getElementById('square-js');
      if (existingScript && existingScript.parentNode) {
        existingScript.parentNode.removeChild(existingScript);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <p className="ml-3 text-gray-600">Preparing payment...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="error">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <SquarePaymentFormContent
      {...props}
      orderId={orderId}
      orderNumber={orderNumber}
      paymentId={paymentId}
      squareConfig={props.squareConfig}
    />
  );
}

// Extend Window interface for Square
declare global {
  interface Window {
    Square?: any;
  }
}
