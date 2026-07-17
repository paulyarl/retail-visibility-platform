'use client';

import { useState, useEffect, useCallback, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Plus, RefreshCw, Trash2, Edit3, BarChart3, Filter, Zap, TrendingUp, ArrowDownCircle, Sparkles } from 'lucide-react';
import FunnelService, { type FunnelWithSteps } from '@/services/FunnelService';
import { useFunnelCapability } from '@/hooks/tenant-access/useCapabilityAccess';

interface FunnelListClientProps {
  tenantId: string;
}

const STEP_TYPE_ICONS: Record<string, typeof Zap> = {
  order_bump: Zap,
  upsell: TrendingUp,
  downsell: ArrowDownCircle,
  oto: Sparkles,
};

export default function FunnelListClient({ tenantId }: FunnelListClientProps) {
  const router = useRouter();
  const { data: capability, loading: capLoading } = useFunnelCapability(tenantId);
  const [funnels, setFunnels] = useState<FunnelWithSteps[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<FunnelWithSteps | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchFunnels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await FunnelService.listFunnels(tenantId, true);
      setFunnels(list);
    } catch (err: any) {
      setError(err?.message || 'Failed to load funnels');
      setFunnels([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchFunnels();
  }, [fetchFunnels]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const funnel = await FunnelService.createFunnel(tenantId, {
        name: newName.trim(),
        trigger_type: 'always',
        is_active: true,
        steps: [],
      });
      setNewName('');
      setShowCreate(false);
      router.push(`/t/${tenantId}/settings/funnels/${funnel.id}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to create funnel');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await FunnelService.deleteFunnel(tenantId, deleteTarget.id);
      setDeleteTarget(null);
      fetchFunnels();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete funnel');
    }
  };

  const handleToggleActive = async (funnel: FunnelWithSteps) => {
    try {
      await FunnelService.updateFunnel(tenantId, funnel.id, {
        name: funnel.name,
        entry_item_id: funnel.entry_item_id,
        trigger_type: funnel.trigger_type as 'product' | 'cart_value' | 'always',
        min_cart_value_cents: funnel.min_cart_value_cents,
        is_active: !funnel.is_active,
        is_default: funnel.is_default,
        metadata: funnel.metadata ?? undefined,
        steps: funnel.steps.map(s => ({
          step_type: s.step_type as 'order_bump' | 'upsell' | 'downsell' | 'oto',
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
        })),
      });
      fetchFunnels();
    } catch (err: any) {
      setError(err?.message || 'Failed to update funnel');
    }
  };

  if (capLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <LoadingSpinner />
      </div>
    );
  }

  if (!capability || !capability.enabled || !capability.builderEnabled) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <h1 className="text-2xl font-bold mb-4">Sales Funnels</h1>
        <Card>
          <CardContent className="p-8 text-center">
            <Filter className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-medium mb-2">Sales Funnels Not Available</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Upgrade to a plan with Funnel Builder to create order bumps, upsells, downsells, and one-time offers.
            </p>
            <Button variant="secondary" onClick={() => router.push(`/t/${tenantId}/settings/plan-summary`)}>
              View Plans
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sales Funnels</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create order bumps, upsells, downsells, and one-time offers to boost revenue.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchFunnels} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Funnel
          </Button>
        </div>
      </div>

      {capability.isFlexible && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="success">Flexible Tier</Badge>
              <span className="text-muted-foreground">
                All step types available: Order Bump, Upsell, Downsell, One-Time Offer
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {!capability.isFlexible && capability.allowedSteps.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Available step types:</span>
              {capability.allowedSteps.map(step => {
                const Icon = STEP_TYPE_ICONS[step] || Zap;
                return (
                  <Badge key={step} variant="default">
                    <Icon className="h-3 w-3 mr-1" />
                    {step.replace('_', ' ')}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : funnels.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Filter className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-medium mb-2">No Funnels Yet</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first sales funnel to start offering order bumps and upsells to your customers.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Funnel
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {funnels.map(funnel => (
            <Card key={funnel.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base">{funnel.name}</CardTitle>
                  {funnel.is_default && <Badge variant="success">Default</Badge>}
                  <Badge variant={funnel.is_active ? 'success' : 'secondary'}>
                    {funnel.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/t/${tenantId}/settings/funnels/${funnel.id}/analytics`)}
                  >
                    <BarChart3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/t/${tenantId}/settings/funnels/${funnel.id}`)}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleActive(funnel)}
                  >
                    {funnel.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(funnel)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Trigger: {funnel.trigger_type.replace('_', ' ')}</span>
                  <span>Steps: {funnel.steps.length}</span>
                  {funnel.min_cart_value_cents !== null && (
                    <span>Min cart: ${(funnel.min_cart_value_cents / 100).toFixed(2)}</span>
                  )}
                </div>
                {funnel.steps.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {funnel.steps
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map(step => {
                        const Icon = STEP_TYPE_ICONS[step.step_type] || Zap;
                        return (
                          <Badge key={step.id} variant="outline">
                            <Icon className="h-3 w-3 mr-1" />
                            {step.step_type.replace('_', ' ')}
                            {step.display_title && `: ${step.display_title}`}
                          </Badge>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md" onClick={(e: MouseEvent) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Create New Funnel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Funnel Name</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Digital Product Upsell Chain"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={!newName.trim()}>Create</Button>
              </div>
            </CardContent>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Funnel"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
