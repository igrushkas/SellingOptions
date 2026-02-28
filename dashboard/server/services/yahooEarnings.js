/**
 * Yahoo Finance Earnings History — Free, No API Key
 *
 * Fetches ACTUAL stock price moves on earnings day (not just EPS surprises).
 * This is the critical data the strategy engine needs — comparing implied move %
 * to actual stock move % around historical earnings.
 *
 * Approach:
 * 1. Get earnings dates from Yahoo's earningsHistory module
 * 2. Get daily stock prices from Yahoo's chart endpoint (5 years)
 * 3. Calculate close-to-open move % for each earnings date
 *
 * Free, unlimited, no API key required (server-side only).
 * Results cached for 24 hours per ticker.
 */

import https from 'https';

// Cache: historical data doesn't change, cache for 24 hours
const cache = {};
const CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * Fetch actual stock price moves on historical earnings dates.
 * Returns array of { quarter, actual, direction, date } — same format as ORATS.
 */
export async function fetchHistoricalEarningsMoves(ticker) {
  const cacheKey = `yahoo-hist:${ticker}`;
  if (cache[cacheKey] && Date.now() - cache[cacheKey].fetchedAt < CACHE_TTL) {
    return cache[cacheKey].data;
  }

  try {
    // Parallel fetch: earnings dates + 5yr price history
    const [earningsDates, priceHistory] = await Promise.all([
      fetchEarningsDates(ticker),
      fetchPriceHistory(ticker),
    ]);

    if (!earningsDates || earningsDates.length === 0 || !priceHistory || priceHistory.length === 0) {
      return [];
    }

    // Calculate actual stock move for each earnings date
    const moves = calculateEarningsMoves(earningsDates, priceHistory);

    cache[cacheKey] = { data: moves, fetchedAt: Date.now() };
    console.log(`[YahooEarnings] ${ticker}: ${moves.length} historical earnings moves`);
    return moves;
  } catch (err) {
    console.warn(`[YahooEarnings] Failed for ${ticker}: ${err.message}`);
    return [];
  }
}

/**
 * Get earnings dates from Yahoo Finance.
 * Uses earningsHistory + calendarEvents modules.
 */
async function fetchEarningsDates(ticker) {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=earningsHistory,calendarEvents`;

  const data = await fetchJSON(url);
  const history = data?.quoteSummary?.result?.[0]?.earningsHistory?.history;

  if (!history || history.length === 0) return null;

  return history
    .filter(e => e.quarter?.raw != null)
    .map(e => ({
      date: e.quarter?.fmt || '',
      epsEstimate: e.epsEstimate?.raw ?? null,
      epsActual: e.epsActual?.raw ?? null,
      epsSurprise: e.epsDifference?.raw ?? null,
      epsSurprisePct: e.surprisePercent?.raw != null ? e.surprisePercent.raw * 100 : null,
    }))
    .filter(e => e.date);
}

/**
 * Get 5 years of daily prices from Yahoo Finance chart endpoint.
 */
async function fetchPriceHistory(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5y`;

  const data = await fetchJSON(url);
  const result = data?.chart?.result?.[0];
  if (!result) return null;

  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const opens = result.indicators?.quote?.[0]?.open || [];

  if (timestamps.length === 0) return null;

  // Build a map of date -> { open, close, prevClose }
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

  for (const earning of earningsDates) {
    const earningsDate = earning.date;

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
    // AMC scenario: earnings after close on day before -> gap to open on day of
    const amcMove = dayOf.open && dayBefore.close
      ? ((dayOf.open - dayBefore.close) / dayBefore.close) * 100
      : 0;

    // BMO scenario: earnings before open on day of -> gap from prev close to open
    // This is the same as amcMove for the prior day

    // Close-to-close move (captures full day reaction)
    const closeToClose = ((dayOf.close - dayBefore.close) / dayBefore.close) * 100;

    // Use the larger absolute move (captures the earnings reaction regardless of timing)
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

// ── HTTP helper ──

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      timeout: 15000,
    }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`Yahoo HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Yahoo JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Yahoo timeout')); });
  });
}
