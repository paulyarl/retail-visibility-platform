/**
 * Trial helpers
 *
 * NOTE: Trial is a subscription STATUS, not a tier. These helpers centralize
 * basic trial-related UI logic.
 */

/**
 * Returns true if the given subscription status represents an active trial.
 */
export function isTrialStatus(status: string | null | undefined): boolean {
  return status === 'trial';
}

/**
 * Formats a trial end date into a human-friendly label for display.
 * Returns null if the input is missing or invalid.
 */
export function getTrialEndLabel(
  trialEndsAt?: string | Date | null,
  locale: string = 'en-US'
): string | null {
  if (!trialEndsAt) return null;

  const date = typeof trialEndsAt === 'string' ? new Date(trialEndsAt) : trialEndsAt;
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
