/**
 * BSaaS Services Tab — platform services catalog table
 *
 * Lists one-time platform service catalog entries (feature_key LIKE 'platform_service_%')
 * with pricing, active toggle, and grant actions.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  adminBsaasCatalogService,
  type BsaasCatalogEntry,
} from '@/services/AdminBsaasCatalogService';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { Gift, QrCode, Wrench } from 'lucide-react';
import ComplimentaryAccessForm from './ComplimentaryAccessForm';
import PrivateFeatureGrantDialog from './PrivateFeatureGrantDialog';

function formatPrice(cents: number, cycle: string) {
  const dollars = (cents / 100).toFixed(2);
  if (cycle === 'one_time') return `$${dollars} one-time`;
  if (cycle === 'annual') return `$${dollars}/yr`;
  if (cycle === 'weekly') return `$${dollars}/wk`;
  return `$${dollars}/mo`;
}

interface Props {
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export default function ServicesTab({ onError, onSuccess }: Props) {
  const [entries, setEntries] = useState<BsaasCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGrantDialog, setShowGrantDialog] = useState(false);
  const [showGrantQRDialog, setShowGrantQRDialog] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const all = await adminBsaasCatalogService.list();
      const services = all.filter((e) => e.feature_key.startsWith('platform_service_'));
      setEntries(services);
    } catch (err: any) {
      onError(err.message || 'Failed to load platform services');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleActive = async (entry: BsaasCatalogEntry) => {
    try {
      await adminBsaasCatalogService.update(entry.id, { is_active: !entry.is_active });
      await loadData();
    } catch (err: any) {
      onError(err.message || 'Failed to toggle service');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-neutral-500">Loading platform services...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={() => setShowGrantQRDialog(true)} className="gap-2">
          <QrCode className="w-4 h-4" />
          Create Grant QR
        </Button>
        <Button variant="outline" onClick={() => setShowGrantDialog(true)} className="gap-2">
          <Gift className="w-4 h-4" />
          Grant Access
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-neutral-300 rounded-lg">
          <Wrench className="w-12 h-12 mx-auto text-neutral-400 mb-3" />
          <p className="text-neutral-500">No platform services found in the catalog.</p>
          <p className="text-xs text-neutral-400 mt-1">
            Services are catalog entries with feature keys starting with &quot;platform_service_&quot;.
          </p>
        </div>
      ) : (
        <div className="border border-neutral-200 rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Feature Key</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Description</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Price</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Billing</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Demo Elig.</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Order</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-mono text-xs">{entry.feature_key}</td>
                  <td className="px-4 py-3 font-medium">{entry.marketing_name || '—'}</td>
                  <td className="px-4 py-3 max-w-xs truncate text-neutral-600">
                    {entry.description || '—'}
                  </td>
                  <td className="px-4 py-3 font-medium">{formatPrice(entry.price_cents, entry.billing_cycle)}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{entry.billing_cycle}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {entry.demo_eligible ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">Yes</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-red-100 text-red-800">No</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">{entry.sort_order}</td>
                  <td className="px-4 py-3">
                    <Switch
                      checked={entry.is_active}
                      onCheckedChange={() => handleToggleActive(entry)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Complimentary Access Dialog */}
      <ComplimentaryAccessForm
        open={showGrantDialog}
        onOpenChange={setShowGrantDialog}
      />

      {/* Private Feature Grant QR Dialog */}
      <PrivateFeatureGrantDialog
        open={showGrantQRDialog}
        onClose={() => setShowGrantQRDialog(false)}
      />
    </div>
  );
}
