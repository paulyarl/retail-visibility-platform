'use client';

import { Search, Lock, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { type WholesaleMatchingState } from '@/services/CapabilityResolutionService';

interface FindSupplierUpsellProps {
  capability: WholesaleMatchingState | null;
  gtin: string | null;
  onSearchClick: () => void;
}

export function FindSupplierUpsell({ capability, gtin, onSearchClick }: FindSupplierUpsellProps) {
  if (!capability || !capability.enabled || capability.tier === 'none') {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-dashed">
        <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">
            Find Supplier via Faire
          </p>
          <p className="text-xs text-muted-foreground/70">
            Upgrade to a paid plan to search for wholesale suppliers
          </p>
        </div>
        <Button variant="ghost" size="sm" disabled className="gap-1">
          <ArrowUpRight className="h-3 w-3" />
          Upgrade
        </Button>
      </div>
    );
  }

  if (!gtin) return null;

  return (
    <Button
      onClick={onSearchClick}
      variant="outline"
      size="sm"
      className="gap-2 w-full"
    >
      <Search className="h-4 w-4" />
      Find Supplier via Faire
    </Button>
  );
}

export default FindSupplierUpsell;
