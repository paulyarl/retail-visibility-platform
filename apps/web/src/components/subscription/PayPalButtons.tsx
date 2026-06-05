'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button, Alert, Loader, Group, Text } from '@mantine/core';
import { IconBrandPaypal } from '@tabler/icons-react';

// PayPal SDK types
declare global {
  interface Window {
    paypal?: {
      Buttons: (config: PayPalButtonsConfig) => {
        render: (container: string) => void;
      };
    };
  }
}

interface PayPalButtonsConfig {
  createOrder: () => Promise<string>;
  onApprove: (data: { orderID: string }) => Promise<void>;
  onError?: (err: any) => void;
  onCancel?: () => void;
  style?: {
    layout?: string;
    color?: string;
    shape?: string;
    label?: string;
    height?: number;
  };
}

interface PayPalButtonProps {
  tier: string;
  billingCycle: 'monthly' | 'annual';
  amount: number;
  tenantId: string;
  onSuccess: (result: { tier: string; invoiceId: string }) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}

export function PayPalSmartButtons({
  tier,
  billingCycle,
  amount,
  tenantId,
  onSuccess,
  onError,
  disabled = false,
}: PayPalButtonProps) {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paypalReady, setPaypalReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load PayPal SDK
  useEffect(() => {
    const loadPayPalSDK = async () => {
      // Check if PayPal is configured on the backend using service
      try {
        const { subscriptionBillingService } = await import('@/services/SubscriptionBillingService');
        const data = await subscriptionBillingService.getPayPalConfig();
        
        if (!data.configured) {
          setError('PayPal is not configured');
          setLoading(false);
          return;
        }
      } catch (err) {
        setError('Failed to check PayPal configuration');
        setLoading(false);
        return;
      }

      // Check if SDK already loaded
      if (window.paypal) {
        setPaypalReady(true);
        setLoading(false);
        return;
      }

      // Load PayPal SDK script with error handling
      const script = document.createElement('script');
      const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
      const mode = process.env.NEXT_PUBLIC_PAYPAL_MODE || 'sandbox';
      
      script.src = `https://www.${mode === 'live' ? '' : 'sandbox.'}paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=capture`;
      script.async = true;
      script.crossOrigin = 'anonymous';
      
      // Add global error handlers for PayPal SDK
      const originalErrorHandler = window.onerror;
      window.onerror = (message, source, lineno, colno, error) => {
        // Filter out PayPal SDK errors that are expected
        if (message && typeof message === 'string' && 
            (message.includes('paypal_js_sdk_v5_unhandled_exception') || 
             message.includes('zoid'))) {
          console.warn('[PayPal] Expected SDK error filtered:', message);
          return true; // Prevent default error handling
        }
        // Call original error handler for other errors
        if (originalErrorHandler) {
          return originalErrorHandler(message, source, lineno, colno, error);
        }
        return false;
      };
      
      script.onload = () => {
        setPaypalReady(true);
        setLoading(false);
        
        // Restore original error handler after SDK loads
        window.onerror = originalErrorHandler;
      };
      
      script.onerror = () => {
        setError('Failed to load PayPal SDK');
        setLoading(false);
        
        // Restore original error handler on load failure
        window.onerror = originalErrorHandler;
      };

      document.body.appendChild(script);
    };

    loadPayPalSDK();
    
    // Cleanup function to restore error handler
    return () => {
      const originalErrorHandler = window.onerror;
      window.onerror = (message, source, lineno, colno, error) => {
        if (message && typeof message === 'string' && 
            (message.includes('paypal_js_sdk_v5_unhandled_exception') || 
             message.includes('zoid'))) {
          return true;
        }
        if (originalErrorHandler) {
          return originalErrorHandler(message, source, lineno, colno, error);
        }
        return false;
      };
    };
  }, []);

  // Create PayPal order for subscription payment
  const createOrder = useCallback(async (): Promise<string> => {
    try {
      const { subscriptionBillingService } = await import('@/services/SubscriptionBillingService');
      
      // Create a payment order for the subscription
      const result = await subscriptionBillingService.createPayPalOrder(tier, billingCycle);
      
      // Handle free tier
      if ('freeTier' in result && result.freeTier) {
        throw new Error('free_tier');
      }
      
      const orderResult = result as { orderId: string; approvalUrl: string };
      if (!orderResult.orderId) {
        throw new Error('No order ID returned');
      }
      
      return orderResult.orderId;
    } catch (error: any) {
      console.error('[PayPalButtons] Error creating order:', error);
      throw error;
    }
  }, [tier, billingCycle]);

  // Handle PayPal approval
  const onApprove = useCallback(async (data: { orderID: string }) => {
    setProcessing(true);
    try {
      const { subscriptionBillingService } = await import('@/services/SubscriptionBillingService');
      
      const result = await subscriptionBillingService.capturePayPalOrder(
        data.orderID,
        tier,
        billingCycle
      );

      onSuccess({
        tier: result.tier,
        invoiceId: result.invoiceId,
      });
    } catch (err: any) {
      onError(err.message || 'PayPal payment failed');
    } finally {
      setProcessing(false);
    }
  }, [tier, billingCycle, onSuccess, onError]);

  // Render PayPal buttons when ready
  useEffect(() => {
    if (!paypalReady || !window.paypal || disabled) return;

    // Clear any existing buttons safely
    const container = document.getElementById('paypal-button-container');
    if (container) {
      try {
        container.innerHTML = '';
      } catch (err) {
        console.warn('[PayPal] Error clearing container:', err);
      }
    }

    let buttonInstance: any = null;

    try {
      // Create button instance with enhanced error handling
      buttonInstance = window.paypal.Buttons({
        createOrder: async () => {
          setProcessing(true);
          try {
            const orderId = await createOrder();
            return orderId;
          } catch (err: any) {
            setProcessing(false);
            if (err.message !== 'free_tier') {
              onError(err.message);
            }
            throw err;
          }
        },
        onApprove: async (data) => {
          try {
            await onApprove(data);
          } catch (err: any) {
            setProcessing(false);
            onError(err.message || 'PayPal approval failed');
          }
        },
        onError: (err) => {
          setProcessing(false);
          console.warn('[PayPal] SDK error:', err);
          onError('PayPal encountered an error');
        },
        onCancel: () => {
          setProcessing(false);
          onError('PayPal payment was cancelled');
        },
        style: {
          layout: 'vertical',
          color: 'blue',
          shape: 'rect',
          label: 'paypal',
          height: 45,
        },
      });

      // Render buttons with error handling
      if (buttonInstance.isEligible()) {
        buttonInstance.render('#paypal-button-container').catch((err: any) => {
          console.error('[PayPal] Failed to render buttons:', err);
          setError('Failed to render PayPal buttons');
        });
      } else {
        console.warn('[PayPal] Buttons not eligible for rendering');
        setError('PayPal is not available in your browser');
      }
    } catch (err) {
      console.error('[PayPal] Failed to create buttons:', err);
      setError('Failed to initialize PayPal buttons');
    }

    // Enhanced cleanup function
    return () => {
      try {
        if (buttonInstance && typeof buttonInstance.close === 'function') {
          buttonInstance.close().catch(() => {});
        }
      } catch (err) {
        console.warn('[PayPal] Error during cleanup:', err);
      }
    };
  }, [paypalReady, disabled, createOrder, onApprove, onError]);

  if (loading) {
    return (
      <Group justify="center" py="md">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">Loading PayPal...</Text>
      </Group>
    );
  }

  if (error) {
    return (
      <Alert color="yellow" icon={<IconBrandPaypal size="1rem" />}>
        <Text size="sm">{error}</Text>
      </Alert>
    );
  }

  return (
    <div>
      {processing && (
        <Group justify="center" py="sm">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">Processing payment...</Text>
        </Group>
      )}
      <div id="paypal-button-container" style={{ opacity: processing || disabled ? 0.5 : 1 }} />
    </div>
  );
}

// PayPal Save Payment Method Button
interface SavePayPalProps {
  tenantId: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export function SavePayPalButton({ tenantId, onSuccess, onError }: SavePayPalProps) {
  const [loading, setLoading] = useState(false);

  const handleSavePayPal = async () => {
    setLoading(true);
    try {
      // Create billing agreement using service
      const { subscriptionBillingService } = await import('@/services/SubscriptionBillingService');
      const data = await subscriptionBillingService.createPayPalBillingAgreement();

      // Redirect to PayPal for approval
      window.location.href = data.approvalUrl;
    } catch (err: any) {
      onError(err.message);
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      leftSection={<IconBrandPaypal size="1rem" />}
      onClick={handleSavePayPal}
      loading={loading}
      fullWidth
    >
      Add PayPal Account
    </Button>
  );
}

export default PayPalSmartButtons;
