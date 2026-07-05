/**
 * Complimentary Access Form
 *
 * Admin dialog for granting complimentary feature access to a tenant.
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { adminFeaturePurchasesService } from '@/services/AdminFeaturePurchasesService';
import { adminBsaasCatalogService, type BsaasCatalogEntry } from '@/services/AdminBsaasCatalogService';
import { adminOperationsService } from '@/services/AdminOperationsService';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Gift, AlertCircle } from 'lucide-react';

interface ComplimentaryAccessFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function ComplimentaryAccessForm({ open, onOpenChange, onSuccess }: ComplimentaryAccessFormProps) {
  const [catalog, setCatalog] = useState<BsaasCatalogEntry[]>([]);
  const [tenants, setTenants] = useState<{ id: string; name: string; subscriptionTier: string; subscriptionStatus: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [tenantId, setTenantId] = useState('');
  const [featureKey, setFeatureKey] = useState('');
  const [durationDays, setDurationDays] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      adminBsaasCatalogService.list().then(setCatalog).catch(() => {});
      adminOperationsService.getTenants(1, 500).then((result) => {
        setTenants(result.tenants.map((t) => ({
          id: t.id,
          name: t.name,
          subscriptionTier: t.subscriptionTier,
          subscriptionStatus: t.subscriptionStatus,
        })));
      }).catch(() => {});
    }
  }, [open]);

  const tenantOptions = useMemo(() =>
    tenants.map((t) => ({
      value: t.id,
      label: `${t.name} (${t.id})`,
    })),
    [tenants]
  );

  const resetForm = () => {
    setTenantId('');
    setFeatureKey('');
    setDurationDays('');
    setReason('');
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async () => {
    if (!tenantId.trim()) {
      setError('Tenant ID is required');
      return;
    }
    if (!featureKey) {
      setError('Feature is required');
      return;
    }
    if (!reason.trim()) {
      setError('Reason is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await adminFeaturePurchasesService.grantComplimentary({
        tenant_id: tenantId.trim(),
        feature_key: featureKey,
        duration_days: durationDays ? parseInt(durationDays) : undefined,
        reason: reason.trim(),
      });
      setSuccess(`Complimentary access granted for "${featureKey}" to tenant ${tenantId.trim()}`);
      resetForm();
      onSuccess?.();
      setTimeout(() => {
        onOpenChange(false);
        setSuccess(null);
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to grant complimentary access');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) resetForm(); onOpenChange(open); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5" />
            Grant Complimentary Access
          </DialogTitle>
          <DialogDescription>
            Give a tenant free access to a feature. No payment will be charged. The renewal job will skip this purchase.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700">
              <p className="text-sm">{success}</p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-1 block">Tenant *</label>
            <SearchableSelect
              options={tenantOptions}
              value={tenantId}
              onChange={setTenantId}
              placeholder="Select a tenant..."
            />
            <p className="text-xs text-neutral-400 mt-1">The tenant to receive the feature</p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Feature *</label>
            <select
              className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm"
              value={featureKey}
              onChange={(e) => setFeatureKey(e.target.value)}
            >
              <option value="">Select a feature...</option>
              {catalog.map((entry) => (
                <option key={entry.id} value={entry.feature_key}>
                  {entry.marketing_name || entry.feature_key} ({entry.feature_key})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Duration (days)</label>
            <Input
              type="number"
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              placeholder="Leave empty for permanent"
            />
            <p className="text-xs text-neutral-400 mt-1">Leave empty for permanent (no expiry)</p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Reason *</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Beta tester, partnership, goodwill credit"
              rows={2}
            />
            <p className="text-xs text-neutral-400 mt-1">Internal note — recorded in audit log and purchase metadata</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Granting...' : 'Grant Access'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
