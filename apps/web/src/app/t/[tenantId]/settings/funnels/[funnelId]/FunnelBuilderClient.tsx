'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ArrowLeft, Save, Plus, Trash2, GripVertical, Zap, TrendingUp, ArrowDownCircle, Sparkles, AlertCircle, Package, Tag } from 'lucide-react';
import FunnelService, { type FunnelWithSteps, type FunnelStepInput, type FunnelInput, type FunnelStepType } from '@/services/FunnelService';
import { useFunnelCapability, useCouponOptionsCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import { CouponService, type Coupon } from '@/services/CouponService';
import ItemPickerModal from '@/components/inventory/ItemPickerModal';
import { itemsService } from '@/services/ItemsSingletonService';

interface FunnelBuilderClientProps {
  tenantId: string;
  funnelId: string;
}

const STEP_TYPES = [
  { value: 'order_bump', label: 'Order Bump', icon: Zap, description: 'Pre-checkout add-on offer' },
  { value: 'upsell', label: 'Upsell', icon: TrendingUp, description: 'Post-purchase upgrade offer' },
  { value: 'downsell', label: 'Downsell', icon: ArrowDownCircle, description: 'Post-decline alternative offer' },
  { value: 'oto', label: 'One-Time Offer', icon: Sparkles, description: 'Limited-time exclusive offer' },
  { value: 'coupon_offer', label: 'Coupon Offer', icon: Tag, description: 'Offer a coupon code for a future purchase' },
] as const;

export default function FunnelBuilderClient({ tenantId, funnelId }: FunnelBuilderClientProps) {
  const router = useRouter();
  const { data: capability } = useFunnelCapability(tenantId);
  const { data: couponCap } = useCouponOptionsCapability(tenantId);
  const [funnel, setFunnel] = useState<FunnelWithSteps | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Editable form state
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<'product' | 'cart_value' | 'always'>('always');
  const [minCartValueCents, setMinCartValueCents] = useState<number | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [entryItemId, setEntryItemId] = useState<string | null>(null);
  const [entryItemName, setEntryItemName] = useState<string | null>(null);
  const [steps, setSteps] = useState<FunnelStepInput[]>([]);

  // Item picker modal state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'entry' | number | null>(null);
  const [stepItemNames, setStepItemNames] = useState<Record<number, string>>({});

  const fetchFunnel = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const f = await FunnelService.getFunnel(tenantId, funnelId);
      setFunnel(f);
      setName(f.name);
      setTriggerType(f.trigger_type as 'product' | 'cart_value' | 'always');
      setMinCartValueCents(f.min_cart_value_cents);
      setIsActive(f.is_active);
      setIsDefault(f.is_default);
      setEntryItemId(f.entry_item_id);
      setEntryItemName(null);
      setStepItemNames({});
      setSteps((f.steps ?? [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(s => ({
          step_type: s.step_type as FunnelStepType,
          offer_item_id: s.offer_item_id,
          display_title: s.display_title,
          display_description: s.display_description,
          price_cents: s.price_cents,
          discount_cents: s.discount_cents,
          sort_order: s.sort_order,
          accept_to_step_id: s.accept_to_step_id,
          skip_to_step_id: s.skip_to_step_id,
          is_active: s.is_active,
          metadata: s.metadata ?? undefined,
        })));

      // Resolve item names for display
      const itemIds = [
        f.entry_item_id,
        ...(f.steps ?? []).map(s => s.offer_item_id).filter(Boolean),
      ].filter(Boolean) as string[];
      if (itemIds.length > 0) {
        const items = await Promise.all(itemIds.map(id => itemsService.getItem(id).catch(() => null)));
        if (f.entry_item_id) {
          const entryItem = items.find(i => i?.id === f.entry_item_id);
          if (entryItem) setEntryItemName(entryItem.name);
        }
        const names: Record<number, string> = {};
        (f.steps ?? []).forEach((s, i) => {
          if (s.offer_item_id) {
            const item = items.find(it => it?.id === s.offer_item_id);
            if (item) names[i] = item.name;
          }
        });
        setStepItemNames(names);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load funnel');
    } finally {
      setLoading(false);
    }
  }, [tenantId, funnelId]);

  useEffect(() => {
    fetchFunnel();
  }, [fetchFunnel]);

  useEffect(() => {
    CouponService.getInstance()
      .listCoupons(tenantId)
      .then((result) => setCoupons(result.coupons))
      .catch(() => {});
  }, [tenantId]);

  const openPickerForEntry = () => {
    setPickerMode('entry');
    setPickerOpen(true);
  };

  const openPickerForStep = (stepIndex: number) => {
    setPickerMode(stepIndex);
    setPickerOpen(true);
  };

  const handlePickerSelect = (itemId: string, itemName: string) => {
    if (pickerMode === 'entry') {
      setEntryItemId(itemId);
      setEntryItemName(itemName);
    } else if (typeof pickerMode === 'number') {
      updateStep(pickerMode, { offer_item_id: itemId });
      setStepItemNames(prev => ({ ...prev, [pickerMode]: itemName }));
    }
    setPickerMode(null);
  };

  const addStep = () => {
    const newStep: FunnelStepInput = {
      step_type: 'order_bump',
      offer_item_id: '',
      display_title: null,
      display_description: null,
      price_cents: null,
      discount_cents: 0,
      sort_order: steps.length,
      accept_to_step_id: null,
      skip_to_step_id: null,
      is_active: true,
      metadata: {},
    };
    setSteps([...steps, newStep]);
  };

  const updateStep = (index: number, updates: Partial<FunnelStepInput>) => {
    setSteps(steps.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, sort_order: i })));
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const swapped = [...steps];
      [swapped[index - 1], swapped[index]] = [swapped[index], swapped[index - 1]];
      setSteps(swapped.map((s, i) => ({ ...s, sort_order: i })));
    } else if (direction === 'down' && index < steps.length - 1) {
      const swapped = [...steps];
      [swapped[index + 1], swapped[index]] = [swapped[index], swapped[index + 1]];
      setSteps(swapped.map((s, i) => ({ ...s, sort_order: i })));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const data: FunnelInput = {
        name: name.trim(),
        entry_item_id: entryItemId,
        trigger_type: triggerType,
        min_cart_value_cents: triggerType === 'cart_value' ? minCartValueCents : null,
        is_active: isActive,
        is_default: isDefault,
        steps: steps.filter(s => s.offer_item_id),
      };
      await FunnelService.updateFunnel(tenantId, funnelId, data);
      setSuccessMsg('Funnel saved successfully');
      setTimeout(() => setSuccessMsg(null), 3000);
      fetchFunnel();
    } catch (err: any) {
      setError(err?.message || 'Failed to save funnel');
    } finally {
      setSaving(false);
    }
  };

  const isStepTypeAllowed = (stepType: string) => {
    if (!capability) return false;
    if (stepType === 'order_bump') return capability.canUseOrderBump;
    if (stepType === 'upsell') return capability.canUseUpsell;
    if (stepType === 'downsell') return capability.canUseDownsell;
    if (stepType === 'oto') return capability.canUseOto;
    if (stepType === 'coupon_offer') return (capability.canUseCouponOffer && !!couponCap?.enabled) || false;
    return false;
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <LoadingSpinner />
      </div>
    );
  }

  if (!funnel) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-medium mb-2">Funnel Not Found</h2>
            <Button onClick={() => router.push(`/t/${tenantId}/settings/funnels`)}>
              Back to Funnels
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/t/${tenantId}/settings/funnels`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{funnel.name}</h1>
            <p className="text-sm text-muted-foreground">Funnel Builder</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/t/${tenantId}/settings/funnels/${funnelId}/analytics`)}
          >
            Analytics
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {error && (
        <Card><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>
      )}
      {successMsg && (
        <Card><CardContent className="p-4 text-sm text-green-600">{successMsg}</CardContent></Card>
      )}

      {/* Funnel Settings */}
      <Card>
        <CardHeader><CardTitle>Funnel Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Funnel name" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Trigger Type</label>
              <Select
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value as 'product' | 'cart_value' | 'always')}
              >
                <option value="always">Always (on every checkout)</option>
                <option value="product">Specific Product</option>
                <option value="cart_value">Cart Value Threshold</option>
              </Select>
            </div>

            {triggerType === 'cart_value' && (
              <div>
                <label className="text-sm font-medium mb-1 block">Min Cart Value ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={minCartValueCents !== null ? (minCartValueCents / 100).toFixed(2) : ''}
                  onChange={(e) => setMinCartValueCents(e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null)}
                  placeholder="0.00"
                />
              </div>
            )}
          </div>

          {triggerType === 'product' && (
            <div>
              <label className="text-sm font-medium mb-1 block">Entry Product</label>
              <div className="flex items-center gap-2">
                {entryItemId ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium flex-1">{entryItemName || entryItemId}</span>
                    <Button variant="outline" size="sm" onClick={() => { setEntryItemId(null); setEntryItemName(null); }}>
                      Clear
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={openPickerForEntry}>
                    <Package className="h-4 w-4 mr-1" />
                    Select Product
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <label className="text-sm">Active</label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isDefault} onCheckedChange={setIsDefault} />
              <label className="text-sm">Default Funnel</label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Steps */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Funnel Steps</CardTitle>
          <Button size="sm" variant="outline" onClick={addStep}>
            <Plus className="h-4 w-4 mr-1" />
            Add Step
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {steps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No steps yet. Add your first step to start building your funnel.</p>
            </div>
          ) : (
            steps.map((step, index) => {
              const StepIcon = STEP_TYPES.find(t => t.value === step.step_type)?.icon || Zap;
              const isAllowed = isStepTypeAllowed(step.step_type);
              return (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Step {index + 1}</span>
                      <Badge variant={isAllowed ? 'default' : 'secondary'}>
                        <StepIcon className="h-3 w-3 mr-1" />
                        {step.step_type.replace('_', ' ')}
                      </Badge>
                      {!isAllowed && (
                        <span className="text-xs text-destructive">Not available</span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" disabled={index === 0} onClick={() => moveStep(index, 'up')}>
                        ↑
                      </Button>
                      <Button variant="ghost" size="sm" disabled={index === steps.length - 1} onClick={() => moveStep(index, 'down')}>
                        ↓
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => removeStep(index)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium mb-1 block">Step Type</label>
                      <Select
                        value={step.step_type}
                        onChange={(e) => updateStep(index, { step_type: e.target.value as FunnelStepType })}
                      >
                        {STEP_TYPES.map(t => (
                          <option key={t.value} value={t.value} disabled={!isStepTypeAllowed(t.value)}>
                            {t.label} — {t.description}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">{step.step_type === 'coupon_offer' ? 'Offer Coupon' : 'Offer Product'}</label>
                      {step.step_type === 'coupon_offer' ? (
                        <Select
                          value={step.offer_item_id}
                          onChange={(e) => updateStep(index, { offer_item_id: e.target.value })}
                        >
                          <option value="">Select a coupon</option>
                          {coupons.map((coupon) => (
                            <option key={coupon.id} value={coupon.id}>
                              {coupon.code} ({coupon.discountType})
                            </option>
                          ))}
                        </Select>
                      ) : step.offer_item_id ? (
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs font-medium flex-1 truncate">{stepItemNames[index] || step.offer_item_id}</span>
                          <Button variant="ghost" size="sm" onClick={() => {
                            updateStep(index, { offer_item_id: '' });
                            setStepItemNames(prev => { const next = { ...prev }; delete next[index]; return next; });
                          }}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => openPickerForStep(index)}>
                          <Package className="h-3 w-3 mr-1" />
                          Select Product
                        </Button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium mb-1 block">Display Title</label>
                    <Input
                      value={step.display_title || ''}
                      onChange={(e) => updateStep(index, { display_title: e.target.value || null })}
                      placeholder="e.g., Add this to your order!"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium mb-1 block">Display Description</label>
                    <Textarea
                      value={step.display_description || ''}
                      onChange={(e) => updateStep(index, { display_description: e.target.value || null })}
                      placeholder="Describe the offer..."
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium mb-1 block">Offer Price ($)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={step.price_cents !== null && step.price_cents !== undefined ? (step.price_cents / 100).toFixed(2) : ''}
                        onChange={(e) => updateStep(index, { price_cents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null })}
                        placeholder="Leave empty for product price"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">Discount ($)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={step.discount_cents ? (step.discount_cents / 100).toFixed(2) : '0'}
                        onChange={(e) => updateStep(index, { discount_cents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : 0 })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={step.is_active ?? true}
                      onCheckedChange={(checked) => updateStep(index, { is_active: checked })}
                    />
                    <label className="text-xs">Step Active</label>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Item Picker Modal */}
      <ItemPickerModal
        isOpen={pickerOpen}
        onClose={() => { setPickerOpen(false); setPickerMode(null); }}
        onSelect={handlePickerSelect}
        tenantId={tenantId}
      />
    </div>
  );
}
