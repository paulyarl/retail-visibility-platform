'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { RefreshCw, Check, X, ShieldCheck, MousePointerClick, TrendingUp, DollarSign, Clock } from 'lucide-react';
import { adminBrandPartnerService, AdminBrandPartnerClaim } from '@/services/AdminBrandPartnerService';
import { adminWholesaleService, AdminAffiliateAnalytics, AdminSupplierMatch } from '@/services/AdminWholesaleService';

const CLAIM_TYPE_COLORS: Record<string, string> = {
  exclusive: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  preferred: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  verified: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

export default function BrandPartnerAdminClient() {
  const [claims, setClaims] = useState<AdminBrandPartnerClaim[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchGtin, setSearchGtin] = useState('');
  const [searchBrand, setSearchBrand] = useState('');
  const [filterApproved, setFilterApproved] = useState('all');
  const [analytics, setAnalytics] = useState<AdminAffiliateAnalytics | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminBrandPartnerService.listClaims({
        gtin: searchGtin || undefined,
        brand_name: searchBrand || undefined,
        approved: filterApproved,
        limit: 100,
      });
      if (data.success) {
        setClaims(data.claims || []);
        setTotal(data.total || 0);
      }
    } catch {
      setClaims([]);
    } finally {
      setLoading(false);
    }
  }, [searchGtin, searchBrand, filterApproved]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const data = await adminWholesaleService.getAffiliateAnalytics();
      setAnalytics(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchClaims();
    fetchAnalytics();
  }, [fetchClaims, fetchAnalytics]);

  const handleApprove = async (claimId: string) => {
    setActionLoading(claimId);
    try {
      const success = await adminBrandPartnerService.approveClaim(claimId);
      if (success) {
        setClaims((prev) =>
          prev.map((c) => (c.id === claimId ? { ...c, admin_approved: true } : c))
        );
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (claimId: string) => {
    setActionLoading(claimId);
    try {
      const success = await adminBrandPartnerService.rejectClaim(claimId);
      if (success) {
        setClaims((prev) => prev.filter((c) => c.id !== claimId));
        setTotal((prev) => Math.max(0, prev - 1));
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Brand Partner Claims</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review, approve, and reject brand partner claims across all tenants
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { fetchClaims(); fetchAnalytics(); }} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Affiliate Analytics Summary */}
      {analytics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <MousePointerClick className="h-4 w-4" />
                Total Clicks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.total_clicks}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                Converted
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.converted}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                Commission
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(analytics.total_commission / 100)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Filter by GTIN..."
                value={searchGtin}
                onChange={(e) => setSearchGtin(e.target.value)}
                className="max-w-xs"
              />
            </div>
            <div className="flex-1">
              <Input
                placeholder="Filter by brand name..."
                value={searchBrand}
                onChange={(e) => setSearchBrand(e.target.value)}
                className="max-w-xs"
              />
            </div>
            <select
              value={filterApproved}
              onChange={(e) => setFilterApproved(e.target.value)}
              className="px-3 py-2 border border-neutral-300 rounded-lg bg-background text-sm"
            >
              <option value="all">All Claims</option>
              <option value="false">Pending Only</option>
              <option value="true">Approved Only</option>
            </select>
            <Button variant="secondary" size="sm" onClick={fetchClaims} disabled={loading}>
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Claims Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Claims ({total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="h-6 w-6 mx-auto animate-spin mb-2" />
              Loading claims...
            </div>
          ) : claims.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShieldCheck className="h-8 w-8 mx-auto mb-2" />
              No brand partner claims found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Brand</th>
                    <th className="pb-2 pr-4 font-medium">GTIN</th>
                    <th className="pb-2 pr-4 font-medium">Claim Type</th>
                    <th className="pb-2 pr-4 font-medium">Contact</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((claim) => (
                    <tr key={claim.id} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">{claim.brand_name}</td>
                      <td className="py-3 pr-4 text-muted-foreground font-mono text-xs">{claim.gtin}</td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${CLAIM_TYPE_COLORS[claim.claim_type] || CLAIM_TYPE_COLORS.verified}`}>
                          {claim.claim_type}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground text-xs">
                        {claim.contact_email || '—'}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={claim.admin_approved ? 'default' : 'secondary'} className="text-xs">
                          {claim.admin_approved ? 'Approved' : 'Pending'}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          {!claim.admin_approved && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleApprove(claim.id)}
                              disabled={actionLoading === claim.id}
                              className="h-8 px-2"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Approve
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReject(claim.id)}
                            disabled={actionLoading === claim.id}
                            className="h-8 px-2 text-red-600 hover:text-red-700"
                          >
                            <X className="h-3.5 w-3.5" />
                            Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
