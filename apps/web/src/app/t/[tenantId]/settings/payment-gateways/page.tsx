'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import { CreditCard, Lock, AlertCircle, CheckCircle, Trash2, ShoppingBag, Package } from 'lucide-react';
import { api } from '@/lib/api';
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

  useEffect(() => {
    if (hasAccess && tenantId) {
      loadGateways();
      loadOAuthStatus();
    }
  }, [hasAccess, tenantId]);

  useEffect(() => {
    // Check for OAuth callback messages
    const connected = searchParams?.get('connected');
    const success = searchParams?.get('success');
    const errorParam = searchParams?.get('error');
    const message = searchParams?.get('message');

    if (connected && success === 'true') {
      const gatewayName = connected === 'paypal' ? 'PayPal' : 'Square';
      setOauthSuccess(`${gatewayName} connected successfully!`);
      // Reload OAuth status after successful connection
      loadOAuthStatus();
      loadGateways();
    } else if (errorParam) {
      const decodedMessage = message ? decodeURIComponent(message) : 'OAuth connection failed';
      setOauthError(decodedMessage);
    }
  }, [searchParams]);

  const loadOAuthStatus = async () => {
    try {
      // Load PayPal OAuth status
      const paypalResponse = await api.get(`/api/oauth/paypal/status?tenantId=${tenantId}`);
      if (paypalResponse.ok) {
        const paypalData = await paypalResponse.json();
        setOauthStatus(prev => ({ ...prev, paypal: paypalData }));
      }

      // Load Square OAuth status
      const squareResponse = await api.get(`/api/oauth/square/status?tenantId=${tenantId}`);
      if (squareResponse.ok) {
        const squareData = await squareResponse.json();
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
      const response = await api.get(`/api/tenants/${tenantId}/payment-gateways`);
      if (!response.ok) throw new Error('Failed to load payment gateways');
      const data = await response.json();
      setGateways(data.gateways || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditPayPal = (gateway: PaymentGateway) => {
    setEditingPayPalId(gateway.id);
    setPaypalForm({
      mode: gateway.config.mode || 'sandbox',
      client_id: gateway.config.client_id || '',
      client_secret: gateway.config.client_secret || '',
      display_name: gateway.config.display_name || '',
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
      
      const response = await api[method](url, {
        gateway_type: 'paypal',
        mode: paypalForm.mode,
        client_id: paypalForm.client_id,
        client_secret: paypalForm.client_secret,
        display_name: paypalForm.display_name,
        is_active: paypalForm.is_active,
        is_default: paypalForm.is_default,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save PayPal configuration');
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
      environment: gateway.config.environment || 'sandbox',
      application_id: gateway.config.application_id || '',
      access_token: gateway.config.access_token || '',
      location_id: gateway.config.location_id || '',
      display_name: gateway.config.display_name || '',
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
      
      const response = await api[method](url, {
        gateway_type: 'square',
        environment: squareForm.environment,
        application_id: squareForm.application_id,
        access_token: squareForm.access_token,
        location_id: squareForm.location_id,
        display_name: squareForm.display_name,
        is_active: squareForm.is_active,
        is_default: squareForm.is_default,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save Square configuration');
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

  const handleToggleActive = async (gatewayId: string, currentStatus: boolean) => {
    try {
      const response = await api.patch(`/api/tenants/${tenantId}/payment-gateways/${gatewayId}`, {
        is_active: !currentStatus,
      });
      if (!response.ok) throw new Error('Failed to update gateway status');
      await loadGateways();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSetDefault = async (gatewayId: string) => {
    try {
      const response = await api.post(`/api/tenants/${tenantId}/payment-gateways/${gatewayId}/set-default`);
      if (!response.ok) throw new Error('Failed to set default gateway');
      await loadGateways();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (gatewayId: string) => {
    if (!confirm('Are you sure you want to delete this payment gateway?')) return;
    try {
      const response = await api.delete(`/api/tenants/${tenantId}/payment-gateways/${gatewayId}`);
      if (!response.ok) throw new Error('Failed to delete gateway');
      await loadGateways();
    } catch (err: any) {
      setError(err.message);
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

      {loading ? (
        <div className="h-64 bg-neutral-200 rounded animate-pulse"></div>
      ) : (
        <div className="space-y-6">
        {/* PayPal Gateways */}
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
            {paypalGateways.length > 0 && (
              <Button onClick={() => setShowPayPalForm(true)} size="sm">
                Add Another PayPal Account
              </Button>
            )}
          </div>
          
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
                    onChange={(e) => setPaypalForm({...paypalForm, display_name: e.target.value})}
                    placeholder="e.g., Main Store, Wholesale, etc."
                  />
                  <p className="text-xs text-neutral-500 mt-1">Helps identify this account if you have multiple</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Mode</label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg"
                    value={paypalForm.mode}
                    onChange={(e) => setPaypalForm({...paypalForm, mode: e.target.value as 'sandbox' | 'live'})}
                  >
                    <option value="sandbox">Sandbox (Testing)</option>
                    <option value="live">Live (Production)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Client ID</label>
                  <Input
                    value={paypalForm.client_id}
                    onChange={(e) => setPaypalForm({...paypalForm, client_id: e.target.value})}
                    placeholder="Enter PayPal Client ID"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Client Secret</label>
                  <Input
                    type="password"
                    value={paypalForm.client_secret}
                    onChange={(e) => setPaypalForm({...paypalForm, client_secret: e.target.value})}
                    placeholder="Enter PayPal Client Secret"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={paypalForm.is_active}
                    onChange={(e) => setPaypalForm({...paypalForm, is_active: e.target.checked})}
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
          ) : paypalGateways.length > 0 ? (
            <div className="space-y-4">
              {paypalGateways.map((gateway) => (
                <Card key={gateway.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{gateway.config.display_name || 'PayPal Account'}</CardTitle>
                        <p className="text-sm text-neutral-600">Mode: {gateway.config.mode}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {gateway.is_default && (
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                            Default
                          </span>
                        )}
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          gateway.is_active ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-600'
                        }`}>
                          {gateway.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-neutral-600">Client ID</p>
                          <p className="font-mono text-xs">{gateway.config.client_id?.substring(0, 20)}...</p>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-4 border-t">
                        <Button variant="outline" size="sm" onClick={() => handleEditPayPal(gateway)}>
                          Edit
                        </Button>
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
                <Button onClick={() => setShowPayPalForm(true)}>
                  Add PayPal Account
                </Button>
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

        {/* Square Gateways */}
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
            {squareGateways.length > 0 && (
              <Button onClick={() => setShowSquareForm(true)} size="sm">
                Add Another Square Account
              </Button>
            )}
          </div>
          
          {squareGateways.length > 0 ? (
            <div className="space-y-4">
              {squareGateways.map((gateway) => (
                <Card key={gateway.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{gateway.config.display_name || 'Square Account'}</CardTitle>
                        <p className="text-sm text-neutral-600">Environment: {gateway.config.environment}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {gateway.is_default && (
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                            Default
                          </span>
                        )}
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          gateway.is_active ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-600'
                        }`}>
                          {gateway.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-neutral-600">Application ID</p>
                          <p className="font-mono text-xs">{gateway.config.application_id?.substring(0, 20)}...</p>
                        </div>
                        <div>
                          <p className="text-neutral-600">Location ID</p>
                          <p className="font-mono text-xs">{gateway.config.location_id?.substring(0, 20)}...</p>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-4 border-t">
                        <Button variant="outline" size="sm" onClick={() => handleEditSquare(gateway)}>
                          Edit
                        </Button>
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
                      onChange={(e) => setSquareForm({...squareForm, display_name: e.target.value})}
                      placeholder="e.g., Main Store, Retail Location, etc."
                    />
                    <p className="text-xs text-neutral-500 mt-1">Helps identify this account if you have multiple</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Environment</label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg"
                    value={squareForm.environment}
                    onChange={(e) => setSquareForm({...squareForm, environment: e.target.value as 'sandbox' | 'production'})}
                  >
                    <option value="sandbox">Sandbox (Testing)</option>
                    <option value="production">Production (Live)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Application ID</label>
                  <Input
                    value={squareForm.application_id}
                    onChange={(e) => setSquareForm({...squareForm, application_id: e.target.value})}
                    placeholder="Enter Square Application ID"
                  />
                  <p className="text-xs text-neutral-500 mt-1">From Square Developer Dashboard</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Access Token</label>
                  <Input
                    type="password"
                    value={squareForm.access_token}
                    onChange={(e) => setSquareForm({...squareForm, access_token: e.target.value})}
                    placeholder="Enter Square Access Token"
                  />
                  <p className="text-xs text-neutral-500 mt-1">Keep this secure - never share publicly</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Location ID</label>
                  <Input
                    value={squareForm.location_id}
                    onChange={(e) => setSquareForm({...squareForm, location_id: e.target.value})}
                    placeholder="Enter Square Location ID"
                  />
                  <p className="text-xs text-neutral-500 mt-1">The location where payments will be processed</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="square_is_active"
                    checked={squareForm.is_active}
                    onChange={(e) => setSquareForm({...squareForm, is_active: e.target.checked})}
                  />
                  <label htmlFor="square_is_active" className="text-sm">Activate immediately</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="square_is_default"
                    checked={squareForm.is_default}
                    onChange={(e) => setSquareForm({...squareForm, is_default: e.target.checked})}
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
                <Button onClick={() => setShowSquareForm(true)}>
                  Add Square Account
                </Button>
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
        </div>
        </div>
      )}
    </div>
  );
}
