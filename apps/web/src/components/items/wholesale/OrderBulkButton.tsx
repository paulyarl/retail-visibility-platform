'use client';

import { useState } from 'react';
import { ExternalLink, Loader2, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import WholesaleMatchingService, { type SupplierMatch } from '@/services/WholesaleMatchingService';

interface OrderBulkButtonProps {
  tenantId: string;
  supplier: SupplierMatch;
  gtin: string;
  onTrackClick?: (clickId: string) => void;
}

export function OrderBulkButton({ tenantId, supplier, gtin, onTrackClick }: OrderBulkButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (!supplier.external_link) return;
    setLoading(true);
    setError(null);
    try {
      const result = await WholesaleMatchingService.buildAffiliateLink(
        tenantId,
        supplier.id,
        gtin
      );
      if (result) {
        if (onTrackClick) onTrackClick(result.click_id);
        window.open(result.affiliate_url, '_blank', 'noopener,noreferrer');
      } else {
        window.open(supplier.external_link, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create affiliate link');
      window.open(supplier.external_link, '_blank', 'noopener,noreferrer');
    } finally {
      setLoading(false);
    }
  };

  if (!supplier.external_link) return null;

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={handleClick}
        disabled={loading}
        size="sm"
        className="gap-2"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ShoppingCart className="h-4 w-4" />
        )}
        Order Bulk
        <ExternalLink className="h-3 w-3" />
      </Button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

export default OrderBulkButton;
