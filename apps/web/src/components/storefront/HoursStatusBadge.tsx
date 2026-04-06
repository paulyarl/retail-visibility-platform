'use client';

import { Badge as MantineBadge } from '@mantine/core';

export type HoursStatus = 'open' | 'closed' | 'opening-soon' | 'closing-soon' | null;

export interface HoursStatusData {
  status: HoursStatus;
  label?: string;
}

interface HoursStatusBadgeProps {
  status: HoursStatusData | null | undefined;
  showLabel?: boolean;
  animate?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const STATUS_CONFIG: Record<string, {
  color: string;
  variant: 'light' | 'filled' | 'outline' | 'dot';
  emoji: string;
  defaultLabel: string;
  animation: string;
}> = {
  open: {
    color: 'green',
    variant: 'light',
    emoji: '🟢',
    defaultLabel: 'Open',
    animation: 'animate-pulse',
  },
  closed: {
    color: 'red',
    variant: 'light',
    emoji: '🔴',
    defaultLabel: 'Closed',
    animation: 'animate-bounce',
  },
  'opening-soon': {
    color: 'blue',
    variant: 'filled',
    emoji: '🟡',
    defaultLabel: 'Opening',
    animation: 'animate-ping',
  },
  'closing-soon': {
    color: 'orange',
    variant: 'filled',
    emoji: '🟡',
    defaultLabel: 'Closing',
    animation: 'animate-ping',
  },
};

export function HoursStatusBadge({
  status,
  showLabel = true,
  animate = true,
  size = 'xs',
  className = '',
}: HoursStatusBadgeProps) {
  if (!status?.status) return null;

  const config = STATUS_CONFIG[status.status];
  if (!config) return null;

  const animationClass = animate ? config.animation : '';

  return (
    <MantineBadge
      color={config.color}
      variant={config.variant}
      size={size}
      className={`${animationClass} ${className}`}
      title={status.label || config.defaultLabel}
    >
      {config.emoji} {showLabel ? config.defaultLabel : ''}
    </MantineBadge>
  );
}

export default HoursStatusBadge;
