/**
 * GoogleSourceBadge — per-item Google attribution badge for GBP content
 * surfaced on public pages (Subsystems 6+7 Google Policy Note).
 *
 * Variants:
 *   - "Reviewed on Google"   (per review)
 *   - "Posted on Google"     (per local post)
 *   - "Photos from Google"   (photo gallery)
 */
export function GoogleSourceBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z" />
      </svg>
      {label}
    </span>
  );
}
