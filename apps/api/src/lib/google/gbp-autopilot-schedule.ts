/**
 * GBP review-autopilot scheduling (Sprint D3, spec §4.3).
 *
 * `autopilot_due_at` = detection time + jitter(2–72h), clamped to the
 * tenant's `business_hours_list.periods` window — a reply should never go
 * out at 3am. When the tenant has no configured hours the jittered time is
 * returned as-is.
 */

const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export interface BusinessHourPeriod {
  day: string;
  open: string; // '09:00'
  close: string; // '17:00'
}

const MIN_JITTER_MS = 2 * 60 * 60 * 1000;
const MAX_JITTER_MS = 72 * 60 * 60 * 1000;

export function computeAutopilotDue(detectedAt: Date, periods?: BusinessHourPeriod[] | null): Date {
  const jitter = MIN_JITTER_MS + Math.random() * (MAX_JITTER_MS - MIN_JITTER_MS);
  let due = new Date(detectedAt.getTime() + jitter);
  if (!periods?.length) return due;

  return clampToBusinessHours(due, periods);
}

/**
 * Move `due` forward to the next open window if it lands outside business
 * hours. Day names match the periods jsonb convention ({day:'MONDAY'}).
 * Gives up after 8 days and returns the original time (tenant may have
 * sparse/empty hours — better to reply than drop the review).
 */
export function clampToBusinessHours(due: Date, periods: BusinessHourPeriod[]): Date {
  for (let offset = 0; offset <= 7; offset++) {
    const candidateDay = new Date(due);
    candidateDay.setDate(candidateDay.getDate() + offset);

    const dayName = DAY_NAMES[candidateDay.getDay()];
    const dayPeriods = periods
      .filter((p) => p.day === dayName)
      .sort((a, b) => a.open.localeCompare(b.open));
    if (!dayPeriods.length) continue;

    for (const period of dayPeriods) {
      const [openH, openM] = period.open.split(':').map(Number);
      const [closeH, closeM] = period.close.split(':').map(Number);

      const windowStart = new Date(candidateDay);
      windowStart.setHours(openH, openM, 0, 0);
      const windowEnd = new Date(candidateDay);
      windowEnd.setHours(closeH, closeM, 0, 0);

      if (due < windowStart) return windowStart; // earlier same day → push to open
      if (due >= windowStart && due < windowEnd) return due; // inside → keep
      // past this window → try the next period / next day
    }
  }
  return due;
}
