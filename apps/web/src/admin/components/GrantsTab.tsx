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
} from '@/services/AdminFeaturePurchasesService';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Gift, QrCode, Ticket, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';

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

  const totalGrants = grants.length;
  const activeGrants = grants.filter((g) => g.status === 'active').length;
  const expiredGrants = grants.filter((g) => g.status === 'expired').length;
  const fullyClaimedGrants = grants.filter((g) => g.status === 'fully_claimed').length;
  const totalClaims = grants.reduce((sum, g) => sum + (g.claims_count ?? 0), 0);
  const totalComplimentary = complimentaryGrants.length;
  const activeComplimentary = complimentaryGrants.filter((g) => g.status === 'active').length;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
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
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {grants.map((grant) => {
                const isExpanded = expandedRows.has(grant.id);
                const hasClaims = (grant.claims?.length ?? 0) > 0;
                return (
                  <React.Fragment key={grant.id}>
                    <tr className="hover:bg-neutral-50 cursor-pointer" onClick={() => hasClaims && toggleRow(grant.id)}>
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
                      </td>
                    </tr>
                    {isExpanded && hasClaims && (
                      <tr className="bg-neutral-50/50">
                        <td colSpan={9} className="px-8 py-3">
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
                    <Badge variant="secondary" className={grant.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                      {grant.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
