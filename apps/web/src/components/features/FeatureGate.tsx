/**
 * Feature Gate Components
 * 
 * Reusable components for implementing consistent feature gating across the platform.
 */

import React from 'react';
import { useFeatureGate, type FeatureOperation as FeatureOperationKey } from '@/hooks/useFeatureGate';
import { FEATURE_OPERATIONS, type FeatureOperation } from '@/lib/features/FeatureGateSystem';
// import { Button } from '@/components/ui/button';
// import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  Lock, 
  ArrowUp, 
  Crown,
  Settings,
  ShoppingCart,
  Package,
  BarChart3,
  Palette,
  Plug,
  Layout
} from 'lucide-react';
import { Badge } from '../ui';
// import { Button } from '@mantine/core';
// import { Badge,Button } from '../ui';

// ==================== FEATURE GATE WRAPPER ====================

interface FeatureGateProps {
  operation: FeatureOperationKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgradePrompt?: boolean;
  className?: string;
}

/**
 * Main component for feature gating
 * Wraps children with feature access checks
 */
export function FeatureGate({ 
  operation: operationKey, 
  children, 
  fallback, 
  showUpgradePrompt = true,
  className = ''
}: FeatureGateProps) {
  const { hasAccess, accessDeniedReason, canUpgrade } = useFeatureGate(operationKey);
  // Get operation details for display
  const operation: FeatureOperation | undefined = FEATURE_OPERATIONS[operationKey];
  
  if (!operation) {
    return <div className="p-4 border border-red-200 rounded-lg text-red-700">Unknown operation: {operationKey}</div>;
  }
  
  if (hasAccess) {
    return <div className={className}>{children}</div>;
  }
  
  if (fallback) {
    return <div className={className}>{fallback}</div>;
  }
  
  if (showUpgradePrompt) {
    return (
      <div className={className}>
        <FeatureGatePrompt 
          reason={accessDeniedReason}
          canUpgrade={canUpgrade}
          requiredTier={operation.tierRequirement}
          operation={operation}
        />
      </div>
    );
  }
  
  return null;
}

// ==================== FEATURE GATE PROMPT ====================

interface FeatureGatePromptProps {
  reason: string | null;
  canUpgrade: boolean;
  requiredTier: string;
  operation: FeatureOperation;
  compact?: boolean;
}

/**
 * Component shown when feature access is denied
 */
