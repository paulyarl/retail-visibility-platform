'use client';

import { Clock } from 'lucide-react';

interface ServiceDurationInfoProps {
  product: any;
  layoutVariant?: 'classic' | 'showcase' | 'quick-commerce';
}

export function ServiceDurationInfo({
  product,
  layoutVariant = 'classic',
}: ServiceDurationInfoProps) {
  const isCompact = layoutVariant === 'quick-commerce';
  const durationMinutes = product.metadata?.durationMinutes || product.metadata?.duration_minutes;
  const sessionLength = product.metadata?.sessionLength || product.metadata?.session_length;
  const availabilitySchedule = product.metadata?.availabilitySchedule || product.metadata?.availability_schedule;

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
  };

  const hasAnyInfo = durationMinutes || sessionLength || availabilitySchedule;

  if (!hasAnyInfo) return null;

  return (
    <div className={`flex items-start gap-2 ${isCompact ? 'text-xs' : 'text-sm'} text-neutral-600 dark:text-neutral-400`}>
      <Clock size={isCompact ? 14 : 16} className="mt-0.5 flex-shrink-0" />
      <div>
        {durationMinutes && (
          <>
            <p className="font-medium">Duration: {formatDuration(durationMinutes)}</p>
          </>
        )}
        {sessionLength && (
          <p className={isCompact ? 'text-xs' : 'text-xs'}>Session: {sessionLength}</p>
        )}
        {availabilitySchedule && (
          <p className={isCompact ? 'text-xs' : 'text-xs'}>Available: {availabilitySchedule}</p>
        )}
        {!durationMinutes && !sessionLength && !availabilitySchedule && (
          <p className="font-medium">Service Session</p>
        )}
      </div>
    </div>
  );
}
