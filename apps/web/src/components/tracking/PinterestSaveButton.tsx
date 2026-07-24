'use client';

import { useEffect, useRef } from 'react';

interface PinterestSaveButtonProps {
  /** Optional URL to pin. Defaults to the current page URL. */
  url?: string;
  /** Optional description for the pin. */
  description?: string;
  /** Optional image URL to pin. */
  imageUrl?: string;
  className?: string;
  size?: 'small' | 'large';
}

/**
 * Pinterest Save button using the official Pinterest pinit.js script.
 *
 * Renders an anchor with `data-pin-do="buttonBookmark"` and loads the
 * Pinterest widget script once per page.
 */
export function PinterestSaveButton({
  url,
  description,
  imageUrl,
  className = '',
  size = 'small',
}: PinterestSaveButtonProps) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const existing = document.getElementById('pinterest-pinit-script') as HTMLScriptElement | null;
    if (!existing) {
      const script = document.createElement('script');
      script.id = 'pinterest-pinit-script';
      script.src = 'https://assets.pinterest.com/js/pinit.js';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (typeof (window as any).PinUtils === 'object' && ref.current) {
          (window as any).PinUtils.build(ref.current);
        }
      };
      document.body.appendChild(script);
    } else if ((window as any).PinUtils && ref.current) {
      (window as any).PinUtils.build(ref.current);
    }
  }, []);

  return (
    <a
      ref={ref}
      href="https://www.pinterest.com/pin/create/button/"
      data-pin-do="buttonBookmark"
      data-pin-height={size === 'large' ? '28' : '20'}
      data-pin-custom="true"
      {...(url ? { 'data-pin-url': url } : {})}
      {...(description ? { 'data-pin-description': description } : {})}
      {...(imageUrl ? { 'data-pin-media': imageUrl } : {})}
      className={`inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors ${className}`}
    >
      <svg className="h-4 w-4" fill="#E60023" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
      </svg>
      Save
    </a>
  );
}