export function FeatureGatePrompt({ 
  reason, 
  canUpgrade, 
  requiredTier, 
  operation,
  compact = false 
}: FeatureGatePromptProps) {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'product': return <Package className="w-4 h-4" />;
      case 'commerce': return <ShoppingCart className="w-4 h-4" />;
      case 'analytics': return <BarChart3 className="w-4 h-4" />;
      case 'branding': return <Palette className="w-4 h-4" />;
      case 'integration': return <Plug className="w-4 h-4" />;
      case 'ui': return <Layout className="w-4 h-4" />;
      default: return <Settings className="w-4 h-4" />;
    }
  };
  
  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high': return 'text-red-600 border-red-200 bg-red-50';
      case 'medium': return 'text-amber-600 border-amber-200 bg-amber-50';
      case 'low': return 'text-blue-600 border-blue-200 bg-blue-50';
      default: return 'text-gray-600 border-gray-200 bg-gray-50';
    }
  };
  
  if (compact) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 bg-gray-50">
        <Lock className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-600">{reason}</span>
        {canUpgrade && (
          // <Button size="sm" variant="outline">
          //   <Upgrade className="w-3 h-3 mr-1" />
          //   Upgrade
          // </Button>
          <button className="inline-flex items-center px-2 py-1 text-xs border border-gray-300 rounded-md hover:bg-gray-50">
            <ArrowUp className="w-3 h-3 mr-1" />
            Upgrade
          </button>
        )}
      </div>
    );
  }
  
  return (
    <div className={`p-4 rounded-lg border ${getRiskColor(operation.riskLevel)}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {getCategoryIcon(operation.category)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-medium text-gray-900">Feature Not Available</h4>
            <Badge variant="outline" className="text-xs">
              {operation.riskLevel} risk
            </Badge>
          </div>
          
          <p className="text-sm text-gray-600 mb-3">
            {operation.description}
          </p>
          
          <div className="space-y-2">
            {reason && (
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>{reason}</span>
              </div>
            )}
            
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Crown className="w-4 h-4" />
              <span>Requires {requiredTier} tier or higher</span>
            </div>
          </div>
          
          {canUpgrade && (
            <div className="mt-4 pt-3 border-t border-gray-200">
              <button className="w-full inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700">
                <ArrowUp className="w-4 h-4 mr-2" />
                Upgrade to {requiredTier}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== FEATURE GATE BUTTON ====================

interface FeatureGateButtonProps {
  operation: FeatureOperationKey;
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg';
  disabled?: boolean;
  className?: string;
  showUpgradePrompt?: 'tooltip' | 'modal' | 'none';
}

/**
 * Button with automatic feature gating
 */
export function FeatureGateButton({
  operation,
  children,
  onClick,
  variant = 'default',
  size = 'default',
  disabled = false,
  className = '',
  showUpgradePrompt = 'tooltip'
}: FeatureGateButtonProps) {
  const { hasAccess, accessDeniedReason, canUpgrade } = useFeatureGate(operation);
  
  const isDisabled = disabled || !hasAccess;
  const title = isDisabled ? accessDeniedReason || undefined : undefined;
  
  if (showUpgradePrompt === 'modal' && !hasAccess && canUpgrade) {
    return (
      <FeatureGate operation={operation} showUpgradePrompt>
        <button
          onClick={onClick}
          disabled={disabled}
          className={className}
        >
          {children}
        </button>
      </FeatureGate>
    );
  }
  
  return (
    <button
      onClick={hasAccess ? onClick : undefined}
      disabled={isDisabled}
      title={title}
      className={className}
    >
      {children}
    </button>
  );
}

// ==================== FEATURE GATE BADGE ====================

interface FeatureGateBadgeProps {
  operation: FeatureOperationKey;
  showTooltip?: boolean;
  variant?: 'default' | 'outline' | 'secondary';
}

/**
 * Badge showing feature tier requirement
 */
export function FeatureGateBadge({ 
  operation, 
  showTooltip = true,
  variant = 'outline'
}: FeatureGateBadgeProps) {
  const { requiredTier, operation: op } = useFeatureGate(operation);
  
  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'discovery': return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'starter': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'storefront': return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'commitment':
      case 'ecommerce': return 'bg-green-100 text-green-700 border-green-300';
      case 'professional':
      case 'omnichannel': return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'enterprise': return 'bg-red-100 text-red-700 border-red-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };
  
  const badge = (
    <Badge 
      variant={variant} 
      className={`${getTierColor(requiredTier)} text-xs`}
    >
      {requiredTier.toUpperCase()}
    </Badge>
  );
  
  if (!showTooltip) {
    return badge;
  }
  
  return (
    <div title={`${op.description} - Requires ${requiredTier} tier`}>
      {badge}
    </div>
  );
}

// ==================== FEATURE GATE TOOLTIP ====================

interface FeatureGateTooltipProps {
  operation: FeatureOperationKey;
  children: React.ReactNode;
  permissionType?: string;
  actionLabel?: string;
}

/**
 * Tooltip that shows feature access information
 */
export function FeatureGateTooltip({ 
  operation, 
  children, 
  permissionType,
  actionLabel 
}: FeatureGateTooltipProps) {
  const { hasAccess, accessDeniedReason, requiredTier, operation: op } = useFeatureGate(operation);
  
  if (hasAccess) {
    return <>{children}</>;
  }
  
  return (
    <div className="relative group">
      <div className="opacity-75 cursor-not-allowed">
        {children}
      </div>
      
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
        <div className="font-medium mb-1">{op.description}</div>
        <div className="text-gray-300 text-xs">
          {accessDeniedReason}
        </div>
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
          <div className="border-4 border-transparent border-t-gray-900"></div>
        </div>
      </div>
    </div>
  );
}

// ==================== FEATURE GATE GRID ====================

interface FeatureGateGridProps {
  operations: FeatureOperationKey[];
  columns?: number;
  showDescriptions?: boolean;
  className?: string;
}

/**
 * Grid showing multiple feature gates and their status
 */
export function FeatureGateGrid({ 
  operations, 
  columns = 3, 
  showDescriptions = true,
  className = ''
}: FeatureGateGridProps) {
  const results = operations.map(op => ({ operationKey: op, result: useFeatureGate(op) }));
  
  return (
    <div className={`grid gap-4 ${className}`} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {results.map(({ operationKey, result }) => (
        <div key={operationKey} className="p-3 border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm">{result.operation.description}</h4>
            <FeatureGateBadge operation={operationKey} showTooltip={false} />
          </div>
          
          {showDescriptions && (
            <p className="text-xs text-gray-600 mb-2">
              {result.operation.category} • {result.operation.riskLevel} risk
            </p>
          )}
          
          <div className="flex items-center gap-2">
            {result.hasAccess ? (
              <div className="flex items-center gap-1 text-green-600 text-xs">
                <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                Available
              </div>
            ) : (
              <div className="flex items-center gap-1 text-red-600 text-xs">
                <Lock className="w-3 h-3" />
                {result.accessDeniedReason}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
