/**
 * BSaaS Grants Tab — grant token overview table
 *
 * Lists all grant tokens with status, claims, and claim details.
 * Supports filtering by status and expanding rows to see individual claims.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  adminFeaturePurchasesService,
  type GrantToken,
  type ComplimentaryGrant,
  type UpdateComplimentaryGrantInput,
} from '@/services/AdminFeaturePurchasesService';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Gift, QrCode, Ticket, ChevronDown, ChevronRight, RefreshCw, Pencil, Ban, RotateCcw } from 'lucide-react';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusBadge(status: GrantToken['status']) {
  switch (status) {
    case 'active':
      return <Badge variant="secondary" className="bg-green-100 text-green-800">Active</Badge>;
    case 'expired':
      return <Badge variant="secondary" className="bg-red-100 text-red-800">Expired</Badge>;
    case 'fully_claimed':
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Fully Claimed</Badge>;
    case 'revoked':
      return <Badge variant="secondary" className="bg-red-100 text-red-800 border border-red-300">Revoked</Badge>;
    default:
      return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Inactive</Badge>;
  }
}

function formatDuration(days: number | null): string {
  if (!days) return 'Permanent';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;
  if (days < 365) return `${Math.round(days / 30)} months`;
  return `${Math.round(days / 365)} year(s)`;
}

interface Props {
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export default function GrantsTab({ onError, onSuccess }: Props) {
  const [grants, setGrants] = useState<GrantToken[]>([]);
  const [complimentaryGrants, setComplimentaryGrants] = useState<ComplimentaryGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [editingGrant, setEditingGrant] = useState<GrantToken | null>(null);
  const [editMaxClaims, setEditMaxClaims] = useState<number>(1);
  const [editNotes, setEditNotes] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [editingComp, setEditingComp] = useState<ComplimentaryGrant | null>(null);
  const [compStatus, setCompStatus] = useState<string>('active');
  const [compExpiresAt, setCompExpiresAt] = useState<string>('');
  const [savingComp, setSavingComp] = useState(false);
  const [revokingCompId, setRevokingCompId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [grantData, compData] = await Promise.all([
        adminFeaturePurchasesService.listGrants(
          statusFilter ? { status: statusFilter } : undefined,
        ),
        adminFeaturePurchasesService.listComplimentaryGrants(
          statusFilter ? { status: statusFilter } : undefined,
        ),
      ]);
      setGrants(grantData);
      setComplimentaryGrants(compData);
    } catch (err: any) {
      onError(err.message || 'Failed to load grant tokens');
    } finally {
      setLoading(false);
    }
  }, [onError, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRefresh = () => {
    adminFeaturePurchasesService.invalidateGrantsCache();
    loadData();
    onSuccess('Grants refreshed');
  };

  const handleEditClick = (grant: GrantToken, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingGrant(grant);
    setEditMaxClaims(grant.max_claims);
    setEditNotes(grant.notes || '');
  };

  const handleSaveEdit = async () => {
    if (!editingGrant) return;
    setSavingEdit(true);
    try {
      await adminFeaturePurchasesService.updateGrant(editingGrant.id, {
        max_claims: editMaxClaims,
        notes: editNotes || null,
      });
      onSuccess('Grant token updated');
      setEditingGrant(null);
      loadData();
    } catch (err: any) {
      onError(err.message || 'Failed to update grant token');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleRevoke = async (grant: GrantToken, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Revoke grant token for "${grant.feature_name}"? This will prevent any future redemptions.`)) return;
    setRevokingId(grant.id);
    try {
      await adminFeaturePurchasesService.revokeGrant(grant.id);
      onSuccess('Grant token revoked');
      loadData();
    } catch (err: any) {
      onError(err.message || 'Failed to revoke grant token');
    } finally {
      setRevokingId(null);
    }
  };

  const handleUnrevoke = async (grant: GrantToken, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Un-revoke grant token for "${grant.feature_name}"? This will allow redemptions again.`)) return;
    setRevokingId(grant.id);
    try {
      await adminFeaturePurchasesService.unrevokeGrant(grant.id);
      onSuccess('Grant token un-revoked');
      loadData();
    } catch (err: any) {
      onError(err.message || 'Failed to un-revoke grant token');
    } finally {
      setRevokingId(null);
    }
  };

  const handleEditCompClick = (grant: ComplimentaryGrant) => {
    setEditingComp(grant);
    setCompStatus(grant.status);
    setCompExpiresAt(grant.expires_at ? grant.expires_at.slice(0, 10) : '');
  };

  const handleSaveComp = async () => {
    if (!editingComp) return;
    setSavingComp(true);
    try {
      const input: UpdateComplimentaryGrantInput = {
        status: compStatus as any,
        expires_at: compExpiresAt ? new Date(compExpiresAt).toISOString() : null,
      };
      await adminFeaturePurchasesService.updateComplimentaryGrant(editingComp.id, input);
      onSuccess('Complimentary grant updated');
      setEditingComp(null);
      loadData();
    } catch (err: any) {
      onError(err.message || 'Failed to update complimentary grant');
    } finally {
      setSavingComp(false);
    }
  };

  const handleRevokeComp = async (grant: ComplimentaryGrant) => {
    if (!confirm(`Revoke complimentary grant for "${grant.feature_key}" from ${grant.tenant_name || grant.tenant_id}? This will remove the feature access.`)) return;
    setRevokingCompId(grant.id);
    try {
      await adminFeaturePurchasesService.revokeComplimentaryGrant(grant.id);
      onSuccess('Complimentary grant revoked');
      loadData();
    } catch (err: any) {
      onError(err.message || 'Failed to revoke complimentary grant');
    } finally {
      setRevokingCompId(null);
    }
  };

  const totalGrants = grants.length;
  const activeGrants = grants.filter((g) => g.status === 'active').length;
  const expiredGrants = grants.filter((g) => g.status === 'expired').length;
  const fullyClaimedGrants = grants.filter((g) => g.status === 'fully_claimed').length;
  const revokedGrants = grants.filter((g) => g.status === 'revoked').length;
  const totalClaims = grants.reduce((sum, g) => sum + (g.claims_count ?? 0), 0);
  const totalComplimentary = complimentaryGrants.length;
  const activeComplimentary = complimentaryGrants.filter((g) => g.status === 'active').length;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-8 gap-3">
        <div className="border border-neutral-200 rounded-lg p-3">
          <p className="text-xs text-neutral-500">QR Grant Tokens</p>
          <p className="text-xl font-bold mt-1">{totalGrants}</p>
        </div>
        <div className="border border-neutral-200 rounded-lg p-3">
          <p className="text-xs text-neutral-500">QR Active</p>
          <p className="text-xl font-bold mt-1 text-green-600">{activeGrants}</p>
        </div>
        <div className="border border-neutral-200 rounded-lg p-3">
          <p className="text-xs text-neutral-500">QR Fully Claimed</p>
          <p className="text-xl font-bold mt-1 text-blue-600">{fullyClaimedGrants}</p>
        </div>
        <div className="border border-neutral-200 rounded-lg p-3">
          <p className="text-xs text-neutral-500">QR Expired</p>
          <p className="text-xl font-bold mt-1 text-red-600">{expiredGrants}</p>
        </div>
        <div className="border border-neutral-200 rounded-lg p-3">
          <p className="text-xs text-neutral-500">QR Revoked</p>
          <p className="text-xl font-bold mt-1 text-red-700">{revokedGrants}</p>
        </div>
        <div className="border border-neutral-200 rounded-lg p-3">
          <p className="text-xs text-neutral-500">Total QR Claims</p>
          <p className="text-xl font-bold mt-1">{totalClaims}</p>
        </div>
        <div className="border border-neutral-200 rounded-lg p-3">
          <p className="text-xs text-neutral-500">Complimentary Grants</p>
          <p className="text-xl font-bold mt-1 text-purple-600">{totalComplimentary}</p>
        </div>
        <div className="border border-neutral-200 rounded-lg p-3">
          <p className="text-xs text-neutral-500">Complimentary Active</p>
          <p className="text-xl font-bold mt-1 text-green-600">{activeComplimentary}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-500">Filter:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-neutral-200 rounded-md px-3 py-1.5 bg-white"
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="fully_claimed">Fully Claimed</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
          </select>
        </div>
        <Button variant="outline" onClick={handleRefresh} className="gap-2" size="sm">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* QR Grant Tokens Table */}
      <div className="flex items-center gap-2 mb-2">
        <QrCode className="w-4 h-4 text-neutral-500" />
        <h3 className="text-sm font-medium text-neutral-700">QR Grant Tokens</h3>
      </div>
      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="text-neutral-500">Loading grant tokens...</div>
        </div>
      ) : grants.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-neutral-300 rounded-lg">
          <Ticket className="w-12 h-12 mx-auto text-neutral-400 mb-3" />
          <p className="text-neutral-500">No QR grant tokens found.</p>
          <p className="text-xs text-neutral-400 mt-1">
            Grant tokens are created when you use &quot;Create Grant QR&quot; on the Features or Services tab.
          </p>
        </div>
      ) : (
        <div className="border border-neutral-200 rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-neutral-600 w-8"></th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Feature</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Target Tenant</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Duration</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Claims</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">QR Expires</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Created</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Granted By</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {grants.map((grant) => {
                const isExpanded = expandedRows.has(grant.id);
                const hasClaims = (grant.claims?.length ?? 0) > 0;
                const isRevoked = grant.is_revoked;
                const canEdit = !isRevoked && grant.status !== 'expired';
                return (
                  <React.Fragment key={grant.id}>
                    <tr className={`hover:bg-neutral-50 cursor-pointer ${isRevoked ? 'opacity-60' : ''}`} onClick={() => hasClaims && toggleRow(grant.id)}>
                      <td className="px-4 py-3">
                        {hasClaims ? (
                          isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-neutral-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-neutral-400" />
                          )
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{grant.feature_name}</div>
                        <div className="font-mono text-xs text-neutral-400">{grant.feature_key}</div>
                      </td>
                      <td className="px-4 py-3">
                        {grant.tenant_name ? (
                          <span>{grant.tenant_name}</span>
                        ) : grant.tenant_id ? (
                          <span className="font-mono text-xs">{grant.tenant_id}</span>
                        ) : (
                          <Badge variant="secondary" className="bg-purple-100 text-purple-800">Any Tenant</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {formatDuration(grant.duration_days)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{grant.claims_count}</span>
                        <span className="text-neutral-400"> / {grant.max_claims}</span>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {formatDate(grant.qr_expires_at)}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {formatDate(grant.created_at)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-neutral-500">
                        {grant.granted_by}
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(grant.status)}
                        {grant.notes && (
                          <div className="text-xs text-neutral-400 mt-1 max-w-[150px] truncate" title={grant.notes}>
                            {grant.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {canEdit && (
                            <button
                              onClick={(e) => handleEditClick(grant, e)}
                              className="p-1.5 rounded hover:bg-neutral-200 text-neutral-600"
                              title="Edit grant"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isRevoked ? (
                            <button
                              onClick={(e) => handleUnrevoke(grant, e)}
                              disabled={revokingId === grant.id}
                              className="p-1.5 rounded hover:bg-green-100 text-green-600 disabled:opacity-50"
                              title="Un-revoke"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={(e) => handleRevoke(grant, e)}
                              disabled={revokingId === grant.id}
                              className="p-1.5 rounded hover:bg-red-100 text-red-600 disabled:opacity-50"
                              title="Revoke"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && hasClaims && (
                      <tr className="bg-neutral-50/50">
                        <td colSpan={10} className="px-8 py-3">
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-neutral-500 mb-2">Claim History ({grant.claims?.length ?? 0})</p>
                            {(grant.claims ?? []).map((claim) => (
                              <div key={claim.id} className="flex items-center gap-4 text-xs py-1.5 border-b border-neutral-100 last:border-0">
                                <span className="font-medium text-neutral-700">
                                  {claim.tenant_name || claim.tenant_id}
                                </span>
                                <span className="text-neutral-400">claimed</span>
                                <span className="text-neutral-500">{formatDate(claim.claimed_at)}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Complimentary Grants Table */}
      <div className="flex items-center gap-2 mb-2 mt-6">
        <Gift className="w-4 h-4 text-neutral-500" />
        <h3 className="text-sm font-medium text-neutral-700">Complimentary Grants</h3>
      </div>
      {loading ? (
        <div className="flex items-center justify-center min-h-[100px]">
          <div className="text-neutral-500">Loading complimentary grants...</div>
        </div>
      ) : complimentaryGrants.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-neutral-300 rounded-lg">
          <Gift className="w-10 h-10 mx-auto text-neutral-400 mb-2" />
          <p className="text-neutral-500 text-sm">No complimentary grants found.</p>
          <p className="text-xs text-neutral-400 mt-1">
            Complimentary grants are created when you use &quot;Grant Complimentary Access&quot; on the Features, Bundles, or Services tab.
          </p>
        </div>
      ) : (
        <div className="border border-neutral-200 rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Feature</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Tenant</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Tier</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Duration</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Reason</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Granted By</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Created</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Expires</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {complimentaryGrants.map((grant) => (
                <tr key={grant.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{grant.feature_key}</div>
                  </td>
                  <td className="px-4 py-3">
                    {grant.tenant_name ? (
                      <span>{grant.tenant_name}</span>
                    ) : (
                      <span className="font-mono text-xs">{grant.tenant_id}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {grant.tenant_tier || <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {grant.expires_at ? formatDuration(Math.ceil((new Date(grant.expires_at).getTime() - new Date(grant.created_at).getTime()) / (24 * 60 * 60 * 1000))) : 'Permanent'}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 max-w-xs truncate" title={grant.reason || ''}>
                    {grant.reason || <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-500">
                    {grant.granted_by || <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {formatDate(grant.created_at)}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {grant.expires_at ? formatDate(grant.expires_at) : <span className="text-neutral-400">Never</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className={grant.status === 'active' ? 'bg-green-100 text-green-800' : grant.status === 'expired' || grant.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}>
                      {grant.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditCompClick(grant)}
                        className="p-1.5 rounded hover:bg-neutral-200 text-neutral-600"
                        title="Edit grant"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRevokeComp(grant)}
                        disabled={revokingCompId === grant.id}
                        className="p-1.5 rounded hover:bg-red-100 text-red-600 disabled:opacity-50"
                        title="Revoke grant"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Complimentary Grant Modal */}
      {editingComp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditingComp(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-1">Edit Complimentary Grant</h3>
              <p className="text-sm text-neutral-500 mb-4">
                {editingComp.feature_key} — {editingComp.tenant_name || editingComp.tenant_id}
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Status</label>
                  <select
                    value={compStatus}
                    onChange={(e) => setCompStatus(e.target.value)}
                    className="w-full border border-neutral-200 rounded-md px-3 py-2 text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="expired">Expired</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Expires At</label>
                  <input
                    type="date"
                    value={compExpiresAt}
                    onChange={(e) => setCompExpiresAt(e.target.value)}
                    className="w-full border border-neutral-200 rounded-md px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-neutral-400 mt-1">
                    Leave empty for permanent (no expiry).
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => setEditingComp(null)} size="sm">
                  Cancel
                </Button>
                <Button onClick={handleSaveComp} disabled={savingComp} size="sm">
                  {savingComp ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Grant Token Modal */}
      {editingGrant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditingGrant(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-1">Edit Grant Token</h3>
              <p className="text-sm text-neutral-500 mb-4">
                {editingGrant.feature_name} — <span className="font-mono text-xs">{editingGrant.feature_key}</span>
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Max Claims
                  </label>
                  <input
                    type="number"
                    min={editingGrant.claims_count}
                    max={100}
                    value={editMaxClaims}
                    onChange={(e) => setEditMaxClaims(parseInt(e.target.value) || 1)}
                    className="w-full border border-neutral-200 rounded-md px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-neutral-400 mt-1">
                    Current claims: {editingGrant.claims_count}. Cannot be reduced below current claims.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Notes (optional)
                  </label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder="Admin notes about this grant token..."
                    className="w-full border border-neutral-200 rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => setEditingGrant(null)} size="sm">
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit} disabled={savingEdit} size="sm">
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
