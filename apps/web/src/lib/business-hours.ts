/**
 * Business-hours helpers shared by the seed editor and the verify-then-outreach
 * resolution modal.
 *
 * The canonical shape is the one stored on
 * `directory_listings_list.business_hours` (and, since migration 296,
 * `mkt_campaigns_list.business_hours`):
 *
 *   {
 *     "monday": { "open": "09:00", "close": "18:00", "closed": false },
 *     ...,
 *     "sunday": { "open": "09:00", "close": "18:00", "closed": true },
 *     "timezone": "America/New_York"
 *   }
 *
 * `parseGoogleHoursPaste` turns a block copied from the GBP "Hours" section
 * into that shape. Extracted verbatim from the seed detail page so the
 * verification modal parses identically.
 */

export const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export interface DayHours {
  open: string;
  close: string;
  closed: boolean;
}

export type BusinessHours = Partial<Record<(typeof DAYS)[number], DayHours>> & {
  timezone?: string;
};

export const EMPTY_HOURS: Record<string, DayHours> = DAYS.reduce((acc, day) => {
  acc[day] = { open: '09:00', close: '18:00', closed: true };
  return acc;
}, {} as Record<string, DayHours>);

export function parseHours(raw: any): Record<string, DayHours> {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_HOURS };
  const result: Record<string, DayHours> = { ...EMPTY_HOURS };
  for (const day of DAYS) {
    const d = raw[day];
    if (d && typeof d === 'object') {
      result[day] = {
        open: d.open ?? '09:00',
        close: d.close ?? '18:00',
        closed: d.closed ?? false,
      };
    }
  }
  return result;
}

export function formatHoursForDisplay(raw: any): string {
  const hours = parseHours(raw);
  const parts: string[] = [];
  for (const day of DAYS) {
    const h = hours[day];
    if (h.closed) {
      parts.push(`${day[0].toUpperCase()}${day.slice(1)}: Closed`);
    } else {
      parts.push(`${day[0].toUpperCase()}${day.slice(1)}: ${h.open}–${h.close}`);
    }
  }
  return parts.join(' · ');
}

// --- Google Business Profile hours paste parser ---------------------------
// Parses an hours block copied from the GBP "Hours" section into the
// DayHours structure used by the seed editor. Mirrors the addressParser
// paste-and-split pattern used on the Create Seed form.

const GOOGLE_DAY_NAMES: Record<string, string> = {
  monday: 'monday',
  mon: 'monday',
  tuesday: 'tuesday',
  tue: 'tuesday',
  tues: 'tuesday',
  wednesday: 'wednesday',
  wed: 'wednesday',
  weds: 'wednesday',
  thursday: 'thursday',
  thu: 'thursday',
  thur: 'thursday',
  thurs: 'thursday',
  friday: 'friday',
  fri: 'friday',
  saturday: 'saturday',
  sat: 'saturday',
  sunday: 'sunday',
  sun: 'sunday',
};

