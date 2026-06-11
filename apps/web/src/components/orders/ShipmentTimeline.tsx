'use client';

import {
  Package,
  Tag,
  Truck,
  MapPin,
  Home,
  AlertCircle,
  RotateCcw,
  Ban,
  Circle,
  CheckCircle2,
} from 'lucide-react';

export interface TrackingEvent {
  status: string;
  timestamp: string;
  location?: string;
  description?: string;
}

interface ShipmentTimelineProps {
  events: TrackingEvent[];
  currentStatus?: string;
  className?: string;
}

const STATUS_ORDER: Record<string, number> = {
  pending: 0,
  label_created: 1,
  picked_up: 2,
  in_transit: 3,
  out_for_delivery: 4,
  delivered: 5,
  failed_delivery: -1,
  returned: -2,
  cancelled: -3,
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Circle className="h-4 w-4" />,
  label_created: <Tag className="h-4 w-4" />,
  picked_up: <Package className="h-4 w-4" />,
  in_transit: <Truck className="h-4 w-4" />,
  out_for_delivery: <MapPin className="h-4 w-4" />,
  delivered: <Home className="h-4 w-4" />,
  failed_delivery: <AlertCircle className="h-4 w-4" />,
  returned: <RotateCcw className="h-4 w-4" />,
  cancelled: <Ban className="h-4 w-4" />,
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  label_created: 'Label Created',
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  failed_delivery: 'Failed Delivery',
  returned: 'Returned',
  cancelled: 'Cancelled',
};

function formatEventDate(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return timestamp;
  }
}

export function ShipmentTimeline({ events, currentStatus, className = '' }: ShipmentTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className={`text-sm text-neutral-500 italic ${className}`}>
        No tracking events yet.
      </div>
    );
  }

  // Sort by timestamp descending (newest first)
  const sorted = [...events].sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const currentRank = currentStatus ? STATUS_ORDER[currentStatus] ?? -99 : -99;

  return (
    <div className={`space-y-0 ${className}`}>
      {sorted.map((event, index) => {
        const isFirst = index === 0;
        const eventRank = STATUS_ORDER[event.status] ?? -99;
        const isActive = currentStatus === event.status;
        const isPast = eventRank <= currentRank && eventRank >= 0;
        const isException = eventRank < 0;

        return (
          <div key={index} className="flex gap-3 relative">
            {/* Timeline line */}
            {index < sorted.length - 1 && (
              <div className="absolute left-[11px] top-6 bottom-[-8px] w-[2px] bg-neutral-200" />
            )}

            {/* Icon / dot */}
            <div
              className={`relative z-10 flex items-center justify-center w-6 h-6 rounded-full shrink-0 ${
                isFirst && !isException
                  ? 'bg-green-100 text-green-600'
                  : isException
                    ? 'bg-red-100 text-red-600'
                    : isPast
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-neutral-100 text-neutral-400'
              }`}
            >
              {isFirst && !isException ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                STATUS_ICONS[event.status] || <Circle className="h-4 w-4" />
              )}
            </div>

            {/* Content */}
            <div className="pb-4 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-sm font-medium ${
                    isFirst && !isException
                      ? 'text-green-700'
                      : isException
                        ? 'text-red-700'
                        : isPast
                          ? 'text-blue-700'
                          : 'text-neutral-600'
                  }`}
                >
                  {STATUS_LABELS[event.status] || event.status}
                </span>
                {isActive && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                    Current
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500">{formatEventDate(event.timestamp)}</p>
              {event.location && (
                <p className="text-xs text-neutral-600 mt-0.5">{event.location}</p>
              )}
              {event.description && (
                <p className="text-xs text-neutral-500 mt-0.5">{event.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
