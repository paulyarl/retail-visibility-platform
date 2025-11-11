/**
 * Mobile-Optimized Capacity Indicator
 * Ultra-compact capacity display for mobile headers and tight spaces
 * Shows only critical information with minimal visual footprint
 * 
 * Usage:
 * <MobileCapacityIndicator tenantId={tenantId} />
 * <MobileCapacityIndicator tenantId={tenantId} showText={false} />
 */

import { useSubscriptionUsage } from '@/hooks/useSubscriptionUsage';
import { Package, Building2 } from 'lucide-react';

interface MobileCapacityIndicatorProps {
  tenantId?: string;
  showText?: boolean;
  className?: string;
}

export default function MobileCapacityIndicator({
  tenantId,
  showText = true,
  className = ''
}: MobileCapacityIndicatorProps) {
  const { usage, loading, error } = useSubscriptionUsage(tenantId);

  if (loading || error || !usage) {
    return null;
  }

  // Only show if there are warnings (80%+ usage)
  const showSkuWarning = !usage.skuIsUnlimited && usage.skuPercent >= 80;
  const showLocationWarning = !usage.locationIsUnlimited && usage.locationPercent >= 80;
  
  if (!showSkuWarning && !showLocationWarning) {
    return null;
  }

  // Determine the most critical status
  const criticalPercent = Math.max(
    showSkuWarning ? usage.skuPercent : 0,
    showLocationWarning ? usage.locationPercent : 0
  );

  const getStatusColor = () => {
    if (criticalPercent >= 100) return 'text-red-600 bg-red-100';
    if (criticalPercent >= 90) return 'text-orange-600 bg-orange-100';
    return 'text-yellow-600 bg-yellow-100';
  };

  const getStatusDot = () => {
    if (criticalPercent >= 100) return 'bg-red-500';
    if (criticalPercent >= 90) return 'bg-orange-500';
    return 'bg-yellow-500';
  };

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      {/* Critical status dot */}
      <div className={`w-2 h-2 rounded-full ${getStatusDot()}`} />
      
      {showText && (
        <span className="text-xs text-neutral-600">
          {criticalPercent}%
        </span>
      )}
      
      {/* Icons for what's at capacity */}
      <div className="inline-flex items-center gap-0.5">
        {showSkuWarning && (
          <Package className="w-3 h-3 text-neutral-500" />
        )}
        {showLocationWarning && (
          <Building2 className="w-3 h-3 text-neutral-500" />
        )}
      </div>
    </div>
  );
}
