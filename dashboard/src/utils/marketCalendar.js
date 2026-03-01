/**
 * US Stock Market Calendar — Holidays & Half Days
 *
 * NYSE/NASDAQ official holidays and early close days (1pm ET).
 * Used by both client-side earnings fetching and time phase detection.
 */

// Full-day closures (market does not open)
const HOLIDAYS = {
  // 2025
  '2025-01-01': "New Year's Day",
  '2025-01-20': 'MLK Day',
  '2025-02-17': "Presidents' Day",
  '2025-04-18': 'Good Friday',
  '2025-05-26': 'Memorial Day',
  '2025-06-19': 'Juneteenth',
  '2025-07-04': 'Independence Day',
  '2025-09-01': 'Labor Day',
  '2025-11-27': 'Thanksgiving',
  '2025-12-25': 'Christmas',
  // 2026
  '2026-01-01': "New Year's Day",
  '2026-01-19': 'MLK Day',
  '2026-02-16': "Presidents' Day",
  '2026-04-03': 'Good Friday',
  '2026-05-25': 'Memorial Day',
  '2026-06-19': 'Juneteenth',
  '2026-07-03': 'Independence Day (observed)',
  '2026-09-07': 'Labor Day',
  '2026-11-26': 'Thanksgiving',
  '2026-12-25': 'Christmas',
  // 2027
  '2027-01-01': "New Year's Day",
  '2027-01-18': 'MLK Day',
  '2027-02-15': "Presidents' Day",
  '2027-03-26': 'Good Friday',
  '2027-05-31': 'Memorial Day',
  '2027-06-18': 'Juneteenth (observed)',
  '2027-07-05': 'Independence Day (observed)',
  '2027-09-06': 'Labor Day',
  '2027-11-25': 'Thanksgiving',
  '2027-12-24': 'Christmas (observed)',
};

// Early close days (market closes at 1pm ET instead of 4pm)
const HALF_DAYS = {
  // 2025
  '2025-07-03': 'Day before Independence Day',
  '2025-11-28': 'Day after Thanksgiving',
  '2025-12-24': 'Christmas Eve',
  // 2026
  '2026-11-27': 'Day after Thanksgiving',
  '2026-12-24': 'Christmas Eve',
  // 2027
  '2027-11-26': 'Day after Thanksgiving',
};

export function isMarketHoliday(dateStr) {
  return HOLIDAYS[dateStr] || null;
}

export function isHalfDay(dateStr) {
  return HALF_DAYS[dateStr] || null;
}

export function isMarketOpen(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  return day !== 0 && day !== 6 && !HOLIDAYS[dateStr];
}

/**
 * Get full market status for a date.
 * @returns {{ open: boolean, halfDay: boolean, holiday: string|null }}
 */
export function getMarketStatus(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay();
  if (day === 0 || day === 6) return { open: false, halfDay: false, holiday: day === 0 ? 'Sunday' : 'Saturday' };
  if (HOLIDAYS[dateStr]) return { open: false, halfDay: false, holiday: HOLIDAYS[dateStr] };
  if (HALF_DAYS[dateStr]) return { open: true, halfDay: true, holiday: HALF_DAYS[dateStr] };
  return { open: true, halfDay: false, holiday: null };
}

/**
 * Get next trading day, skipping weekends AND holidays.
 */
export function getNextTradingDay(date) {
  const next = new Date(date);
  do {
    next.setDate(next.getDate() + 1);
  } while (!isMarketOpen(fmt(next)));
  return next;
}

export function fmt(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a date string as "DayName (MM/DD/YYYY)"
 * e.g. "Monday (03/03/2026)"
 */
export function formatDayWithDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dayName} (${mm}/${dd}/${yyyy})`;
}
