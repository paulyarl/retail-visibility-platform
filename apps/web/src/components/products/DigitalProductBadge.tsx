/**
 * Digital Product Badge Component
 * Displays a badge indicating product type (digital, hybrid, physical)
 * with optional delivery method and access information
 */

import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { Download, Key, Link as LinkIcon, Clock, Package, Layers } from 'lucide-react';

export interface DigitalProductBadgeProps {
  productType: 'physical' | 'digital' | 'hybrid';
  deliveryMethod?: 'direct_download' | 'license_key' | 'external_link' | 'access_grant';
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showDeliveryMethod?: boolean;
  accessDurationDays?: number;
  downloadLimit?: number;
  className?: string;
}

const deliveryMethodConfig = {
  direct_download: {
    label: 'Direct Download',
    icon: Download,
    variant: 'info' as const,
  },
  license_key: {
    label: 'License Key',
    icon: Key,
    variant: 'warning' as const,
  },
  external_link: {
    label: 'External Link',
    icon: LinkIcon,
    variant: 'secondary' as const,
  },
  access_grant: {
    label: 'Access Grant',
    icon: Clock,
    variant: 'success' as const,
  },
};

const productTypeConfig = {
  physical: {
    label: 'Physical',
    icon: Package,
    variant: 'secondary' as const,
  },
  digital: {
    label: 'Digital',
    icon: Download,
    variant: 'info' as const,
  },
  hybrid: {
    label: 'Hybrid',
    icon: Layers,
    variant: 'success' as const,
  },
};

export function DigitalProductBadge({
  productType,
  deliveryMethod,
  size = 'md',
  showIcon = true,
  showDeliveryMethod = false,
  accessDurationDays,
  downloadLimit,
  className = '',
}: DigitalProductBadgeProps) {
  const typeConfig = productTypeConfig[productType];
  const deliveryConfig = deliveryMethod ? deliveryMethodConfig[deliveryMethod] : null;
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-0.5',
    lg: 'text-sm px-3 py-1',
  };

  const iconSizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  const TypeIcon = typeConfig.icon;
  const DeliveryIcon = deliveryConfig?.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {/* Product Type Badge */}
      <Badge 
        variant={typeConfig.variant}
        className={`${sizeClasses[size]} inline-flex items-center gap-1`}
      >
        {showIcon && <TypeIcon className={iconSizeClasses[size]} />}
        <span>{typeConfig.label}</span>
      </Badge>

      {/* Delivery Method Badge */}
      {showDeliveryMethod && deliveryConfig && DeliveryIcon && (
        <Badge 
          variant={deliveryConfig.variant}
          className={`${sizeClasses[size]} inline-flex items-center gap-1`}
        >
          {showIcon && <DeliveryIcon className={iconSizeClasses[size]} />}
          <span>{deliveryConfig.label}</span>
        </Badge>
      )}

      {/* Access Duration Indicator */}
      {accessDurationDays !== undefined && accessDurationDays > 0 && (
        <Badge 
          variant="outline"
          className={`${sizeClasses[size]} inline-flex items-center gap-1`}
        >
          <Clock className={iconSizeClasses[size]} />
          <span>{accessDurationDays} days</span>
        </Badge>
      )}

      {/* Download Limit Indicator */}
      {downloadLimit !== undefined && downloadLimit > 0 && (
        <Badge 
          variant="outline"
          className={`${sizeClasses[size]} inline-flex items-center gap-1`}
        >
          <Download className={iconSizeClasses[size]} />
          <span>{downloadLimit} downloads</span>
        </Badge>
      )}
    </div>
  );
}

/**
 * Compact version for tight spaces
 */
export function DigitalProductBadgeCompact({
  productType,
  className = '',
}: {
  productType: 'physical' | 'digital' | 'hybrid';
  className?: string;
}) {
  const config = productTypeConfig[productType];
  const Icon = config.icon;

  return (
    <Badge 
      variant={config.variant}
      className={`inline-flex items-center gap-1 text-xs ${className}`}
    >
      <Icon className="h-3 w-3" />
      <span>{config.label}</span>
    </Badge>
  );
}

/**
 * Icon-only version for very tight spaces
 */
export function DigitalProductIcon({
  productType,
  size = 'md',
  className = '',
}: {
  productType: 'physical' | 'digital' | 'hybrid';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const config = productTypeConfig[productType];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <span 
      className={`inline-flex items-center justify-center ${className}`}
      title={config.label}
    >
      <Icon className={`${sizeClasses[size]} text-${config.variant === 'info' ? 'blue' : config.variant === 'success' ? 'green' : 'gray'}-600`} />
    </span>
  );
}

/**
 * Status indicator for digital access
 */
export function DigitalAccessStatus({
  status,
  expiresAt,
  downloadCount,
  downloadLimit,
  size = 'md',
  className = '',
}: {
  status: 'active' | 'expired' | 'revoked' | 'exhausted';
  expiresAt?: Date | string;
  downloadCount?: number;
  downloadLimit?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const statusConfig = {
    active: { label: 'Active', variant: 'success' as const },
    expired: { label: 'Expired', variant: 'error' as const },
    revoked: { label: 'Revoked', variant: 'destructive' as const },
    exhausted: { label: 'Downloads Exhausted', variant: 'warning' as const },
  };

  const config = statusConfig[status];
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-0.5',
    lg: 'text-sm px-3 py-1',
  };

  const isExpiringSoon = expiresAt && status === 'active' && 
    new Date(expiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000; // 7 days

  const isNearLimit = downloadLimit && downloadCount !== undefined && 
    downloadCount >= downloadLimit * 0.8;

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <Badge 
        variant={isExpiringSoon ? 'warning' : config.variant}
        className={sizeClasses[size]}
      >
        {config.label}
      </Badge>

      {/* Expiration Warning */}
      {isExpiringSoon && expiresAt && (
        <Badge 
          variant="warning"
          className={`${sizeClasses[size]} inline-flex items-center gap-1`}
        >
          <Clock className="h-3 w-3" />
          <span>Expires {new Date(expiresAt).toLocaleDateString()}</span>
        </Badge>
      )}

      {/* Download Progress */}
      {downloadLimit !== undefined && downloadCount !== undefined && (
        <Badge 
          variant={isNearLimit ? 'warning' : 'outline'}
          className={`${sizeClasses[size]} inline-flex items-center gap-1`}
        >
          <Download className="h-3 w-3" />
          <span>{downloadCount}/{downloadLimit}</span>
        </Badge>
      )}
    </div>
  );
}

export default DigitalProductBadge;
