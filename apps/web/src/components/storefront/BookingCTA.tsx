'use client';

import React from 'react';
import Link from 'next/link';

interface BookingCTAProps {
  service: any;
  tenantId: string;
  layoutVariant?: 'classic' | 'editorial' | 'immersive';
}

export function BookingCTA({ service, tenantId, layoutVariant = 'classic' }: BookingCTAProps) {
  const bookingUrl = service.metadata?.bookingUrl || service.metadata?.booking_url || service.bookingUrl;
  const bookingPhone = service.metadata?.bookingPhone || service.metadata?.booking_phone || service.bookingPhone;
  const contactUrl = `/tenant/${tenantId}#contact`;

  const baseClass =
    layoutVariant === 'immersive'
      ? 'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors'
      : layoutVariant === 'editorial'
        ? 'inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors'
        : 'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors';

  if (bookingUrl) {
    return (
      <a
        href={bookingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${baseClass} bg-primary-600 text-white hover:bg-primary-700`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
        Book Service
      </a>
    );
  }

  if (bookingPhone) {
    return (
      <a
        href={`tel:${bookingPhone}`}
        className={`${baseClass} bg-primary-600 text-white hover:bg-primary-700`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
        </svg>
        Call: {bookingPhone}
      </a>
    );
  }

  return (
    <Link href={contactUrl} className={`${baseClass} bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-700 dark:hover:bg-neutral-200`}>
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
      </svg>
      Contact to Book
    </Link>
  );
}
