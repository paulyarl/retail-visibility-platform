/**
 * Shared utility for computing store open/closed status
 * Handles both regular and special hours with priority given to special hours
 */

function parseTimeToMinutes(time: string): number | null {
  if (!time) return null;
  const parts = time.split(':');
  if (parts.length !== 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function minutesToLabel(mins: number, timeZone?: string): string {
  const hour = Math.floor(mins / 60);
  const min = mins % 60;
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  const mmStr = min.toString().padStart(2, '0');
  return `${hour12}:${mmStr} ${period}`;
}

export function computeStoreStatus(hours: any): { isOpen: boolean; label: string } | null {
  if (!hours || typeof hours !== 'object') return null;
  const now = new Date();
  const locale = 'en-US';
  const timeZone: string | undefined = typeof hours.timezone === 'string' ? hours.timezone : undefined;
  const weekday = (d: Date) => d.toLocaleDateString(locale, { weekday: 'long', timeZone });
  const todayName = weekday(now);
  
  // Check for special hours (they can override or extend regular hours)
  const todayDate = now.toLocaleDateString('en-CA', { timeZone }); // YYYY-MM-DD format
  const specialHours = hours.special as any[] | undefined;
  const todaySpecials = specialHours?.filter((sh: any) => sh.date === todayDate) || [];
  
  // If any special hour is marked as closed, the store is closed all day
  const closedSpecial = todaySpecials.find((sh: any) => sh.isClosed);
  if (closedSpecial) {
    const note = closedSpecial.note ? ` (${closedSpecial.note})` : '';
    return { isOpen: false, label: `Closed today${note}` };
  }
  
  const regularToday = (hours as any)[todayName];
  
  // Compute "now" in target timezone
  const fmt = new Intl.DateTimeFormat('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: timeZone });
  const parts = fmt.formatToParts(now);
  const hh = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const mm = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  const currentMins = hh * 60 + mm;

  const parseRange = (entry: any): { openM: number; closeM: number } | null => {
    if (!entry) return null;
    const openStr = entry.open || entry.start || entry.from;
    const closeStr = entry.close || entry.end || entry.to;
    const o = parseTimeToMinutes(openStr);
    const c = parseTimeToMinutes(closeStr);
    if (o == null || c == null) return null;
    return { openM: o, closeM: c };
  };

  // Check both regular and special hours for today
  const regularRange = parseRange(regularToday);
  const specialRanges = todaySpecials.map(sp => ({ range: parseRange(sp), note: sp.note })).filter(sr => sr.range !== null);
  
  // Check if currently open in regular hours
  if (regularRange && currentMins >= regularRange.openM && currentMins < regularRange.closeM) {
    return { isOpen: true, label: `Open now • Closes at ${minutesToLabel(regularRange.closeM, timeZone)}` };
  }
  
  // Check if currently open in any special hours
  for (const { range, note } of specialRanges) {
    if (range && currentMins >= range.openM && currentMins < range.closeM) {
      const noteText = note ? ` (${note})` : '';
      return { isOpen: true, label: `Open now${noteText} • Closes at ${minutesToLabel(range.closeM, timeZone)}` };
    }
  }
  
  // Not currently open - check when we open next (regular hours first)
  if (regularRange && currentMins < regularRange.openM) {
    return { isOpen: false, label: `Closed • Opens today at ${minutesToLabel(regularRange.openM, timeZone)}` };
  }
  
  // Check special hours that haven't started yet
  for (const { range, note } of specialRanges) {
    if (range && currentMins < range.openM) {
      const noteText = note ? ` (${note})` : '';
      return { isOpen: false, label: `Closed • Opens today at ${minutesToLabel(range.openM, timeZone)}${noteText}` };
    }
  }
  
  // After both regular and special hours close, find next open day
  // Find next open day within next 7 days
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const name = weekday(d);
    const r = parseRange((hours as any)[name]);
    if (r) {
      const dayLabel = i === 1 ? 'tomorrow' : name;
      return { isOpen: false, label: `Closed • Opens ${dayLabel} at ${minutesToLabel(r.openM, timeZone)}` };
    }
  }
  
  // If no hours found in next 7 days, check if any hours are set at all
  const hasAnyHours = Object.keys(hours).some(k => k !== 'timezone' && k !== 'special' && hours[k]);
  if (hasAnyHours) {
    return { isOpen: false, label: 'Closed • Check hours for details' };
  }

  return { isOpen: false, label: 'Closed' };
}

/**
 * Get today's special hours for display
 * Returns array of special hours entries for today only
 */
export function getTodaySpecialHours(hours: any): Array<{
  date: string;
  open?: string;
  close?: string;
  isClosed: boolean;
  note?: string;
}> {
  if (!hours || typeof hours !== 'object') return [];
  
  const now = new Date();
  const timeZone: string | undefined = typeof hours.timezone === 'string' ? hours.timezone : undefined;
  const todayDate = now.toLocaleDateString('en-CA', { timeZone }); // YYYY-MM-DD format
  
  const specialHours = hours.special as any[] | undefined;
  if (!specialHours || !Array.isArray(specialHours)) return [];
  
  return specialHours
    .filter((sh: any) => sh.date === todayDate)
    .map((sh: any) => ({
      date: sh.date,
      open: sh.open,
      close: sh.close,
      isClosed: sh.isClosed || false,
      note: sh.note,
    }));
}