/** Convert a 12-hour time token ("9 AM", "8:30 PM", "12 AM") to "HH:MM". */
export function parseTimeTo24h(timeStr: string): string | null {
  const m = timeStr.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const minute = m[2] ? parseInt(m[2], 10) : 0;
  const period = m[3].toUpperCase();
  if (period === 'AM') {
    if (hour === 12) hour = 0;
  } else {
    if (hour !== 12) hour += 12;
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Parse a single hours line (e.g. "- 9 AM–8:30 PM") into a DayHours entry.
 * Handles "Closed", "Open 24 hours", and split ranges (takes the first
 * range — the DayHours model only stores one open/close pair per day).
 */
export function parseHoursLine(line: string): DayHours | null {
  const trimmed = line.replace(/^[-•*]\s*/, '').trim();
  if (!trimmed) return null;
  if (/^closed/i.test(trimmed)) {
    return { open: '09:00', close: '18:00', closed: true };
  }
  if (/open\s*24\s*hours?/i.test(trimmed)) {
    return { open: '00:00', close: '23:59', closed: false };
  }
  // Time range — separator can be en-dash (–), em-dash (—), or hyphen (-).
  const rangeMatch = trimmed.match(
    /(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\s*[–—-]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))/i,
  );
  if (!rangeMatch) return null;
  const open = parseTimeTo24h(rangeMatch[1]);
  const close = parseTimeTo24h(rangeMatch[2]);
  if (!open || !close) return null;
  return { open, close, closed: false };
}

// A day-name range at the start of a line: "Mon–Fri 9 AM–5 PM". Checked before
// the same-line pattern so the trailing day name isn't mistaken for hours text.
const DAY_RANGE_RE = /^([A-Za-z]+)\s*[–—-]\s*([A-Za-z]+)\s*:?\s+(.+)$/;

// A leading day name optionally followed by hours on the same line:
// "Saturday\t9 AM–10 PM", "Monday: Closed", "Saturday - 9 AM–10 PM", or a bare
// "Saturday" whose hours sit on the next non-empty line.
const INLINE_DAY_RE = /^([A-Za-z]+)\s*[:–—-]?\s*(.*)$/;

/**
 * Parse a Google Business Profile hours block into a per-day DayHours map.
 * Returns null when no day could be parsed (so the caller can show an error).
 *
 * Accepted formats — the day order doesn't matter:
 *   Saturday\n- 12 AM–8:30 PM   (stacked, GBP copy)
 *   Saturday\t9 AM–10 PM        (day + hours on one line, tab/colon/space/dash)
 *   Mon–Fri 9 AM–5 PM           (day range, applied to every day in the span)
 */
export function parseGoogleHoursPaste(text: string): Record<string, DayHours> | null {
  if (!text.trim()) return null;
  const result: Record<string, DayHours> = { ...EMPTY_HOURS };
  let foundAny = false;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    // Day range ("Mon–Fri 9 AM–5 PM") — expand to every day in the span,
    // wrapping around the week when the end precedes the start.
    const range = trimmed.match(DAY_RANGE_RE);
    if (range) {
      const start = GOOGLE_DAY_NAMES[range[1].toLowerCase()] as (typeof DAYS)[number] | undefined;
      const end = GOOGLE_DAY_NAMES[range[2].toLowerCase()] as (typeof DAYS)[number] | undefined;
      if (start && end && start !== end) {
        const parsed = parseHoursLine(range[3]);
        if (parsed) {
          const startIdx = DAYS.indexOf(start);
          const endIdx = DAYS.indexOf(end);
          for (let d = startIdx; ; d = (d + 1) % DAYS.length) {
            result[DAYS[d]] = { ...parsed };
            foundAny = true;
            if (d === endIdx) break;
          }
        }
        continue;
      }
      // Not a real day range — fall through to the same-line parse.
    }

    const inline = trimmed.match(INLINE_DAY_RE);
    if (!inline) continue;
    const dayKey = GOOGLE_DAY_NAMES[inline[1].toLowerCase()];
    if (!dayKey) continue;
    let hoursLine = inline[2].trim();
    if (!hoursLine) {
      // Bare day name — find the next non-empty line for the hours. Stop if
      // it's another day name (means this day had no hours listed).
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j].trim();
        if (!next) continue;
        // Stop on any line that begins a new day entry — a bare day name or
        // a same-line "Day <hours>" pair.
        const nextInline = next.match(INLINE_DAY_RE);
        if (nextInline && GOOGLE_DAY_NAMES[nextInline[1].toLowerCase()]) break;
        hoursLine = next;
        break;
      }
    }
    if (hoursLine) {
      const parsed = parseHoursLine(hoursLine);
      if (parsed) {
        result[dayKey] = parsed;
        foundAny = true;
      }
    }
  }
  return foundAny ? result : null;
}

