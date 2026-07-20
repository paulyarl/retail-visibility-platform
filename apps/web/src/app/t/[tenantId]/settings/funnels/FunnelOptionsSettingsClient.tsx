'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Badge } from '@/components/ui/Badge';
import { AlertCircle, Save, Filter, Zap, TrendingUp, ArrowDownCircle, Sparkles, Tag, List, Plus, Settings, ArrowRight, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { useFunnelCapability, useAllCapabilities } from '@/hooks/tenant-access/useCapabilityAccess';
import FunnelService, { type FunnelOptionsSettings, type FunnelStepType } from '@/services/FunnelService';
import PlanSummaryWidget from '@/components/dashboard/PlanSummaryWidget';
import { clientLogger } from '@/lib/client-logger';
import { toast } from '@/hooks/use-toast';

interface FunnelOptionsSettingsClientProps {
  tenantId: string;
}

interface QuickAction {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: 'general' | 'product';
}

const STEP_OPTIONS: { type: FunnelStepType; label: string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'order_bump', label: 'Order Bump', description: 'Offer a complementary item at checkout', icon: Zap },
  { type: 'upsell', label: 'Upsell', description: 'Suggest a premium upgrade after purchase', icon: TrendingUp },
  { type: 'downsell', label: 'Downsell', description: 'Offer a lower-cost alternative if the upsell is declined', icon: ArrowDownCircle },
  { type: 'oto', label: 'One-Time Offer', description: 'Present an exclusive limited-time offer', icon: Sparkles },
  { type: 'coupon_offer', label: 'Coupon Offer', description: 'Provide a discount code for a future purchase', icon: Tag },
];

const STEP_KEY: Record<FunnelStepType, keyof FunnelOptionsSettings> = {
  order_bump: 'order_bump_enabled',
  upsell: 'upsell_enabled',
  downsell: 'downsell_enabled',
  oto: 'oto_enabled',
  coupon_offer: 'coupon_offer_enabled',
};

function getQuickActions(settings: FunnelOptionsSettings, tenantId: string, allowedSteps: FunnelStepType[]): QuickAction[] {
  const actions: QuickAction[] = [];

  if (!settings.funnel_options_enabled || allowedSteps.length === 0) return actions;

  actions.push({
    id: 'manage-funnels',
    label: 'Manage Funnels',
    description: 'View and edit your sales funnels',
    href: `/t/${tenantId}/settings/funnels/list`,
    icon: List,
    variant: 'general',
  });

  actions.push({
    id: 'create-funnel',
    label: 'Create Funnel',
    description: 'Build a new order bump, upsell, or downsell flow',
    href: `/t/${tenantId}/settings/funnels/list`,
    icon: Plus,
    variant: 'product',
  });

  return actions;
}

