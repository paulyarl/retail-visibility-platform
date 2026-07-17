'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { customerAuthService } from '@/services/CustomerAuthService';
import { customerPaymentMethodsService } from '@/services/CustomerPaymentMethodsService';
import { CreditCard, CheckCircle, Loader2 } from 'lucide-react';
import { clientLogger } from '@/lib/client-logger';

interface GuestSavePaymentMethodPromptProps {
  customerInfo: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
  } | null;
  tenantId: string;
  paymentMethod: 'stripe' | 'square' | 'paypal';
  pendingToken: string | null;
  onSaved: () => void;
  onSkip: () => void;
}

export function GuestSavePaymentMethodPrompt({
  customerInfo,
  tenantId,
  paymentMethod,
  pendingToken,
  onSaved,
  onSkip,
}: GuestSavePaymentMethodPromptProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  const handleCreateAccount = async () => {
    setError(null);

    if (!customerInfo?.email) {
      setError('Email is required to create an account');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsCreating(true);

    try {
      const result = await customerAuthService.register(
        customerInfo.email,
        password,
        customerInfo.firstName,
        customerInfo.lastName
      );

      if (!result.success) {
        setError(result.error || 'Failed to create account');
        setIsCreating(false);
        return;
      }

      // Account created and logged in — now save the payment method
      if (pendingToken) {
        try {
          await customerPaymentMethodsService.addPaymentMethod({
            tenantId,
            gatewayType: paymentMethod,
            paymentMethodToken: pendingToken,
            type: paymentMethod === 'paypal' ? 'paypal' : 'card',
          });
        } catch (err) {
          clientLogger.error('[GuestSavePrompt] Failed to save payment method:', { detail: err });
        }
      }

      setCreated(true);
      setTimeout(onSaved, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setIsCreating(false);
    }
  };

  if (created) {
    return (
      <div className="text-center space-y-3 py-4">
        <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
        <p className="text-green-700 font-medium">Account created and payment method saved!</p>
        <p className="text-sm text-gray-500">Redirecting to your orders...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={customerInfo?.email || ''}
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">From your checkout details</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password (min 8 characters)</label>
          <input
            type="password"
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          onClick={onSkip}
          className="flex-1"
        >
          Skip
        </Button>
        <Button
          onClick={handleCreateAccount}
          disabled={isCreating}
          className="flex-1"
        >
          {isCreating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4 mr-2" />
              Create & Save
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
