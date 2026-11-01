// Pure forecast logic. No UI or storage imports, so it can be unit-tested in Node.
export const LIMIT = 200;
export type Reading = { date: string; value: number }; // date = YYYY-MM-DD
export type Cycle = {
  opening: Reading;      // reading printed on the last bill (or first reading on a replacement meter)
  readings: Reading[];   // later readings in this cycle, oldest first
  endDate: string;       // next bill date
  carriedUnits: number;  // units used on an earlier meter in this same cycle
};
export type Confidence = 'Low' | 'Medium' | 'High';
export type Forecast =
  | { ok: false; reason: 'no-readings' | 'same-day' }
  | {
      ok: true; used: number; rate: number; remainingDays: number;
      projected: number; low: number; high: number;
      confidence: Confidence; outdated: boolean;
      status: 'safe' | 'watch' | 'over-risk' | 'already-over';
      dailyBudget: number | null; // max units/day to stay at or under the limit
    };

const DAY = 86400000;
export const dayNum = (iso: string) => Date.parse(iso + 'T00:00:00Z') / DAY;
export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const validIso = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(dayNum(s)) && new Date(s + 'T00:00:00Z').toISOString().startsWith(s);

const BAND: Record<Confidence, number> = { Low: 0.3, Medium: 0.2, High: 0.1 };
const STALE_DAYS = 7; // team heuristic, not an official rule (OQ-16)

export function forecast(c: Cycle, today: string): Forecast {
  const latest = c.readings.length ? c.readings[c.readings.length - 1] : null;
  if (!latest) return { ok: false, reason: 'no-readings' };
  const elapsed = dayNum(latest.date) - dayNum(c.opening.date);
  if (elapsed <= 0) return { ok: false, reason: 'same-day' };

  const used = c.carriedUnits + (latest.value - c.opening.value);
  const remainingDays = Math.max(0, dayNum(c.endDate) - dayNum(latest.date));
  const rate = (latest.value - c.opening.value) / elapsed;
  const age = dayNum(today) - dayNum(latest.date);
  const outdated = age > STALE_DAYS;

  let level = elapsed < 7 ? 0 : elapsed >= 15 && c.readings.length >= 2 ? 2 : 1;
  if (outdated) level = Math.max(0, level - 1);
  const confidence = (['Low', 'Medium', 'High'] as const)[level];

  const tail = rate * remainingDays;
  const projected = used + tail;
  const low = used + tail * (1 - BAND[confidence]);
  const high = used + tail * (1 + BAND[confidence]);

  // Compare unrounded numbers. 200 exactly is still inside the limit.
  const status = used > LIMIT ? 'already-over' : projected > LIMIT ? 'over-risk' : high > LIMIT ? 'watch' : 'safe';
  const dailyBudget = remainingDays > 0 && used <= LIMIT ? (LIMIT - used) / remainingDays : null;
  return { ok: true, used, rate, remainingDays, projected, low, high, confidence, outdated, status, dailyBudget };
}

export type Check =
  | { ok: true }
  | { ok: false; kind: 'invalid' | 'date-order' | 'future' | 'before-cycle' | 'after-cycle' | 'lower'; message: string };

export function checkReading(c: Cycle, r: Reading, today: string): Check {
  if (!Number.isFinite(r.value) || r.value < 0) return { ok: false, kind: 'invalid', message: 'Enter the meter reading as a positive number.' };
  if (!validIso(r.date)) return { ok: false, kind: 'invalid', message: 'Enter the date as YYYY-MM-DD.' };
  if (dayNum(r.date) > dayNum(today)) return { ok: false, kind: 'future', message: 'A reading cannot be dated in the future.' };
  const prev = c.readings.length ? c.readings[c.readings.length - 1] : c.opening;
  if (dayNum(r.date) < dayNum(c.opening.date)) return { ok: false, kind: 'before-cycle', message: 'This date is before the cycle started.' };
  if (dayNum(r.date) > dayNum(c.endDate)) return { ok: false, kind: 'after-cycle', message: 'This date is after the next bill date. Start a new cycle instead.' };
  if (dayNum(r.date) < dayNum(prev.date)) return { ok: false, kind: 'date-order', message: 'This date is earlier than your last reading.' };
  if (r.value < prev.value) return { ok: false, kind: 'lower', message: `This is lower than your last reading (${prev.value}).` };
  return { ok: true };
}

// Meter replaced: the new meter gets its own baseline. Units from the old meter count only if the
// user gave its final reading; the two meters' readings are never subtracted from each other.
export function replaceMeter(c: Cycle, oldFinal: number | null, first: Reading): Cycle {
  const carried = c.carriedUnits + (oldFinal === null ? 0 : Math.max(0, oldFinal - c.opening.value));
  return { opening: first, readings: [], endDate: c.endDate, carriedUnits: carried };
}
