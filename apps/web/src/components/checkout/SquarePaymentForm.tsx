'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@mantine/core';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { Loader2, CreditCard, Lock } from 'lucide-react';
import { customerOrderService } from '@/services/CustomerOrderService';

// Extend window interface for Square initialization flags
declare global {
  interface Window {
    Square?: any;
  }
}
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
  onSuccess: (orderNumber: string, gatewayTransactionId?: string, paymentMethodDetails?: { token?: string; cardLast4?: string; cardBrand?: string; expiryMonth?: number; expiryYear?: string }) => void;
  onBack: () => void;
  squareConfig?: { applicationId: string; locationId: string } | null;
  checkoutMode?: 'deposit' | 'full_payment';
}

interface SquarePaymentFormContentProps extends SquarePaymentFormProps {
  orderId: string;
  orderNumber: string;
  paymentId: string;
  backendPaymentAmount?: number;
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
  checkoutMode,
  backendPaymentAmount,
}: SquarePaymentFormContentProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState<any>(null);
  const [payments, setPayments] = useState<any>(null);
  const previousOrderIdRef = useRef<string | null>(null);

  useEffect(() => {
    // PRIMARY GUARD: Use global window flag that persists across React Strict Mode remounts
    const guardKey = `square-guard-${orderId || 'default'}`;
    if ((window as any)[guardKey]) {
      console.log('[SquarePaymentForm] Already initializing (global guard), skipping duplicate');
      return;
    }
    // Set global guard immediately
    (window as any)[guardKey] = true;

    // Skip if orderId hasn't changed and we already have a card
    if (previousOrderIdRef.current === orderId && card) {
      console.log('[SquarePaymentForm] Same orderId and card exists, skipping re-initialization');
      return;
    }

    // Update previous orderId
    const previousOrderId = previousOrderIdRef.current;
    previousOrderIdRef.current = orderId;
    
    let retryCount = 0;
    const maxRetries = 3;
    let retryTimeout: NodeJS.Timeout;

    const initializeSquare = async () => {
      // Prevent initialization if orderId is empty
      if (!orderId) {
        console.log('[SquarePaymentForm] No orderId yet, waiting...');
        return;
      }

      // Wait for DOM to be ready using multiple strategies
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Additional wait using requestAnimationFrame to ensure DOM is painted
      await new Promise(resolve => requestAnimationFrame(resolve));

      // Check if container already has a Square card attached
      const containerId = `card-container-${orderId || 'default'}`;
      // console.log('[SquarePaymentForm] Looking for container:', containerId);
      
      // Log all available containers for debugging
      const allContainers = document.querySelectorAll('[id^="card-container-"]');
      // console.log('[SquarePaymentForm] Available containers:', Array.from(allContainers).map(el => el.id));
      
      let container = document.getElementById(containerId);
      if (container) {
        // console.log('[SquarePaymentForm] Container found:', containerId);
      } else {
        // Fallback: use any available Square container if the specific one isn't found
        // console.log('[SquarePaymentForm] Specific container not found, looking for fallback...');
        const allContainers = document.querySelectorAll('[id^="card-container-"]');
        if (allContainers.length > 0) {
          container = allContainers[0] as HTMLElement;
          // console.log('[SquarePaymentForm] Using fallback container:', container.id);
          // console.log('[SquarePaymentForm] This suggests there might be multiple orders or stale order IDs');
        } else {
          // console.log('[SquarePaymentForm] No Square containers found at all');
        }
      }
      
      if (container) {
        // console.log('[SquarePaymentForm] Container ready for Square card attachment');
      } else {
        // console.log('[SquarePaymentForm] Container not yet available, will retry...');
        // console.log('[SquarePaymentForm] Retry count:', retryCount, '/', maxRetries);
        if (retryCount < maxRetries) {
          retryCount++;
          
          // Use a longer delay and MutationObserver as fallback
          const waitForContainer = () => {
            return new Promise<boolean>((resolve) => {
              const observer = new MutationObserver((mutations, obs) => {
                // Check for specific container first
                let container = document.getElementById(containerId);
                if (container) {
                  obs.disconnect();
                  resolve(true);
                  return;
                }
                
                // Fallback to any Square container
                const allContainers = document.querySelectorAll('[id^="card-container-"]');
                if (allContainers.length > 0) {
                  obs.disconnect();
                  resolve(true);
                  return;
                }
              });
              
              observer.observe(document.body, {
                childList: true,
                subtree: true
              });
              
              // Fallback timeout
              setTimeout(() => {
                observer.disconnect();
                resolve(false);
              }, 2000);
            });
          };
          
          const found = await waitForContainer();
          if (found) {
            // console.log('[SquarePaymentForm] Container found via MutationObserver, retrying...');
            retryTimeout = setTimeout(initializeSquare, 100);
          } else {
            retryTimeout = setTimeout(initializeSquare, 800);
          }
          return;
        } else {
          throw new Error(`Container #${containerId} not found after ${maxRetries} attempts. Available containers: ${Array.from(allContainers).map(el => el.id).join(', ')}`);
        }
      }
      
      try {
        // Check if Square.js is loaded
        if (!window.Square) {
          // console.log('[SquarePaymentForm] Square.js not yet loaded, waiting...');
          throw new Error('Square.js failed to load. Please refresh the page.');
        }

        // Use tenant-specific Square config or fall back to env vars
        const appId = squareConfig?.applicationId || process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID;
        const locationId = squareConfig?.locationId || process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;
        
        if (!appId || !locationId) {
          // Config not yet loaded - will retry when squareConfig updates
          // console.log('[SquarePaymentForm] Waiting for Square config...');
          return;
        }

        // Container already cleared above if needed
        
        // Initialize Square payments
        const paymentsInstance = window.Square.payments(appId, locationId);
        
        if (!paymentsInstance) {
          throw new Error('Failed to initialize Square payments instance');
        }

        // console.log('[SquarePaymentForm] Payments instance created, creating card...');
        setPayments(paymentsInstance);

        // Add timeout for card creation
        const cardPromise = paymentsInstance.card();
        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error('Card initialization timed out')), 10000);
        });

        const cardInstance = await Promise.race([cardPromise, timeoutPromise]);
        
        if (!cardInstance) {
          throw new Error('Failed to create Square card instance');
        }
        
        // console.log('[SquarePaymentForm] Card instance created, attaching to DOM...');
        
        // Use the container that was found earlier (might be fallback)
        if (!container) {
          throw new Error(`No container available for Square card attachment`);
        }
        
        await cardInstance.attach(container);
        // console.log('[SquarePaymentForm] Card attached successfully to:', container.id);
        setCard(cardInstance);
      } catch (err) {
        // console.error('[SquarePaymentForm] Initialization error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        
        if ((errorMessage.includes('timed out') || errorMessage.includes('unable to be initialized') || errorMessage.includes('not found in DOM')) && retryCount < maxRetries) {
          retryCount++;
          // console.log(`[SquarePaymentForm] Retrying initialization (attempt ${retryCount}/${maxRetries})...`);
          retryTimeout = setTimeout(initializeSquare, 2000);
        } else {
          setError(err instanceof Error ? err.message : 'Failed to initialize Square payment form');
        }
      }
    };

    initializeSquare();

    return () => {
      // CRITICAL: Don't clear guard on first run (previousOrderId is null) or Strict Mode re-run
      // Only clear when orderId actually CHANGES to a different value
      const isFirstRun = previousOrderId === null;
      const isStrictModeRerun = previousOrderId === orderId;

      if (isFirstRun || isStrictModeRerun) {
        // Don't clear anything - Strict Mode will re-run the effect
        // console.log('[SquarePaymentForm] Strict Mode cleanup - preserving guard for re-initialization');
        return;
      }

      // Real cleanup: orderId changed to a different value
      // console.log('[SquarePaymentForm] Real cleanup - orderId changed from', previousOrderId, 'to', orderId);
      
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      if (card) {
        try {
          card.destroy();
          // console.log('[SquarePaymentForm] Card instance destroyed');
        } catch (err) {
          // Silently ignore destroy errors - Square SDK handles cleanup
        }
        setCard(null);
      }
      // Clear global guard flag
      const guardKey = `square-guard-${orderId || 'default'}`;
      delete (window as any)[guardKey];
    };
  }, [orderId, squareConfig?.applicationId, squareConfig?.locationId]); // Only re-initialize if orderId or actual config values change

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
            amount: backendPaymentAmount ?? amount,
            customerInfo,
            shippingAddress,
            cartItems,
          });

          if (!response) {
            throw new Error('Payment failed');
          }

          // console.log('[Square] Backend response:', response);
          const { data } = response;
          const { payment } = data || {};
          
          if (!payment || !payment.id) {
            console.error('[Square] Invalid payment object:', { payment, response });
            throw new Error('Invalid payment response from server');
          }
          
          // Success - call onSuccess with order number, transaction ID, and card details
          onSuccess(orderNumber, payment.id, {
            token: result.token,
            cardLast4: payment.cardDetails?.last4,
            cardBrand: payment.cardDetails?.cardBrand,
            expiryMonth: payment.cardDetails?.expMonth,
            expiryYear: payment.cardDetails?.expYear,
          });
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
          id={`card-container-${orderId || 'default'}`} 
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
          variant='gradient'
          style={{ color: 'white' }}
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
  const [backendPaymentAmount, setBackendPaymentAmount] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { settings: platformSettings } = usePlatformSettings();
  const orderCreatedRef = useRef(false);

  // Destructure props for useEffect dependencies
  const { customerInfo, shippingAddress, cartItems, amount, checkoutMode } = props;

  // Validate minimum payment amount using platform-wide settings
  const paymentValidation = validateMinimumPaymentAmount(props.amount, platformSettings?.minimumPaymentAmount);

  useEffect(() => {
    if (!paymentValidation.isValid) {
      setIsLoading(false);
      return;
    }

    // Prevent duplicate order creation in React Strict Mode
    if (orderCreatedRef.current) {
      console.log('[SquarePaymentForm] Order already created, skipping duplicate creation');
      return;
    }

    const initializePayment = async () => {
      try {
        // Mark order as being created to prevent duplicates
        orderCreatedRef.current = true;
        
        // Create order
        // console.log('[SquarePaymentForm] Creating checkout order with data:', {
        //   customerInfo,
        //   cartItems,
        //   fulfillmentMethod: 'pickup',
        //   shippingAddress,
        //   paymentMethod: 'square'
        // });
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
          checkoutMode,
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
        if (typeof payment?.amount_cents === 'number') {
          setBackendPaymentAmount(payment.amount_cents);
        }
        setIsLoading(false);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize payment';
        setError(errorMessage);
        setIsLoading(false);
      }
    };

    initializePayment();
  }, [customerInfo, shippingAddress, cartItems, amount, checkoutMode]);

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

  // Early return for invalid payment amount (after all hooks)
  if (!paymentValidation.isValid) {
    // console.log('[Square] Amount validation failed:', paymentValidation);
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800 font-medium">Payment Amount Too Low</p>
        <p className="text-red-600 text-sm mt-1">{paymentValidation.message}</p>
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
      backendPaymentAmount={backendPaymentAmount}
    />
  );
}

// Extend Window interface for Square
declare global {
  interface Window {
    Square?: any;
  }
}
