/**
 * Yahoo Finance Earnings History — Free, No API Key
 *
 * Fetches ACTUAL stock price moves on earnings day (not just EPS surprises).
 * This is the critical data the strategy engine needs — comparing implied move %
 * to actual stock move % around historical earnings.
 *
 * Approach:
 * 1. Receive earnings dates from Finnhub (or other source)
 * 2. Get daily stock prices from Yahoo's chart endpoint (5 years, no auth needed)
 * 3. Calculate close-to-open move % for each earnings date
 *
 * The chart endpoint (v8) works without auth. The quoteSummary endpoint (v10)
 * requires cookie/crumb auth which is unreliable server-side, so we avoid it
 * entirely by receiving earnings dates as a parameter.
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
 * @param {string[]} [externalDates] - Optional array of earnings date strings (YYYY-MM-DD) from Finnhub.
 *   If omitted or empty, earnings dates are extracted from Yahoo's chart events.
 * @returns {Array<{quarter, actual, direction, date}>} — same format as ORATS
 */
export async function fetchHistoricalEarningsMoves(ticker, externalDates) {
  const cacheKey = `yahoo-hist:${ticker}`;
  if (cache[cacheKey] && Date.now() - cache[cacheKey].fetchedAt < CACHE_TTL) {
    return cache[cacheKey].data;
  }

  try {
    const { prices, earningsDates: yahooDates } = await fetchPriceHistory(ticker);

    if (!prices || prices.length === 0) {
      return [];
    }

    // Merge external dates (from Finnhub) with Yahoo's chart earnings events.
    // Yahoo events are the primary source; external dates fill gaps.
    const allDates = new Set([
      ...(yahooDates || []),
      ...(externalDates || []).filter(Boolean),
    ]);

    if (allDates.size === 0) {
      console.warn(`[YahooEarnings] ${ticker}: No earnings dates from Yahoo chart or external source`);
      return [];
    }

    // Calculate actual stock move for each earnings date
    const moves = calculateEarningsMoves([...allDates], prices);

    cache[cacheKey] = { data: moves, fetchedAt: Date.now() };
    console.log(`[YahooEarnings] ${ticker}: ${moves.length} historical earnings moves (Yahoo dates: ${yahooDates?.length || 0}, external: ${externalDates?.length || 0})`);
    return moves;
  } catch (err) {
    console.warn(`[YahooEarnings] Failed for ${ticker}: ${err.message}`);
    return [];
  }
}

/**
 * Get 5 years of daily prices AND earnings event dates from Yahoo Finance chart endpoint.
 * Uses cookie/crumb auth via shared session.
 *
 * The `events=earnings` parameter causes Yahoo to include historical earnings dates
 * inside chart.result[0].events.earnings, so we no longer depend on Finnhub for dates.
 *
 * @returns {{ prices: Array, earningsDates: string[] }}
 */
async function fetchPriceHistory(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5y&events=earnings`;

  const data = await fetchYahooJSON(url);
  const result = data?.chart?.result?.[0];
  if (!result) return { prices: null, earningsDates: [] };

  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const opens = result.indicators?.quote?.[0]?.open || [];

  if (timestamps.length === 0) return { prices: null, earningsDates: [] };

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

  // Extract earnings dates from chart events (if available)
  const earningsDates = [];
  const earningsEvents = result.events?.earnings;
  if (earningsEvents) {
    for (const event of Object.values(earningsEvents)) {
      if (event.date) {
        const d = new Date(event.date * 1000);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        earningsDates.push(dateStr);
      }
    }
    earningsDates.sort((a, b) => b.localeCompare(a)); // newest first
  }

  return { prices, earningsDates };
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
 *
 * @param {string[]} earningsDates - Array of date strings (YYYY-MM-DD)
 * @param {Array} priceHistory - Daily price data from Yahoo chart
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

    moves.push({
      quarter: `Q${quarter} ${year}`,
      actual: Math.round(Math.abs(bestMove) * 10) / 10,
      direction: bestMove >= 0 ? 'up' : 'down',
      date: earningsDate,
    });
  }

  // Sort newest first
  moves.sort((a, b) => b.date.localeCompare(a.date));

  return moves;
}

