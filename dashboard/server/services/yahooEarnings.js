/**
 * Yahoo Finance Earnings History — Free, No API Key
 *
 * Fetches ACTUAL stock price moves on earnings day (not just EPS surprises).
 * This is the critical data the strategy engine needs — comparing implied move %
 * to actual stock move % around historical earnings.
 *
 * Multi-level earnings date discovery:
 * 1. Yahoo quoteSummary earningsHistory (reliable, last 4 quarters)
 * 2. External dates from Finnhub (when available)
 * 3. Algorithmic detection: find large overnight gaps in 5y price history
 *    (earnings cause the biggest overnight moves — pick ~1 per quarter)
 *
 * Free, unlimited, no API key required (server-side only).
 * Results cached for 24 hours per ticker.
 */

import { fetchYahooJSON } from './yahooSession.js';

// Cache: historical data doesn't change, cache for 24 hours
const cache = {};
const CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * Fetch actual stock price moves on historical earnings dates.
 *
 * @param {string} ticker - Stock ticker symbol
 * @param {string[]} [externalDates] - Optional earnings dates (YYYY-MM-DD) from Finnhub
 * @returns {Array<{quarter, actual, direction, date}>} — same format as ORATS
 */
export async function fetchHistoricalEarningsMoves(ticker, externalDates) {
  const cacheKey = `yahoo-hist:${ticker}`;
  if (cache[cacheKey] && Date.now() - cache[cacheKey].fetchedAt < CACHE_TTL) {
    return cache[cacheKey].data;
  }

  try {
    const prices = await fetchPriceHistory(ticker);

    if (!prices || prices.length === 0) {
      return [];
    }

    // Collect earnings dates from all sources
    const allDates = new Set([
      ...(externalDates || []).filter(Boolean),
    ]);

    // Source 1: Yahoo quoteSummary earningsHistory (last 4 quarters, reliable)
    try {
      const summaryDates = await fetchQuoteSummaryDates(ticker);
      for (const d of summaryDates) allDates.add(d);
    } catch {
      // quoteSummary failed, continue
    }

    // Source 2: Algorithmic detection from price gaps (20+ quarters, always works)
    if (allDates.size < 8) {
      const detected = detectEarningsFromPriceGaps(prices);
      for (const d of detected) allDates.add(d);
    }

    if (allDates.size === 0) {
      console.warn(`[YahooEarnings] ${ticker}: No earnings dates from any source`);
      return [];
    }

    // Calculate actual stock move for each earnings date
    const moves = calculateEarningsMoves([...allDates], prices);

    cache[cacheKey] = { data: moves, fetchedAt: Date.now() };
    const src = allDates.size > 0 ? `${moves.length} moves` : '0';
    console.log(`[YahooEarnings] ${ticker}: ${src} (summary: ${allDates.size >= 4 ? '✓' : '✗'}, detected: ${allDates.size > 4 ? '✓' : '✗'}, external: ${externalDates?.length || 0})`);
    return moves;
  } catch (err) {
    console.warn(`[YahooEarnings] Failed for ${ticker}: ${err.message}`);
    return [];
  }
}

/**
 * Get 5 years of daily prices from Yahoo Finance chart endpoint.
 */
async function fetchPriceHistory(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5y`;

  const data = await fetchYahooJSON(url);
  const result = data?.chart?.result?.[0];
  if (!result) return null;

  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const opens = result.indicators?.quote?.[0]?.open || [];

  if (timestamps.length === 0) return null;

  const prices = [];
  for (let i = 0; i < timestamps.length; i++) {
    const d = new Date(timestamps[i] * 1000);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    prices.push({
      date: dateStr,
      open: opens[i],
      close: closes[i],
      prevClose: i > 0 ? closes[i - 1] : null,
    });
  }

  return prices;
}

/**
 * Get historical earnings dates from Yahoo quoteSummary earningsHistory.
 * Returns last 4 quarters of earnings dates (reliable, well-documented endpoint).
 */
async function fetchQuoteSummaryDates(ticker) {
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=earningsHistory`;
  const data = await fetchYahooJSON(url);
  const history = data?.quoteSummary?.result?.[0]?.earningsHistory?.history;
  if (!Array.isArray(history)) return [];

  const dates = [];
  for (const entry of history) {
    // quarter.fmt is "YYYY-MM-DD", period is also "YYYY-MM-DD"
    const dateStr = entry.quarter?.fmt || entry.period;
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      dates.push(dateStr);
    }
  }
  return dates;
}

/**
 * Detect likely earnings dates from price history by finding large overnight gaps.
 *
 * Earnings are the dominant cause of large overnight stock moves. This function:
 * 1. Calculates overnight gap (open vs previous close) for each day
 * 2. Identifies statistical outliers (> mean + 2.5 * stdDev, minimum 3%)
 * 3. Picks at most 1 per ~75-day window (quarterly spacing)
 *
 * Returns up to 20 detected earnings dates, which is enough for robust analysis.
 */
