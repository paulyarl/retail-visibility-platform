/**
 * Human-readable description of a rate limit, for the admin dashboard panel.
 *
 * Picks the largest whole unit that divides the window, so a 60s window reads
 * "per minute" and a 3600s window reads "per hour" — the panel previously
 * floored the window to minutes and always appended a plural unit, producing
 * "10 requests per 1 minutes" and "3 requests per 1 hours".
 */
export function describeRateLimit(
  limit: { maxRequests: number; windowMs: number } | null | undefined,
): string {
  if (!limit) return '—';

  const { maxRequests, windowMs } = limit;
  const hours = windowMs / (60 * 60 * 1000);
  const minutes = windowMs / (60 * 1000);

  let amount: number;
  let unit: string;
  if (Number.isInteger(hours)) {
    [amount, unit] = [hours, 'hour'];
  } else if (Number.isInteger(minutes)) {
    [amount, unit] = [minutes, 'minute'];
  } else {
    [amount, unit] = [Math.round(windowMs / 1000), 'second'];
  }

  return `${maxRequests} requests per ${amount === 1 ? unit : `${amount} ${unit}s`}`;
}
