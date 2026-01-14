/**
 * Payment Gateway Selector Component
 * Allows selecting gateway type (Square/PayPal) and specific account for products
 */

'use client';

import { useState, useEffect } from 'react';
import { CreditCard, AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/Label';

interface Gateway {
  id: string;
  gateway_type: string;
  is_active: boolean;
  is_default: boolean;
  config: {
    display_name?: string;
    mode?: string;
    environment?: string;
  };
}

interface PaymentGatewaySelectorProps {
  tenantId: string;
  value?: {
    gateway_type?: string | null;
    gateway_id?: string | null;
  };
  onChange: (value: { gateway_type: string | null; gateway_id: string | null }) => void;
  disabled?: boolean;
}

export default function PaymentGatewaySelector({
  tenantId,
  value = {},
  onChange,
  disabled = false
}: PaymentGatewaySelectorProps) {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<'default' | 'square' | 'paypal'>(
    value.gateway_type ? (value.gateway_type as 'square' | 'paypal') : 'default'
  );
  const [selectedGatewayId, setSelectedGatewayId] = useState<string | null>(
    value.gateway_id || null
  );

  // Load gateways
  useEffect(() => {
    const loadGateways = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/tenants/${tenantId}/payment-gateways`);
        
        if (!response.ok) {
          throw new Error('Failed to load payment gateways');
        }

        const data = await response.json();
        const activeGateways = (data.gateways || []).filter((g: Gateway) => g.is_active);
        setGateways(activeGateways);
      } catch (err: any) {
        console.error('[PaymentGatewaySelector] Load error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadGateways();
  }, [tenantId]);

  // Group gateways by type
  const squareGateways = gateways.filter(g => g.gateway_type === 'square');
  const paypalGateways = gateways.filter(g => g.gateway_type === 'paypal');
  const defaultGateway = gateways.find(g => g.is_default);

  // Handle selection change
  const handleSelectionChange = (newSelection: 'default' | 'square' | 'paypal') => {
    setSelection(newSelection);

    if (newSelection === 'default') {
      onChange({ gateway_type: null, gateway_id: null });
      setSelectedGatewayId(null);
    } else {
      // Auto-select first gateway of that type
      const gatewaysOfType = newSelection === 'square' ? squareGateways : paypalGateways;
      const firstGateway = gatewaysOfType[0];
      
      if (firstGateway) {
        setSelectedGatewayId(firstGateway.id);
        onChange({ gateway_type: newSelection, gateway_id: firstGateway.id });
      }
    }
  };

  // Handle gateway ID change
  const handleGatewayIdChange = (gatewayId: string) => {
    setSelectedGatewayId(gatewayId);
    onChange({ gateway_type: selection, gateway_id: gatewayId });
  };

  const getGatewayDisplayName = (gateway: Gateway) => {
    const displayName = gateway.config.display_name;
    const mode = gateway.config.mode || gateway.config.environment;
    const isDefault = gateway.is_default ? ' (Default)' : '';
    
    if (displayName) {
      return `${displayName}${isDefault}`;
    }
    
    return `${gateway.gateway_type.charAt(0).toUpperCase() + gateway.gateway_type.slice(1)} - ${mode}${isDefault}`;
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <Label>Payment Gateway</Label>
        <div className="p-4 border rounded-lg bg-gray-50">
          <p className="text-sm text-gray-600">Loading payment gateways...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <Label>Payment Gateway</Label>
        <div className="p-4 border border-red-200 rounded-lg bg-red-50 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">Failed to load gateways</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (gateways.length === 0) {
    return (
      <div className="space-y-2">
        <Label>Payment Gateway</Label>
        <div className="p-4 border border-yellow-200 rounded-lg bg-yellow-50 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-900">No payment gateways configured</p>
            <p className="text-sm text-yellow-700">
              Configure payment gateways in settings before assigning them to products.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Payment Gateway (Optional)</Label>
        <p className="text-sm text-gray-600 mt-1">
          Choose which payment gateway to use for this product
        </p>
      </div>

      <div className="space-y-3">
        {/* Default Option */}
        <label className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
          <input
            type="radio"
            name="gateway-selection"
            value="default"
            checked={selection === 'default'}
            onChange={() => handleSelectionChange('default')}
            disabled={disabled}
            className="mt-1"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-gray-600" />
              <span className="font-medium text-gray-900">Use Default Gateway</span>
            </div>
            {defaultGateway && (
              <p className="text-sm text-gray-600 mt-1">
                Currently: {getGatewayDisplayName(defaultGateway)}
              </p>
            )}
          </div>
        </label>

        {/* Square Option */}
        {squareGateways.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <label className="flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="gateway-selection"
                value="square"
                checked={selection === 'square'}
                onChange={() => handleSelectionChange('square')}
                disabled={disabled}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-black rounded flex items-center justify-center">
                    <CreditCard className="w-3 h-3 text-white" />
                  </div>
                  <span className="font-medium text-gray-900">Use Specific Square Account</span>
                </div>
              </div>
            </label>

            {selection === 'square' && (
              <div className="px-4 pb-4 bg-gray-50 border-t">
                <select
                  value={selectedGatewayId || ''}
                  onChange={(e) => handleGatewayIdChange(e.target.value)}
                  disabled={disabled}
                  className="mt-3 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {squareGateways.map((gateway) => (
                    <option key={gateway.id} value={gateway.id}>
                      {getGatewayDisplayName(gateway)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* PayPal Option */}
        {paypalGateways.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <label className="flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="radio"
                name="gateway-selection"
                value="paypal"
                checked={selection === 'paypal'}
                onChange={() => handleSelectionChange('paypal')}
                disabled={disabled}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
                    <CreditCard className="w-3 h-3 text-white" />
                  </div>
                  <span className="font-medium text-gray-900">Use Specific PayPal Account</span>
                </div>
              </div>
            </label>

            {selection === 'paypal' && (
              <div className="px-4 pb-4 bg-gray-50 border-t">
                <select
                  value={selectedGatewayId || ''}
                  onChange={(e) => handleGatewayIdChange(e.target.value)}
                  disabled={disabled}
                  className="mt-3 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {paypalGateways.map((gateway) => (
                    <option key={gateway.id} value={gateway.id}>
                      {getGatewayDisplayName(gateway)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info Message */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          💡 <strong>Tip:</strong> Leave as default unless this product requires a specific payment account 
          (e.g., wholesale items use a different Square account).
        </p>
      </div>
    </div>
  );
}