// --- US state → timezone inference ----------------------------------------
// Majority-zone mapping (several states span two zones — the zone covering
// most of the population wins). Used to default the hours editor's timezone
// picker; the operator can always override. Accepts abbreviations or full
// names, any case. Returns null for unrecognized / non-US values so callers
// can keep their own fallback.

const STATE_TIMEZONES: Record<string, string> = {
  al: 'America/Chicago', alabama: 'America/Chicago',
  ak: 'America/Anchorage', alaska: 'America/Anchorage',
  az: 'America/Phoenix', arizona: 'America/Phoenix',
  ar: 'America/Chicago', arkansas: 'America/Chicago',
  ca: 'America/Los_Angeles', california: 'America/Los_Angeles',
  co: 'America/Denver', colorado: 'America/Denver',
  ct: 'America/New_York', connecticut: 'America/New_York',
  de: 'America/New_York', delaware: 'America/New_York',
  dc: 'America/New_York', 'district of columbia': 'America/New_York',
  fl: 'America/New_York', florida: 'America/New_York',
  ga: 'America/New_York', georgia: 'America/New_York',
  hi: 'Pacific/Honolulu', hawaii: 'Pacific/Honolulu',
  id: 'America/Denver', idaho: 'America/Denver',
  il: 'America/Chicago', illinois: 'America/Chicago',
  in: 'America/New_York', indiana: 'America/New_York',
  ia: 'America/Chicago', iowa: 'America/Chicago',
  ks: 'America/Chicago', kansas: 'America/Chicago',
  ky: 'America/New_York', kentucky: 'America/New_York',
  la: 'America/Chicago', louisiana: 'America/Chicago',
  me: 'America/New_York', maine: 'America/New_York',
  md: 'America/New_York', maryland: 'America/New_York',
  ma: 'America/New_York', massachusetts: 'America/New_York',
  mi: 'America/New_York', michigan: 'America/New_York',
  mn: 'America/Chicago', minnesota: 'America/Chicago',
  ms: 'America/Chicago', mississippi: 'America/Chicago',
  mo: 'America/Chicago', missouri: 'America/Chicago',
  mt: 'America/Denver', montana: 'America/Denver',
  ne: 'America/Chicago', nebraska: 'America/Chicago',
  nv: 'America/Los_Angeles', nevada: 'America/Los_Angeles',
  nh: 'America/New_York', 'new hampshire': 'America/New_York',
  nj: 'America/New_York', 'new jersey': 'America/New_York',
  nm: 'America/Denver', 'new mexico': 'America/Denver',
  ny: 'America/New_York', 'new york': 'America/New_York',
  nc: 'America/New_York', 'north carolina': 'America/New_York',
  nd: 'America/Chicago', 'north dakota': 'America/Chicago',
  oh: 'America/New_York', ohio: 'America/New_York',
  ok: 'America/Chicago', oklahoma: 'America/Chicago',
  or: 'America/Los_Angeles', oregon: 'America/Los_Angeles',
  pa: 'America/New_York', pennsylvania: 'America/New_York',
  ri: 'America/New_York', 'rhode island': 'America/New_York',
  sc: 'America/New_York', 'south carolina': 'America/New_York',
  sd: 'America/Chicago', 'south dakota': 'America/Chicago',
  tn: 'America/Chicago', tennessee: 'America/Chicago',
  tx: 'America/Chicago', texas: 'America/Chicago',
  ut: 'America/Denver', utah: 'America/Denver',
  vt: 'America/New_York', vermont: 'America/New_York',
  va: 'America/New_York', virginia: 'America/New_York',
  wa: 'America/Los_Angeles', washington: 'America/Los_Angeles',
  wv: 'America/New_York', 'west virginia': 'America/New_York',
  wi: 'America/Chicago', wisconsin: 'America/Chicago',
  wy: 'America/Denver', wyoming: 'America/Denver',
};

export function inferTimezoneFromState(state: string | null | undefined): string | null {
  if (!state) return null;
  const key = state.trim().toLowerCase().replace(/\./g, '');
  return STATE_TIMEZONES[key] ?? null;
}
