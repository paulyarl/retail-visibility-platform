'use client';

import { Calendar } from 'lucide-react';

interface ServiceBookingCTAProps {
  product: any;
  layoutVariant?: 'classic' | 'showcase' | 'quick-commerce';
  storefrontType?: string;
}

export function ServiceBookingCTA({
  product,
  layoutVariant = 'classic',
  storefrontType,
}: ServiceBookingCTAProps) {
  const isCompact = layoutVariant === 'quick-commerce';
  const bookingUrl = product.metadata?.bookingUrl || product.metadata?.booking_url;
  const bookingPhone = product.metadata?.bookingPhone || product.metadata?.booking_phone;

  return (
    <div className={`flex flex-col gap-2 ${isCompact ? 'text-xs' : 'text-sm'}`}>
      <div className="flex items-start gap-2 text-neutral-600 dark:text-neutral-400">
        <Calendar size={isCompact ? 14 : 16} className="mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="font-medium text-neutral-900 dark:text-white">Book This Service</p>
          {bookingUrl ? (
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors ${isCompact ? 'text-xs' : 'text-sm'}`}
            >
              <Calendar size={isCompact ? 14 : 16} />
              Book Now
            </a>
          ) : bookingPhone ? (
            <a
              href={`tel:${bookingPhone}`}
              className={`mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors ${isCompact ? 'text-xs' : 'text-sm'}`}
            >
              <Calendar size={isCompact ? 14 : 16} />
              Call to Book: {bookingPhone}
            </a>
          ) : (
            <p className={isCompact ? 'text-xs' : 'text-xs'}>Contact the store to schedule this service.</p>
          )}
        </div>
      </div>
      {storefrontType === 'social' && (
        <p className={`${isCompact ? 'text-xs' : 'text-xs'} text-neutral-500 dark:text-neutral-400 pl-${isCompact ? '5' : '6'}`}>
          Share this service with friends
        </p>
      )}
    </div>
  );
}
