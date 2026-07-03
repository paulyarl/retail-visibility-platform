'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ArrowLeft, Plus, Pencil, Trash, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { DirectoryPromotionService, PromotionPlan } from '@/services/DirectoryPromotionService';

const TIER_COLORS: Record<string, string> = {
  basic: 'bg-amber-100 text-amber-800',
  premium: 'bg-blue-100 text-blue-800',
  featured: 'bg-purple-100 text-purple-800',
};

export default function PromotionCatalogClient() {
  const [plans, setPlans] = useState<PromotionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PromotionPlan | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await DirectoryPromotionService.adminListPlans(showInactive);
      setPlans(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load promotion catalog');
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleToggleActive = async (plan: PromotionPlan) => {
    try {
      await DirectoryPromotionService.adminUpdatePlan(plan.planKey, { isActive: !plan.isActive });
      await fetchPlans();
    } catch (err: any) {
      setError(err.message || 'Failed to update plan');
    }
  };

  const handleDelete = async (planKey: string) => {
    if (!confirm('Are you sure you want to delete this promotion plan?')) return;
    try {
      await DirectoryPromotionService.adminDeletePlan(planKey);
      await fetchPlans();
    } catch (err: any) {
      setError(err.message || 'Failed to delete plan');
    }
  };

  const svc = DirectoryPromotionService;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/settings/admin"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-amber-600" />
                Promotion Catalog
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage directory promotion plans — tiers, durations, pricing
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Show inactive
              </label>
              <button
                onClick={fetchPlans}
                disabled={loading}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700"
              >
                <Plus className="w-4 h-4" />
                New Plan
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 text-amber-600 animate-spin" />
            <span className="ml-2 text-gray-500">Loading catalog...</span>
          </div>
        ) : plans.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No promotion plans yet</h3>
            <p className="text-sm text-gray-500">Create your first promotion plan to get started.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Plan Key</th>
                  <th className="px-4 py-3 font-medium">Label</th>
                  <th className="px-4 py-3 font-medium">Tier</th>
                  <th className="px-4 py-3 font-medium text-right">Duration</th>
                  <th className="px-4 py-3 font-medium text-right">Price</th>
                  <th className="px-4 py-3 font-medium text-center">Sort</th>
                  <th className="px-4 py-3 font-medium text-center">Active</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {plans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{plan.planKey}</td>
                    <td className="px-4 py-3 text-gray-900 font-medium">{plan.label}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${TIER_COLORS[plan.tier] || 'bg-gray-100 text-gray-800'}`}>
                        {plan.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{plan.durationDays}d</td>
                    <td className="px-4 py-3 text-right text-gray-700">{svc.formatCurrency(plan.priceCents, plan.currency || 'USD')}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{plan.sortOrder}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleActive(plan)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${plan.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${plan.isActive ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditingPlan(plan)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(plan.planKey)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create/Edit Modal */}
        {(showCreateModal || editingPlan) && (
          <PlanModal
            plan={editingPlan}
            onClose={() => { setShowCreateModal(false); setEditingPlan(null); }}
            onSaved={() => { setShowCreateModal(false); setEditingPlan(null); fetchPlans(); }}
          />
        )}
      </div>
    </div>
  );
}

function PlanModal({ plan, onClose, onSaved }: { plan: PromotionPlan | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    planKey: plan?.planKey || '',
    label: plan?.label || '',
    tier: plan?.tier || 'basic',
    durationDays: plan?.durationDays?.toString() || '7',
    priceCents: plan?.priceCents ? (plan.priceCents / 100).toFixed(2) : '',
    currency: plan?.currency || 'USD',
    sortOrder: plan?.sortOrder?.toString() || '0',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const data: any = {
        label: form.label,
        tier: form.tier,
        durationDays: parseInt(form.durationDays, 10),
        priceCents: Math.round(parseFloat(form.priceCents) * 100),
        currency: form.currency,
        sortOrder: parseInt(form.sortOrder, 10),
      };
      if (plan) {
        await DirectoryPromotionService.adminUpdatePlan(plan.planKey, data);
      } else {
        data.planKey = form.planKey;
        await DirectoryPromotionService.adminCreatePlan(data);
      }
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
        <h2 className="text-lg font-semibold mb-4">{plan ? 'Edit Plan' : 'New Promotion Plan'}</h2>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm mb-4">{error}</div>}

        <div className="space-y-4">
          {!plan && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plan Key</label>
              <input
                type="text"
                value={form.planKey}
                onChange={(e) => setForm({ ...form, planKey: e.target.value })}
                placeholder="e.g. basic_7day"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="e.g. Basic Promotion - 7 Days"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tier</label>
              <select
                value={form.tier}
                onChange={(e) => setForm({ ...form, tier: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="basic">Basic</option>
                <option value="premium">Premium</option>
                <option value="featured">Featured</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (days)</label>
              <input
                type="number"
                value={form.durationDays}
                onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price (USD)</label>
              <input
                type="number"
                step="0.01"
                value={form.priceCents}
                onChange={(e) => setForm({ ...form, priceCents: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
