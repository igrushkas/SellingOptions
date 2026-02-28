/**
 * Yahoo Finance Earnings History — Free, No API Key
 *
 * Fetches ACTUAL stock price moves on earnings day (not just EPS surprises).
 * This is the critical data the strategy engine needs — comparing implied move %
 * to actual stock move % around historical earnings.
 *
 * Approach:
 * 1. Get earnings dates from Yahoo's earningsHistory module (requires cookie/crumb auth)
 * 2. Get daily stock prices from Yahoo's chart endpoint (5 years, no auth needed)
 * 3. Calculate close-to-open move % for each earnings date
 *
 * Free, unlimited, no API key required (server-side only).
 * Results cached for 24 hours per ticker.
 */

import https from 'https';

// Cache: historical data doesn't change, cache for 24 hours
const cache = {};
const CACHE_TTL = 24 * 60 * 60 * 1000;

// Yahoo session (cookie + crumb) — shared across all calls
let sessionCache = { cookie: null, crumb: null, fetchedAt: 0 };
const SESSION_TTL = 10 * 60 * 1000; // 10 minutes

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

// ── Yahoo Session Management (cookie + crumb) ──

async function getSession() {
  if (sessionCache.cookie && Date.now() - sessionCache.fetchedAt < SESSION_TTL) {
    return sessionCache;
  }

  try {
    const cookie = await getCookie();
    if (!cookie) return null;

    const crumb = await getCrumb(cookie);
    if (!crumb) return null;

    sessionCache = { cookie, crumb, fetchedAt: Date.now() };
    console.log('[YahooEarnings] Session established');
    return sessionCache;
  } catch (err) {
    console.warn('[YahooEarnings] Session setup failed:', err.message);
    return null;
  }
}

function getCookie() {
  return new Promise((resolve) => {
    const req = https.get('https://fc.yahoo.com/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 8000,
    }, (res) => {
      const cookies = res.headers['set-cookie'];
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (cookies && cookies.length > 0) {
          const cookieStr = cookies.map(c => c.split(';')[0]).join('; ');
          resolve(cookieStr);
        } else {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function getCrumb(cookie) {
  return new Promise((resolve) => {
    const req = https.get('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': cookie,
      },
      timeout: 8000,
    }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return resolve(null);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data.trim() || null));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

/**
 * Get earnings dates from Yahoo Finance.
 * Uses earningsHistory module (requires cookie/crumb auth).
 */
async function fetchEarningsDates(ticker) {
  const session = await getSession();
  if (!session) {
    console.warn(`[YahooEarnings] No session for ${ticker}, cannot fetch earnings dates`);
    return null;
  }

  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=earningsHistory&crumb=${encodeURIComponent(session.crumb)}`;

  const data = await fetchJSONWithAuth(url, session.cookie);
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
 * This endpoint does NOT require auth.
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

// ── HTTP helpers ──

/** Fetch JSON with cookie auth (for quoteSummary) */
function fetchJSONWithAuth(url, cookie) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Cookie': cookie,
      },
      timeout: 15000,
    }, (res) => {
      if (res.statusCode === 401 || res.statusCode === 403) {
        // Invalidate session on auth errors
        sessionCache = { cookie: null, crumb: null, fetchedAt: 0 };
        res.resume();
        return reject(new Error(`Yahoo auth failed (${res.statusCode})`));
      }
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

/** Fetch JSON without auth (for chart endpoint) */
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
