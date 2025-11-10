'use client';

import { CheckCircle2, AlertCircle, Loader2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SquareStatus = 'connected' | 'disconnected' | 'syncing' | 'error';

interface SquareStatusBadgeProps {
  status: SquareStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  onClick?: () => void;
  className?: string;
}

const statusConfig = {
  connected: {
    icon: CheckCircle2,
    label: 'Connected',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  disconnected: {
    icon: XCircle,
    label: 'Disconnected',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
  },
  syncing: {
    icon: Loader2,
    label: 'Syncing',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  error: {
    icon: AlertCircle,
    label: 'Error',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
};

const sizeConfig = {
  sm: {
    container: 'px-2 py-1 text-xs',
    icon: 'h-3 w-3',
    gap: 'gap-1',
  },
  md: {
    container: 'px-3 py-1.5 text-sm',
    icon: 'h-4 w-4',
    gap: 'gap-1.5',
  },
  lg: {
    container: 'px-4 py-2 text-base',
    icon: 'h-5 w-5',
    gap: 'gap-2',
  },
};

export function SquareStatusBadge({
  status,
  size = 'md',
  showLabel = true,
  onClick,
  className,
}: SquareStatusBadgeProps) {
  const config = statusConfig[status];
  const sizeStyles = sizeConfig[size];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border font-medium transition-colors',
        config.color,
        config.bgColor,
        config.borderColor,
        sizeStyles.container,
        sizeStyles.gap,
        onClick && 'cursor-pointer hover:opacity-80',
        className
      )}
      onClick={onClick}
    >
      <Icon
        className={cn(
          sizeStyles.icon,
          status === 'syncing' && 'animate-spin'
        )}
      />
      {showLabel && <span>{config.label}</span>}
    </div>
  );
}
