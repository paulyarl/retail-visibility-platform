/**
 * Creation-Time Capacity Warning Component
 * Shows proactive capacity warnings during creation flows
 * Prevents users from hitting limits unexpectedly
 * 
 * Usage:
 * <CreationCapacityWarning type="sku" tenantId={tenantId} />
 * <CreationCapacityWarning type="location" />
 * <CreationCapacityWarning type="both" tenantId={tenantId} />
 */

import { useSubscriptionUsage } from '@/hooks/useSubscriptionUsage';
import { Card, CardContent, Badge, Button } from '@/components/ui';
import { AlertTriangle, Package, Building2, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

interface CreationCapacityWarningProps {
  type: 'sku' | 'location' | 'both';
  tenantId?: string;
  className?: string;
  showUpgradeLink?: boolean;
  onClose?: () => void;
}

export default function CreationCapacityWarning({
  type,
  tenantId,
  className = '',
  showUpgradeLink = true,
  onClose
}: CreationCapacityWarningProps) {
  const { usage, loading, error } = useSubscriptionUsage(tenantId);

  if (loading || error || !usage) {
    return null;
  }

  // Determine what warnings to show
  const showSkuWarning = (type === 'sku' || type === 'both') && 
    !usage.skuIsUnlimited && usage.skuPercent >= 80;
  
  const showLocationWarning = (type === 'location' || type === 'both') && 
    !usage.locationIsUnlimited && usage.locationPercent >= 80;

  // Don't show if no warnings needed
  if (!showSkuWarning && !showLocationWarning) {
    return null;
  }

  const getWarningLevel = () => {
    const maxPercent = Math.max(
      showSkuWarning ? usage.skuPercent : 0,
      showLocationWarning ? usage.locationPercent : 0
    );
    
    if (maxPercent >= 100) return 'critical';
    if (maxPercent >= 90) return 'severe';
    return 'warning';
  };

  const warningLevel = getWarningLevel();
  
  const getWarningColors = () => {
    switch (warningLevel) {
      case 'critical':
        return {
          border: 'border-red-200',
          bg: 'bg-red-50',
          text: 'text-red-800',
          icon: 'text-red-600',
          badge: 'bg-red-100 text-red-800'
        };
      case 'severe':
        return {
          border: 'border-orange-200',
          bg: 'bg-orange-50',
          text: 'text-orange-800',
          icon: 'text-orange-600',
          badge: 'bg-orange-100 text-orange-800'
        };
      default:
        return {
          border: 'border-yellow-200',
          bg: 'bg-yellow-50',
          text: 'text-yellow-800',
          icon: 'text-yellow-600',
          badge: 'bg-yellow-100 text-yellow-800'
        };
    }
  };

  const colors = getWarningColors();

  const getWarningTitle = () => {
    if (warningLevel === 'critical') {
      return 'Capacity Limit Reached';
    }
    if (warningLevel === 'severe') {
      return 'Approaching Capacity Limit';
    }
    return 'Capacity Warning';
  };

  const getWarningMessage = () => {
    const messages = [];
    
    if (showSkuWarning) {
      if (usage.skuPercent >= 100) {
        messages.push(`You've reached your product limit (${usage.skuUsage}/${usage.skuLimit})`);
      } else {
        messages.push(`You're using ${usage.skuPercent}% of your product capacity (${usage.skuUsage}/${usage.skuLimit})`);
      }
    }
    
    if (showLocationWarning) {
      if (usage.locationPercent >= 100) {
        messages.push(`You've reached your location limit (${usage.locationUsage}/${usage.locationLimit})`);
      } else {
        messages.push(`You're using ${usage.locationPercent}% of your location capacity (${usage.locationUsage}/${usage.locationLimit})`);
      }
    }
    
    return messages;
  };

  const messages = getWarningMessage();

  return (
    <Card className={`${colors.border} ${colors.bg} ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className={`w-5 h-5 ${colors.icon} shrink-0 mt-0.5`} />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h4 className={`font-semibold ${colors.text}`}>
                {getWarningTitle()}
              </h4>
              <Badge className={colors.badge}>
                {usage.tierName}
              </Badge>
            </div>
            
            <div className="space-y-1 mb-3">
              {messages.map((message, index) => (
                <div key={index} className="flex items-center gap-2">
                  {showSkuWarning && showLocationWarning ? (
                    index === 0 ? (
                      <Package className={`w-4 h-4 ${colors.icon}`} />
                    ) : (
                      <Building2 className={`w-4 h-4 ${colors.icon}`} />
                    )
                  ) : showSkuWarning ? (
                    <Package className={`w-4 h-4 ${colors.icon}`} />
                  ) : (
                    <Building2 className={`w-4 h-4 ${colors.icon}`} />
                  )}
                  <p className={`text-sm ${colors.text}`}>{message}</p>
                </div>
              ))}
            </div>

            {warningLevel === 'critical' && (
              <p className={`text-sm ${colors.text} mb-3`}>
                You may need to upgrade your plan to continue adding {type === 'sku' ? 'products' : type === 'location' ? 'locations' : 'items'}.
              </p>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              {showUpgradeLink && (
                <Link href="/settings/subscription">
                  <Button variant="secondary" size="sm" className="text-xs">
                    Upgrade Plan
                    <ArrowUpRight className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              )}
              
              {onClose && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onClose}
                  className={`text-xs ${colors.text} hover:${colors.bg}`}
                >
                  Dismiss
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