export default function FunnelOptionsSettingsClient({ tenantId }: FunnelOptionsSettingsClientProps) {
  const funnelCap = useFunnelCapability(tenantId);
  const allCaps = useAllCapabilities(tenantId);
  const capState = funnelCap.data;
  const isTierAllowed = !!capState && (capState.enabled || capState.isFlexible || (capState.allowedSteps?.length ?? 0) > 0);
  const allowedSteps = capState?.allowedSteps ?? [];

  const [settings, setSettings] = useState<FunnelOptionsSettings>({
    funnel_options_enabled: true,
    order_bump_enabled: true,
    upsell_enabled: true,
    downsell_enabled: true,
    oto_enabled: true,
    coupon_offer_enabled: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, [tenantId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await FunnelService.getFunnelOptionsSettings(tenantId);
      setSettings(data);
    } catch (err) {
      clientLogger.error('Failed to load funnel options settings:', { detail: err });
      toast({ title: 'Error', description: 'Failed to load funnel options', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      await FunnelService.updateFunnelOptionsSettings(tenantId, settings);
      toast({ title: 'Saved', description: 'Funnel options settings have been updated', variant: 'success' });
      setMessage({ type: 'success', text: 'Funnel options settings saved successfully.' });
    } catch (err: any) {
      clientLogger.error('Failed to save funnel options settings:', { detail: err });
      setMessage({ type: 'error', text: err?.message || 'Failed to save funnel options settings' });
      toast({ title: 'Error', description: err?.message || 'Failed to save funnel options settings', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (key: keyof FunnelOptionsSettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 bg-neutral-200 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PlanSummaryWidget capabilities={allCaps.data} loading={allCaps.loading} tenantId={tenantId} />

      {message && (
        <div className={`p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {/* Master Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary-600" />
            Funnel Capability
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">
            Enable or disable sales funnels for this tenant.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center gap-3">
              <Filter className="h-5 w-5 text-primary-600" />
              <div>
                <p className="font-medium text-neutral-900">Enable Funnels</p>
                <p className="text-sm text-neutral-600">Allow order bumps, upsells, downsells, and one-time offers</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!isTierAllowed && (
                <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
              )}
              {isTierAllowed && !settings.funnel_options_enabled && (
                <span className="text-xs text-amber-600 font-medium">Disabled by you</span>
              )}
              <Switch
                id="funnel-options-enabled-toggle"
                checked={isTierAllowed ? settings.funnel_options_enabled : false}
                onCheckedChange={() => handleToggle('funnel_options_enabled')}
                disabled={!isTierAllowed}
              />
            </div>
          </div>

          {!isTierAllowed && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800">
                Sales funnels are not included in your current plan. Upgrade to enable funnel builder.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary-600" />
            Allowed Funnel Steps
          </CardTitle>
          <p className="text-sm text-neutral-600 mt-1">
            {allowedSteps.length > 1
              ? 'Your plan supports multiple funnel step types. Toggle the ones you want to offer.'
              : 'Your current plan determines your funnel step types. Upgrade to access more steps.'}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {STEP_OPTIONS.map(({ type, label, description, icon: IconComp }) => {
              const isAllowed = allowedSteps.includes(type);
              const stepKey = STEP_KEY[type];
              const isSelected = !!settings[stepKey];
              const canSelect = settings.funnel_options_enabled && isAllowed;

              return (
                <div
                  key={type}
                  onClick={() => canSelect && handleToggle(stepKey)}
                  className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${isSelected && canSelect
                    ? 'bg-primary-50 border-primary-300 ring-1 ring-primary-300'
                    : 'bg-gray-50 border-gray-200'
                  } ${canSelect ? 'cursor-pointer hover:border-gray-300' : 'opacity-60 cursor-not-allowed'}`}
                >
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full ${isSelected && canSelect ? 'bg-primary-100' : 'bg-gray-200'}`}>
                    <IconComp className={`h-5 w-5 ${isSelected && canSelect ? 'text-primary-600' : 'text-neutral-500'}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium ${isSelected && canSelect ? 'text-primary-700' : 'text-neutral-900'}`}>
                        {label}
                      </p>
                      {isAllowed && allowedSteps.length === 1 && allowedSteps[0] === type && (
                        <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">Current</span>
                      )}
                      {!isAllowed && (
                        <span className="text-xs text-amber-600 font-medium">Not included in your plan</span>
                      )}
                      {isAllowed && !isSelected && settings.funnel_options_enabled && (
                        <span className="text-xs text-amber-600 font-medium">Disabled by you</span>
                      )}
                    </div>
                    <p className="text-sm text-neutral-600">{description}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${isSelected && canSelect
                    ? 'border-primary-500 bg-primary-500'
                    : 'border-gray-300'
                  }`}>
                    {isSelected && canSelect && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {allowedSteps.length <= 1 && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800">
                {allowedSteps.length === 1
                  ? <>Your current plan only supports the <strong>{allowedSteps[0].replace('_', ' ')}</strong> step. Upgrade to access more funnel step types.</>
                  : <>No funnel step types are enabled in your current plan. Upgrade to access funnels.</>}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} variant='gradient' style={{ color: 'white' }}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Funnel Options'}
        </Button>
      </div>

      {/* What's Next */}
      {(() => {
        const actions = getQuickActions(settings, tenantId, allowedSteps);
        if (actions.length === 0) return null;
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-600" />
                What's Next
              </CardTitle>
              <p className="text-sm text-neutral-600 mt-1">
                Continue building your sales funnel program
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {actions.map((action) => {
                  const IconComp = action.icon;
                  const variantStyles = {
                    product: 'bg-blue-50 border-blue-200 hover:border-blue-300 text-blue-900',
                    general: 'bg-gray-50 border-gray-200 hover:border-gray-300 text-neutral-900',
                  };
                  const iconStyles = {
                    product: 'text-blue-600',
                    general: 'text-neutral-600',
                  };
                  return (
                    <Link
                      key={action.id}
                      href={action.href}
                      className={`flex items-center gap-3 p-4 rounded-lg border transition-colors ${variantStyles[action.variant]}`}
                    >
                      <IconComp className={`h-5 w-5 shrink-0 ${iconStyles[action.variant]}`} />
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{action.label}</p>
                        <p className="text-xs opacity-80 truncate">{action.description}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 ml-auto shrink-0 opacity-60" />
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
