'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  RefreshCw,
  ExternalLink,
  Settings,
  CreditCard
} from 'lucide-react';
import platformRevenueService, {
  PlatformPaymentConfig,
  MerchantStripeConnection,
  RevenueSummary,
} from '@/services/PlatformRevenueService';

export default function PlatformRevenuePage() {
  const [config, setConfig] = useState<PlatformPaymentConfig | null>(null);
  const [merchants, setMerchants] = useState<MerchantStripeConnection[]>([]);
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state for config
  const [formData, setFormData] = useState({
    stripe_platform_public_key: '',
    stripe_platform_secret_key: '',
    stripe_webhook_secret: '',
    stripe_connect_client_id: '',
    stripe_connect_secret: '',
    default_platform_fee_percent: 2.0,
    deposit_forfeit_fee_percent: 20.0,
    subscription_fee_percent: 0,
    platform_payout_schedule: 'monthly' as 'daily' | 'weekly' | 'monthly',
    platform_payout_minimum_cents: 1000,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [configData, merchantsData, summaryData] = await Promise.all([
        platformRevenueService.getPlatformConfig(),
        platformRevenueService.getMerchantConnections(),
        platformRevenueService.getRevenueSummary('30d'),
      ]);

      if (configData) {
        setConfig(configData);
        setFormData({
          stripe_platform_public_key: configData.stripe_platform_public_key || '',
          stripe_platform_secret_key: '',
          stripe_webhook_secret: '',
          stripe_connect_client_id: configData.stripe_connect_client_id || '',
          stripe_connect_secret: '',
          default_platform_fee_percent: configData.default_platform_fee_percent,
          deposit_forfeit_fee_percent: configData.deposit_forfeit_fee_percent,
          subscription_fee_percent: configData.subscription_fee_percent,
          platform_payout_schedule: configData.platform_payout_schedule as 'daily' | 'weekly' | 'monthly',
          platform_payout_minimum_cents: configData.platform_payout_minimum_cents,
        });
      }

      setMerchants(merchantsData);
      setSummary(summaryData);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load platform revenue data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updateData: any = {};
      
      // Only send fields that have values
      if (formData.stripe_platform_public_key) {
        updateData.stripe_platform_public_key = formData.stripe_platform_public_key;
      }
      if (formData.stripe_platform_secret_key) {
        updateData.stripe_platform_secret_key = formData.stripe_platform_secret_key;
      }
      if (formData.stripe_webhook_secret) {
        updateData.stripe_webhook_secret = formData.stripe_webhook_secret;
      }
      if (formData.stripe_connect_client_id) {
        updateData.stripe_connect_client_id = formData.stripe_connect_client_id;
      }
      if (formData.stripe_connect_secret) {
        updateData.stripe_connect_secret = formData.stripe_connect_secret;
      }
      
      updateData.default_platform_fee_percent = formData.default_platform_fee_percent;
      updateData.deposit_forfeit_fee_percent = formData.deposit_forfeit_fee_percent;
      updateData.subscription_fee_percent = formData.subscription_fee_percent;
      updateData.platform_payout_schedule = formData.platform_payout_schedule;
      updateData.platform_payout_minimum_cents = formData.platform_payout_minimum_cents;

      const result = await platformRevenueService.updatePlatformConfig(updateData);
      
      if (result) {
        setConfig(result);
        setSuccess('Configuration saved successfully');
        // Clear sensitive fields
        setFormData(prev => ({
          ...prev,
          stripe_platform_secret_key: '',
          stripe_webhook_secret: '',
          stripe_connect_secret: '',
        }));
      } else {
        setError('Failed to save configuration');
      }
    } catch (err) {
      console.error('Failed to save config:', err);
      setError('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshMerchant = async (tenantId: string) => {
    try {
      await platformRevenueService.refreshMerchantStatus(tenantId);
      loadData();
    } catch (err) {
      console.error('Failed to refresh merchant:', err);
      setError('Failed to refresh merchant status');
    }
  };

  const handleCreateOnboardingLink = async (tenantId: string) => {
    try {
      const result = await platformRevenueService.createMerchantOnboardingLink(tenantId);
      if (result?.onboarding_link) {
        window.open(result.onboarding_link, '_blank');
      }
    } catch (err) {
      console.error('Failed to create onboarding link:', err);
      setError('Failed to create onboarding link');
    }
  };

  const formatCents = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; color: string }> = {
      completed: { variant: 'default', color: 'bg-green-500' },
      enabled: { variant: 'default', color: 'bg-green-500' },
      in_progress: { variant: 'secondary', color: 'bg-yellow-500' },
      pending: { variant: 'outline', color: 'text-yellow-600' },
      restricted: { variant: 'destructive', color: 'bg-orange-500' },
      rejected: { variant: 'destructive', color: 'bg-red-500' },
    };
    
    const config = variants[status] || { variant: 'outline', color: '' };
    
    return (
      <Badge variant={config.variant} className={config.color}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Platform Revenue</h1>
          <p className="text-muted-foreground">
            Configure Stripe Connect and manage platform revenue collection
          </p>
        </div>
        <Button onClick={loadData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="error" title="Error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert variant="success" title="Success">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Revenue Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary ? formatCents(summary.platform_revenue_cents) : '$0.00'}
            </div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transaction Fees</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary ? formatCents(summary.by_type.transaction_fees) : '$0.00'}
            </div>
            <p className="text-xs text-muted-foreground">From order processing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Forfeit Fees</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary ? formatCents(summary.by_type.deposit_forfeits) : '$0.00'}
            </div>
            <p className="text-xs text-muted-foreground">From abandoned deposits</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connected Merchants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {merchants.filter(m => m.onboarding_status === 'completed').length}
            </div>
            <p className="text-xs text-muted-foreground">
              {merchants.filter(m => m.onboarding_status === 'pending' || m.onboarding_status === 'in_progress').length} pending
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config">
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="merchants">
            <Users className="h-4 w-4 mr-2" />
            Merchants
          </TabsTrigger>
          <TabsTrigger value="transactions">
            <CreditCard className="h-4 w-4 mr-2" />
            Transactions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Stripe Connect Configuration</CardTitle>
              <CardDescription>
                Configure your platform's Stripe Connect integration for revenue collection
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Status indicator */}
              <div className="flex items-center gap-2 p-4 rounded-lg bg-muted">
                {config?.is_active ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="font-medium">Stripe Connect is active</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                    <span className="font-medium">Stripe Connect is not configured</span>
                  </>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="public_key">Stripe Publishable Key</Label>
                  <Input
                    id="public_key"
                    placeholder="pk_live_..."
                    value={formData.stripe_platform_public_key}
                    onChange={(e) => setFormData(prev => ({ ...prev, stripe_platform_public_key: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secret_key">Stripe Secret Key</Label>
                  <Input
                    id="secret_key"
                    type="password"
                    placeholder="sk_live_..."
                    value={formData.stripe_platform_secret_key}
                    onChange={(e) => setFormData(prev => ({ ...prev, stripe_platform_secret_key: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">Leave blank to keep existing key</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="webhook_secret">Webhook Secret</Label>
                  <Input
                    id="webhook_secret"
                    type="password"
                    placeholder="whsec_..."
                    value={formData.stripe_webhook_secret}
                    onChange={(e) => setFormData(prev => ({ ...prev, stripe_webhook_secret: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="connect_client_id">Connect Client ID</Label>
                  <Input
                    id="connect_client_id"
                    placeholder="ca_..."
                    value={formData.stripe_connect_client_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, stripe_connect_client_id: e.target.value }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fee Configuration</CardTitle>
              <CardDescription>
                Set platform fees for different revenue sources
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="platform_fee">Default Platform Fee (%)</Label>
                  <Input
                    id="platform_fee"
                    type="number"
                    step="0.1"
                    value={formData.default_platform_fee_percent}
                    onChange={(e) => setFormData(prev => ({ ...prev, default_platform_fee_percent: parseFloat(e.target.value) }))}
                  />
                  <p className="text-xs text-muted-foreground">Applied to all transactions</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="forfeit_fee">Deposit Forfeit Fee (%)</Label>
                  <Input
                    id="forfeit_fee"
                    type="number"
                    step="0.1"
                    value={formData.deposit_forfeit_fee_percent}
                    onChange={(e) => setFormData(prev => ({ ...prev, deposit_forfeit_fee_percent: parseFloat(e.target.value) }))}
                  />
                  <p className="text-xs text-muted-foreground">Platform share of forfeited deposits</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subscription_fee">Subscription Fee (%)</Label>
                  <Input
                    id="subscription_fee"
                    type="number"
                    step="0.1"
                    value={formData.subscription_fee_percent}
                    onChange={(e) => setFormData(prev => ({ ...prev, subscription_fee_percent: parseFloat(e.target.value) }))}
                  />
                  <p className="text-xs text-muted-foreground">Applied to subscription payments</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payout_minimum">Minimum Payout ($)</Label>
                  <Input
                    id="payout_minimum"
                    type="number"
                    step="1"
                    value={formData.platform_payout_minimum_cents / 100}
                    onChange={(e) => setFormData(prev => ({ ...prev, platform_payout_minimum_cents: parseFloat(e.target.value) * 100 }))}
                  />
                  <p className="text-xs text-muted-foreground">Minimum amount for automatic payouts</p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveConfig} disabled={saving}>
                  {saving ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Configuration'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="merchants" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Merchant Stripe Connections</CardTitle>
              <CardDescription>
                Manage merchant onboarding and Stripe Connect accounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left font-medium">Merchant</th>
                      <th className="p-3 text-left font-medium">Status</th>
                      <th className="p-3 text-left font-medium">Payments</th>
                      <th className="p-3 text-left font-medium">Payouts</th>
                      <th className="p-3 text-left font-medium">Fee Override</th>
                      <th className="p-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {merchants.map((merchant) => (
                      <tr key={merchant.id} className="border-b">
                        <td className="p-3">
                          <div>
                            <div className="font-medium">{merchant.tenant_name || merchant.tenant_id}</div>
                            <div className="text-xs text-muted-foreground">{merchant.tenant_email}</div>
                          </div>
                        </td>
                        <td className="p-3">
                          {getStatusBadge(merchant.onboarding_status)}
                        </td>
                        <td className="p-3">
                          {getStatusBadge(merchant.stripe_account_status || 'pending')}
                        </td>
                        <td className="p-3">
                          {merchant.stripe_payouts_enabled ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
            <Clock className="h-4 w-4 text-yellow-500" />
                          )}
                        </td>
                        <td className="p-3">
                          {merchant.platform_fee_override_percent !== null ? (
                            <span>{merchant.platform_fee_override_percent}%</span>
                          ) : (
                            <span className="text-muted-foreground">Default</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-2">
                            {merchant.onboarding_status !== 'completed' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCreateOnboardingLink(merchant.tenant_id)}
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Onboard
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRefreshMerchant(merchant.tenant_id)}
                            >
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {merchants.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                          No merchant connections found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Transactions</CardTitle>
              <CardDescription>
                View all platform revenue transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Transaction history will be displayed here once revenue collection is active.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
