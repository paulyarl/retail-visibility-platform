/**
 * Minimal 5-field cron evaluator (minute hour day-of-month month day-of-week)
 *
 * Supports: star, step syntax (e.g. "every 5" via slash notation), single
 * values, `a-b` ranges, comma lists, `a-b/n` steps, month and
 * weekday names (jan/mon/...), and the shorthands @hourly/@daily/@weekly/
 * @monthly/@yearly/@annually. Day-of-month / day-of-week follow standard
 * Vixie semantics: when BOTH are restricted (non-`*`), either may match (OR);
 * otherwise the restricted one applies alone.
 *
 * Evaluated in UTC. `L`, `?`, `W`, `#` are not supported — isValidCron
 * rejects expressions containing them.
 */

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const DOW_NAMES: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

const SHORTHANDS: Record<string, string> = {
  '@hourly': '0 * * * *',
  '@daily': '0 0 * * *',
  '@weekly': '0 0 * * 0',
  '@monthly': '0 0 1 * *',
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
};

const MAX_ITERATIONS = 5 * 366 * 24; // ~5 years of day-iterations; minute loop inner

interface CronSpec {
  minutes: Set<number>;
  hours: Set<number>;
  /** null = wildcard */
  dom: Set<number> | null;
  months: Set<number>;
  /** null = wildcard */
  dow: Set<number> | null;
}

function parseField(raw: string, min: number, max: number, names?: Record<string, number>): Set<number> | null {
  const resolve = (tok: string): number | null => {
    const named = names?.[tok.toLowerCase()];
    if (named !== undefined) return named;
    if (/^\d+$/.test(tok)) return parseInt(tok, 10);
    return null;
  };

  const out = new Set<number>();
  for (const part of raw.split(',')) {
    const m = /^(.+?)(?:\/(\d+))?$/.exec(part.trim());
    if (!m) return null;
    const step = m[2] ? parseInt(m[2], 10) : 1;
    if (step < 1) return null;

    const body = m[1];
    if (body === '*') {
      for (let v = min; v <= max; v += step) out.add(v);
      continue;
    }
    const range = /^(.+?)-(.+)$/.exec(body);
    if (range) {
      const lo = resolve(range[1]);
      const hi = resolve(range[2]);
      if (lo === null || hi === null || lo > hi || lo < min || hi > max) return null;
      for (let v = lo; v <= hi; v += step) out.add(v);
      continue;
    }
    const single = resolve(body);
    if (single === null || single < min || single > max) return null;
    if (m[2]) {
      // "a/n" = from a to max every n
      for (let v = single; v <= max; v += step) out.add(v);
    } else {
      out.add(single);
    }
  }
  return out.size ? out : null;
}

/** Normalize shorthands + weekday 7 → 0. Returns null when invalid. */
export function parseCron(expr: string): CronSpec | null {
  const normalized = SHORTHANDS[expr.trim().toLowerCase()] ?? expr;
  const fields = normalized.trim().split(/\s+/);
  if (fields.length !== 5) return null;
  if (/[LW?#]/.test(normalized)) return null;

  const minutes = parseField(fields[0], 0, 59);
  const hours = parseField(fields[1], 0, 23);
  const months = parseField(fields[3], 1, 12, MONTH_NAMES);

  const domRaw = fields[2];
  const dowRaw = fields[4];
  const dom = domRaw === '*' ? null : parseField(domRaw, 1, 31);
  // dow accepts 0-7 where 7 also means Sunday
  let dow: Set<number> | null = null;
  if (dowRaw !== '*') {
    const parsed = parseField(dowRaw, 0, 7, DOW_NAMES);
    if (parsed?.has(7)) {
      parsed.delete(7);
      parsed.add(0);
    }
    dow = parsed;
  }

  if (!minutes || !hours || !months) return null;
  if (domRaw !== '*' && !dom) return null;
  if (dowRaw !== '*' && !dow) return null;

  return { minutes, hours, dom, months, dow };
}

export function isValidCron(expr: string): boolean {
  return parseCron(expr) !== null;
}

function dayMatches(spec: CronSpec, d: Date): boolean {
  if (spec.dom === null && spec.dow === null) return true;
  const domMatch = spec.dom !== null && spec.dom.has(d.getUTCDate());
  const dowMatch = spec.dow !== null && spec.dow.has(d.getUTCDay());
  // Vixie rule: both restricted → OR; one restricted → it alone
  if (spec.dom !== null && spec.dow !== null) return domMatch || dowMatch;
  return domMatch || dowMatch;
}

/** Next instant matching the cron spec strictly after `from` (evaluated in UTC). */
export function nextCronRun(expr: string, from: Date = new Date()): Date | null {
  const spec = parseCron(expr);
  if (!spec) return null;

  // Start at the next minute boundary
  const cursor = new Date(from.getTime());
  cursor.setUTCSeconds(0, 0);
  cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (!spec.months.has(cursor.getUTCMonth() + 1)) {
      cursor.setUTCDate(1);
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      cursor.setUTCHours(0, 0, 0, 0);
      continue;
    }
    if (!dayMatches(spec, cursor)) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      cursor.setUTCHours(0, 0, 0, 0);
      continue;
    }
    if (!spec.hours.has(cursor.getUTCHours())) {
      cursor.setUTCHours(cursor.getUTCHours() + 1, 0, 0, 0);
      continue;
    }
    if (!spec.minutes.has(cursor.getUTCMinutes())) {
      cursor.setUTCMinutes(cursor.getUTCMinutes() + 1, 0, 0);
      continue;
    }
    return cursor;
  }
  return null;
}
