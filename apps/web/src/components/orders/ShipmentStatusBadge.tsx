'use client';

import { Badge } from '@/components/ui/Badge';

export type ShipmentStatus =
  | 'pending'
  | 'label_created'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed_delivery'
  | 'returned'
  | 'cancelled';

interface ShipmentStatusBadgeProps {
  status: ShipmentStatus | string;
  className?: string;
}

const STATUS_CONFIG: Record<ShipmentStatus, { variant: 'default' | 'success' | 'warning' | 'error' | 'info' | 'secondary' | 'outline' | 'destructive'; label: string }> = {
  pending: { variant: 'secondary', label: 'Pending' },
  label_created: { variant: 'info', label: 'Label Created' },
  picked_up: { variant: 'info', label: 'Picked Up' },
  in_transit: { variant: 'warning', label: 'In Transit' },
  out_for_delivery: { variant: 'warning', label: 'Out for Delivery' },
  delivered: { variant: 'success', label: 'Delivered' },
  failed_delivery: { variant: 'error', label: 'Failed Delivery' },
  returned: { variant: 'destructive', label: 'Returned' },
  cancelled: { variant: 'secondary', label: 'Cancelled' },
};

export function ShipmentStatusBadge({ status, className = '' }: ShipmentStatusBadgeProps) {
  const config = STATUS_CONFIG[status as ShipmentStatus] || { variant: 'default' as const, label: status };

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
