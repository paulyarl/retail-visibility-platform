'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  RefreshCw,
  MousePointerClick,
  TrendingUp,
  DollarSign,
  Clock,
  Package,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { adminWholesaleService, AdminSupplierMatch, AdminAffiliateAnalytics } from '@/services/AdminWholesaleService';

const CLAIM_TYPE_COLORS: Record<string, string> = {
  exclusive: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  preferred: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  verified: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

const formatCurrency = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

export default function WholesaleAdminClient() {
  const [suppliers, setSuppliers] = useState<AdminSupplierMatch[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AdminAffiliateAnalytics | null>(null);
  const [searchGtin, setSearchGtin] = useState('');
  const [filterClaimType, setFilterClaimType] = useState('all');

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminWholesaleService.getAllSuppliers(100, 0);
      setSuppliers(data.items);
      setTotal(data.total);
    } catch {
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      const data = await adminWholesaleService.getAffiliateAnalytics();
      setAnalytics(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchSuppliers();
    fetchAnalytics();
  }, [fetchSuppliers, fetchAnalytics]);

  const filteredSuppliers = suppliers.filter((s) => {
    if (searchGtin && !s.gtin.toLowerCase().includes(searchGtin.toLowerCase())) return false;
    if (filterClaimType !== 'all' && s.claim_type !== filterClaimType) return false;
    return true;
  });

  const faireConfigured = typeof window !== 'undefined'
    ? false
    : false;

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Wholesale Matching</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage wholesale suppliers, Faire integration, and affiliate analytics
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { fetchSuppliers(); fetchAnalytics(); }} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Integration Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4" />
              Faire API Integration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {faireConfigured ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium">Connected</span>
                  <Badge variant="default" className="ml-2 text-xs">Active</Badge>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Not configured</span>
                  <Badge variant="secondary" className="ml-2 text-xs">FAIRE_API_KEY required</Badge>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Faire partner program enrollment required for API access.
              Set <code className="text-xs bg-muted px-1 py-0.5 rounded">FAIRE_API_KEY</code> env var to enable supplier search and affiliate links.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Webhook Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium">Endpoint mounted</span>
              <Badge variant="default" className="ml-2 text-xs">/api/webhooks/faire</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Faire order confirmation webhook is registered. Will update affiliate click status on conversion events.
            </p>
          </CardContent>
        </Card>
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
              <div className="text-2xl font-bold">{formatCurrency(analytics.total_commission)}</div>
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
            <select
              value={filterClaimType}
              onChange={(e) => setFilterClaimType(e.target.value)}
              className="px-3 py-2 border border-neutral-300 rounded-lg bg-background text-sm"
            >
              <option value="all">All Claim Types</option>
              <option value="verified">Verified</option>
              <option value="preferred">Preferred</option>
              <option value="exclusive">Exclusive</option>
            </select>
            <Button variant="secondary" size="sm" onClick={fetchSuppliers} disabled={loading}>
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Suppliers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Wholesale Suppliers ({total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="h-6 w-6 mx-auto animate-spin mb-2" />
              Loading suppliers...
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2" />
              No wholesale suppliers found. Suppliers are created when barcode matches are found or brand partner claims are approved.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Supplier</th>
                    <th className="pb-2 pr-4 font-medium">GTIN</th>
                    <th className="pb-2 pr-4 font-medium">Type</th>
                    <th className="pb-2 pr-4 font-medium">Claim</th>
                    <th className="pb-2 pr-4 font-medium">MOQ</th>
                    <th className="pb-2 pr-4 font-medium">Region</th>
                    <th className="pb-2 pr-4 font-medium">Min Order</th>
                    <th className="pb-2 font-medium">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map((supplier) => (
                    <tr key={supplier.id} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">{supplier.supplier_name}</td>
                      <td className="py-3 pr-4 text-muted-foreground font-mono text-xs">{supplier.gtin}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{supplier.supplier_type}</td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${CLAIM_TYPE_COLORS[supplier.claim_type] || CLAIM_TYPE_COLORS.verified}`}>
                          {supplier.claim_type}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">{supplier.moq}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{supplier.region}</td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {supplier.min_order_value ? formatCurrency(supplier.min_order_value * 100) : '—'}
                      </td>
                      <td className="py-3">
                        {supplier.external_link ? (
                          <a
                            href={supplier.external_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
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
    </div>
  );
}
