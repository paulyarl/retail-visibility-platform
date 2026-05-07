'use client';

import { useState, useEffect } from 'react';
import PageHeader, { Icons } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';
import { Loader2, Save, DollarSign, Settings, CreditCard } from 'lucide-react';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';
import { adminSettingsService } from '@/services/AdminSettingsService';

interface PlatformPaymentSettings {
  minimumPaymentAmount: {
    amount: number; // in cents
    currency: string;
    displayAmount: string; // formatted for display
  };
}

export default function PaymentSettingsPage() {
  const {
    hasAccess,
    loading: accessLoading,
  } = useAccessControl(
    null, // No tenant context needed
    AccessPresets.PLATFORM_ADMIN_ONLY
  );

  const { settings: platformSettings, refetch } = usePlatformSettings();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [paymentSettings, setPaymentSettings] = useState<PlatformPaymentSettings>({
    minimumPaymentAmount: {
      amount: 200, // $2.00 in cents
      currency: 'USD',
      displayAmount: '$2.00',
    }
  });

  useEffect(() => {
    if (platformSettings?.minimumPaymentAmount) {
      setPaymentSettings({
        minimumPaymentAmount: platformSettings.minimumPaymentAmount
      });
    }
  }, [platformSettings]);

  const handleAmountChange = (value: string) => {
    const amountInCents = Math.round(parseFloat(value) * 100);
    if (!isNaN(amountInCents) && amountInCents >= 0) {
      setPaymentSettings(prev => ({
        minimumPaymentAmount: {
          ...prev.minimumPaymentAmount,
          amount: amountInCents,
          displayAmount: new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
          }).format(amountInCents / 100)
        }
      }));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await adminSettingsService.updatePaymentSettings({
        minimumPaymentAmount: paymentSettings.minimumPaymentAmount
      });

      if (!result) {
        throw new Error('Failed to update payment settings');
      }

      setSuccess('Payment settings updated successfully!');
      await refetch(); // Refresh platform settings
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (accessLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!hasAccess) {
    return <AccessDenied />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="Payment Settings"
        description="Manage platform-wide payment configuration and minimum amounts"
        icon={Icons.Settings}
      />

      {success && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <p className="text-green-800">{success}</p>
        </Alert>
      )}

      {error && (
        <Alert className="mb-6 bg-red-50 border-red-200">
          <p className="text-red-800">{error}</p>
        </Alert>
      )}

      <div className="space-y-6">
        {/* Payment Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              Minimum Payment Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="minimumAmount" className="text-sm font-medium text-gray-700">
                Minimum Payment Amount
              </Label>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  id="minimumAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentSettings.minimumPaymentAmount.amount / 100}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="w-32"
                  placeholder="2.00"
                />
                <span className="text-sm text-gray-500">USD</span>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                This is the minimum amount required for all credit card payments across the platform.
                Current setting: {paymentSettings.minimumPaymentAmount.displayAmount}
              </p>
            </div>

            <div className="pt-4">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" style={{ color: "white" }}/>
                    Save Payment Settings
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Impact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Payment Gateway Impact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm text-gray-600">
              <div>
                <strong>Affected Gateways:</strong> Stripe, Square, PayPal
              </div>
              <div>
                <strong>Recommended Amount:</strong> $2.00 or higher to cover processing fees
              </div>
              <div>
                <strong>User Experience:</strong> Users will see an error message if their cart total is below this minimum
              </div>
              <div>
                <strong>Currency:</strong> Currently configured for USD only
              </div>
              <div>
                <strong>Validation:</strong> Applied consistently across all payment forms
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Technical Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Technical Implementation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm text-gray-600">
              <div>
                <strong>Storage:</strong> Settings are stored in the platform_settings table
              </div>
              <div>
                <strong>Validation:</strong> Client-side validation prevents form submission below minimum
              </div>
              <div>
                <strong>Error Handling:</strong> User-friendly error messages guide users to add more items
              </div>
              <div>
                <strong>Performance:</strong> Settings are cached and loaded once per session
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
