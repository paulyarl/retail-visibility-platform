'use client';

import { useState, useEffect, useCallback } from 'react';
import { Package, Loader2, Store, MapPin, Tag, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import WholesaleMatchingService, { type SupplierMatch, type FaireSearchResult } from '@/services/WholesaleMatchingService';
import { useWholesaleMatchingCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import { OrderBulkButton } from './OrderBulkButton';
import { FindSupplierUpsell } from './FindSupplierUpsell';

interface SupplierMatchSectionProps {
  tenantId: string;
  gtin: string | null;
}

export function SupplierMatchSection({ tenantId, gtin }: SupplierMatchSectionProps) {
  const { data: capability } = useWholesaleMatchingCapability(tenantId);
  const [matches, setMatches] = useState<SupplierMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [faireResults, setFaireResults] = useState<FaireSearchResult[]>([]);
  const [faireLoading, setFaireLoading] = useState(false);
  const [showFaireResults, setShowFaireResults] = useState(false);

  const checkMatch = useCallback(async () => {
    if (!gtin || !capability?.enabled || !capability.canCheckSupplierMatch) {
      setMatches([]);
      return;
    }
    setLoading(true);
    try {
      const result = await WholesaleMatchingService.checkMatch(tenantId, gtin);
      setMatches(result);
    } catch {
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId, gtin, capability]);

  useEffect(() => {
    checkMatch();
  }, [checkMatch]);

  const handleFaireSearch = async () => {
    if (!gtin) return;
    setFaireLoading(true);
    setShowFaireResults(true);
    try {
      const results = await WholesaleMatchingService.searchSuppliers(tenantId, gtin);
      setFaireResults(results);
    } catch {
      setFaireResults([]);
    } finally {
      setFaireLoading(false);
    }
  };

  if (!capability || !capability.enabled || capability.tier === 'none') {
    if (!gtin) return null;
    return (
      <div className="space-y-2">
        <FindSupplierUpsell capability={capability} gtin={gtin} onSearchClick={handleFaireSearch} />
      </div>
    );
  }

  if (!gtin) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Store className="h-4 w-4" />
        Wholesale Supplier Matches
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking supplier matches...
        </div>
      )}

      {!loading && matches.length === 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-dashed text-sm text-muted-foreground">
            <Package className="h-4 w-4 flex-shrink-0" />
            No supplier matches found for this GTIN
          </div>
          {capability.canSearchFaire && (
            <FindSupplierUpsell capability={capability} gtin={gtin} onSearchClick={handleFaireSearch} />
          )}
        </div>
      )}

      {!loading && matches.length > 0 && (
        <div className="space-y-2">
          {matches.map((match) => (
            <Card key={match.id} className="border-border/50">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{match.supplier_name}</span>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {match.claim_type}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        MOQ: {match.moq}
                      </span>
                      {match.min_order_value && (
                        <span>Min order: ${match.min_order_value}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {match.region}
                      </span>
                    </div>
                  </div>
                  {capability.canBuildAffiliateLink && (
                    <OrderBulkButton
                      tenantId={tenantId}
                      supplier={match}
                      gtin={gtin}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showFaireResults && (
        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center gap-2 text-sm font-medium">
            <TrendingUp className="h-4 w-4" />
            Faire Search Results
          </div>
          {faireLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching Faire...
            </div>
          )}
          {!faireLoading && faireResults.length === 0 && (
            <div className="text-sm text-muted-foreground p-2">
              No results from Faire for this barcode
            </div>
          )}
          {!faireLoading && faireResults.length > 0 && (
            <div className="space-y-2">
              {faireResults.map((result, i) => (
                <Card key={i} className="border-border/50">
                  <CardContent className="p-3 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{result.supplier_name}</div>
                        <div className="text-xs text-muted-foreground">{result.brand}</div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>MOQ: {result.moq}</span>
                          {result.wholesale_price && (
                            <span>Wholesale: ${result.wholesale_price}</span>
                          )}
                        </div>
                      </div>
                      {result.product_url && (
                        <a
                          href={result.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline flex items-center gap-1 flex-shrink-0"
                        >
                          View
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SupplierMatchSection;