function detectEarningsFromPriceGaps(prices) {
  if (!prices || prices.length < 100) return [];

  // Calculate all overnight gaps
  const gaps = [];
  for (let i = 1; i < prices.length; i++) {
    const open = prices[i].open;
    const prevClose = prices[i - 1].close;
    if (open == null || prevClose == null || prevClose === 0) continue;

    const gapPct = Math.abs((open - prevClose) / prevClose * 100);
    gaps.push({ date: prices[i].date, gap: gapPct, rawGap: (open - prevClose) / prevClose * 100 });
  }

  if (gaps.length === 0) return [];

  // Calculate statistics
  const avgGap = gaps.reduce((s, g) => s + g.gap, 0) / gaps.length;
  const stdDev = Math.sqrt(
    gaps.reduce((s, g) => s + Math.pow(g.gap - avgGap, 2), 0) / gaps.length
  );

  // Threshold: must be a statistical outlier AND at least 3% move
  const threshold = Math.max(avgGap + 2.5 * stdDev, 3.0);

  // Find all large gaps, sorted by size descending
  const largeMoves = gaps
    .filter(g => g.gap >= threshold)
    .sort((a, b) => b.gap - a.gap);

  // Pick at most 1 per 75-day window (quarterly spacing)
  const MIN_DAYS_APART = 75;
  const selected = [];

  for (const move of largeMoves) {
    const tooClose = selected.some(s => Math.abs(daysBetween(move.date, s)) < MIN_DAYS_APART);
    if (!tooClose) {
      selected.push(move.date);
      if (selected.length >= 20) break;
    }
  }

  // Sort newest first
  selected.sort((a, b) => b.localeCompare(a));
  return selected;
}

function daysBetween(dateA, dateB) {
  const a = new Date(dateA + 'T12:00:00');
  const b = new Date(dateB + 'T12:00:00');
  return Math.round((a - b) / (1000 * 60 * 60 * 24));
}

/**
 * For each earnings date, find the stock price move.
 *
 * Earnings move = the overnight gap after earnings are reported.
 * - AMC earnings: move = next day's open vs today's close
 * - BMO earnings: move = today's open vs yesterday's close
 *
 * Since we don't always know timing, we calculate both and use the larger one.
 * This matches how ORATS calculates their "actual move."
 */
function calculateEarningsMoves(earningsDates, priceHistory) {
  const moves = [];

  // Build a date -> index lookup for fast matching
  const dateIndex = {};
  for (let i = 0; i < priceHistory.length; i++) {
    dateIndex[priceHistory[i].date] = i;
  }

  for (const earningsDate of earningsDates) {
    if (!earningsDate) continue;

    // Find the trading day on or right after the earnings date
    let idx = dateIndex[earningsDate];

    // If exact date not found, look for nearest trading day within 3 days
    if (idx == null) {
      const d = new Date(earningsDate + 'T12:00:00');
      for (let offset = 1; offset <= 3; offset++) {
        const tryDate = new Date(d);
        tryDate.setDate(tryDate.getDate() + offset);
        const tryStr = `${tryDate.getFullYear()}-${String(tryDate.getMonth() + 1).padStart(2, '0')}-${String(tryDate.getDate()).padStart(2, '0')}`;
        if (dateIndex[tryStr] != null) {
          idx = dateIndex[tryStr];
          break;
        }
      }
    }

    if (idx == null || idx < 1) continue;

    const dayOf = priceHistory[idx];
    const dayBefore = priceHistory[idx - 1];
    const dayAfter = idx + 1 < priceHistory.length ? priceHistory[idx + 1] : null;

    if (!dayOf?.close || !dayBefore?.close) continue;

    // Calculate both possible moves
    const amcMove = dayOf.open && dayBefore.close
      ? ((dayOf.open - dayBefore.close) / dayBefore.close) * 100
      : 0;

    const closeToClose = ((dayOf.close - dayBefore.close) / dayBefore.close) * 100;

    const moveOptions = [amcMove, closeToClose];
    if (dayAfter?.open && dayOf?.close) {
      const nextDayGap = ((dayAfter.open - dayOf.close) / dayOf.close) * 100;
      moveOptions.push(nextDayGap);
    }

    // Pick the move with the largest absolute value
    let bestMove = 0;
    for (const m of moveOptions) {
      if (Math.abs(m) > Math.abs(bestMove)) {
        bestMove = m;
      }
    }

    // Format quarter from date
    const d = new Date(earningsDate + 'T12:00:00');
    const quarter = Math.floor(d.getMonth() / 3) + 1;
    const year = d.getFullYear();

    // Find the Friday closing price ~1 week after earnings
    // This shows where the stock settled after the initial earnings reaction
    let fridayMove = null;
    for (let fi = idx + 1; fi < Math.min(idx + 10, priceHistory.length); fi++) {
      const fDate = new Date(priceHistory[fi].date + 'T12:00:00');
      // Must be a Friday (day 5) and at least 3 trading days after earnings
      if (fDate.getDay() === 5 && fi >= idx + 3) {
        const fridayClose = priceHistory[fi].close;
        if (fridayClose && dayBefore.close) {
          const raw = ((fridayClose - dayBefore.close) / dayBefore.close) * 100;
          fridayMove = Math.round(raw * 10) / 10;
        }
        break;
      }
    }

    moves.push({
      quarter: `Q${quarter} ${year}`,
      actual: Math.round(Math.abs(bestMove) * 10) / 10,
      direction: bestMove >= 0 ? 'up' : 'down',
      date: earningsDate,
      fridayMove,
    });
  }

  // Sort newest first
  moves.sort((a, b) => b.date.localeCompare(a.date));

  return moves;
}
