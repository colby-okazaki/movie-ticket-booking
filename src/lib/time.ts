/**
 * Marquee is a single fictional theater, so every showtime lives on its wall
 * clock. Dates in the API ("YYYY-MM-DD") are theater-local calendar days.
 */
export const THEATER_TZ = "America/Los_Angeles";

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: THEATER_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Milliseconds the theater's clock is ahead of UTC at instant `ts`. */
function tzOffset(ts: number) {
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!, +p.second!);
  return asUtc - Math.floor(ts / 1000) * 1000;
}

/** Theater wall-clock date + HH:mm → real instant. DST-safe. */
export function theaterTimeToDate(isoDate: string, hhmm = "00:00") {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y!, mo! - 1, d!, h ?? 0, mi ?? 0);
  let ts = guess - tzOffset(guess);
  ts = guess - tzOffset(ts);
  return new Date(ts);
}

/** Today's date on the theater's calendar, as YYYY-MM-DD. */
export function theaterToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: THEATER_TZ }).format(now);
}

export function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

/** [start, end) instants covering one theater-local day. */
export function theaterDayRange(isoDate: string) {
  return { start: theaterTimeToDate(isoDate), end: theaterTimeToDate(addDays(isoDate, 1)) };
}

/** Theater-local hour (0–23) and weekday (0=Sun) for an instant. */
export function theaterClock(d: Date) {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  const dow = new Date(Date.UTC(+p.year!, +p.month! - 1, +p.day!)).getUTCDay();
  return { hour: +p.hour!, dow };
}
