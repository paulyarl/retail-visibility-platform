'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { RefreshCw, Search, TrendingUp, MousePointerClick, DollarSign, Package, MapPin, ShieldCheck } from 'lucide-react';
import WholesaleMatchingService, { type SupplierMatch, type WholesaleDashboardData } from '@/services/WholesaleMatchingService';
import { useWholesaleMatchingCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import { OrderBulkButton } from '@/components/items/wholesale/OrderBulkButton';
import { BrandPartnerClaimForm } from '@/components/items/wholesale/BrandPartnerClaimForm';

interface WholesaleDashboardClientProps {
  tenantId: string;
}

export default function WholesaleDashboardClient({ tenantId }: WholesaleDashboardClientProps) {
  const { data: capability } = useWholesaleMatchingCapability(tenantId);
  const [dashboard, setDashboard] = useState<WholesaleDashboardData | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, supps] = await Promise.all([
        WholesaleMatchingService.getDashboard(tenantId),
        WholesaleMatchingService.listSuppliers(tenantId, 100, 0),
      ]);
      setDashboard(dash);
      setSuppliers(supps.items);
    } catch {
      setDashboard(null);
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredSuppliers = suppliers.filter((s) => {
    const matchesSearch = !searchQuery ||
      s.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.gtin.includes(searchQuery);
    const matchesRegion = regionFilter === 'all' || s.region === regionFilter;
    return matchesSearch && matchesRegion;
  });

  const regions = Array.from(new Set(suppliers.map((s) => s.region).filter(Boolean)));

  if (!capability || !capability.enabled || capability.tier === 'none') {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <h1 className="text-2xl font-bold mb-4">Wholesale & Suppliers</h1>
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-lg font-medium mb-2">Wholesale Matching Not Available</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Upgrade to a paid plan to access wholesale supplier matching, Faire search, and affiliate link tracking.
            </p>
            <Button variant="secondary" disabled>
              Upgrade Plan
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
          <h1 className="text-2xl font-bold">Wholesale & Suppliers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage supplier matches and track affiliate earnings
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Capability Badge */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="capitalize">
          Tier: {capability.tier}
        </Badge>
        {capability.canSearchFaire && (
          <Badge variant="default">Faire Search Enabled</Badge>
        )}
        {capability.canBuildAffiliateLink && (
          <Badge variant="default">Affiliate Links Enabled</Badge>
        )}
        {capability.isFlexible && (
          <Badge variant="default">Flexible</Badge>
        )}
      </div>

      {/* Analytics Summary Cards */}
      {dashboard && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <MousePointerClick className="h-4 w-4" />
                Total Clicks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboard.analytics.total_clicks}</div>
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
              <div className="text-2xl font-bold">{dashboard.analytics.converted}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                Total Commission
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {WholesaleMatchingService.formatCurrency(dashboard.analytics.total_commission)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <Package className="h-4 w-4" />
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboard.analytics.pending}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Supplier Table */}
      <Card>
        <CardHeader>
          <CardTitle>Supplier Matches</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Search by supplier name or GTIN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="px-3 py-2 border border-neutral-300 rounded-lg bg-background text-sm"
            >
              <option value="all">All Regions</option>
              {regions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="h-6 w-6 mx-auto animate-spin mb-2" />
              Loading suppliers...
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2" />
              No supplier matches found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Supplier</th>
                    <th className="pb-2 pr-4 font-medium">GTIN</th>
                    <th className="pb-2 pr-4 font-medium">Type</th>
                    <th className="pb-2 pr-4 font-medium">MOQ</th>
                    <th className="pb-2 pr-4 font-medium">Region</th>
                    <th className="pb-2 pr-4 font-medium">Claim</th>
                    <th className="pb-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map((s) => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">{s.supplier_name}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{s.gtin}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{s.supplier_type}</td>
                      <td className="py-3 pr-4">{s.moq}</td>
                      <td className="py-3 pr-4">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {s.region}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant="secondary" className="text-xs capitalize">
                          {s.claim_type}
                        </Badge>
                      </td>
                      <td className="py-3">
                        {capability.canBuildAffiliateLink && s.external_link ? (
                          <OrderBulkButton
                            tenantId={tenantId}
                            supplier={s}
                            gtin={s.gtin}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Brand Partner Claim Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Submit Brand Partner Claim
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BrandPartnerClaimForm />
        </CardContent>
      </Card>
    </div>
  );
}
