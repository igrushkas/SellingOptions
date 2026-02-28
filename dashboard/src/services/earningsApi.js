/**
 * Frontend Earnings API
 *
 * Calls Finnhub (primary) and FMP (fallback) directly from the browser.
 * Used when the backend server is not running (e.g., Firebase Hosting).
 *
 * On Friday: fetches Fri AMC + Sat/Sun/Mon BMO (full weekend window).
 * Filters out micro-caps and penny stocks.
 * Rate-limits enrichment to stay under Finnhub's 60 calls/min.
 */

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const FMP_BASE = 'https://financialmodelingprep.com/api/v3';

// Minimum price to show (filters out penny stocks)
const MIN_PRICE = 5;

function getKeys() {
  return {
    finnhub: import.meta.env.VITE_FINNHUB_API_KEY || '',
    fmp: import.meta.env.VITE_FMP_API_KEY || '',
  };
}

function fmt(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getNextTradingDay(date) {
  const next = new Date(date);
  const day = next.getDay();
  if (day === 5) next.setDate(next.getDate() + 3);      // Fri → Mon
  else if (day === 6) next.setDate(next.getDate() + 2);  // Sat → Mon
  else if (day === 0) next.setDate(next.getDate() + 1);  // Sun → Mon
  else next.setDate(next.getDate() + 1);
  return next;
}

function getLastFriday(date) {
  const d = new Date(date);
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() - 1);      // Sat → Fri
  else if (day === 0) d.setDate(d.getDate() - 2);  // Sun → Fri
  return d;
}

function getCurrentTradingDay(date) {
  const d = new Date(date);
  const day = d.getDay();
  if (day === 0) d.setDate(d.getDate() - 2);       // Sun → Fri
  else if (day === 6) d.setDate(d.getDate() - 1);   // Sat → Fri
  return d;
}

function getDayName(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch today's plays directly from Finnhub/FMP APIs.
 * On Friday: fetches Fri evening through Mon morning.
 */
export async function fetchTodaysPlaysDirect() {
  const keys = getKeys();
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // AMC date: use current trading day (on weekends, look back to Friday)
  const amcDate = getCurrentTradingDay(now);
  const amcDateStr = fmt(amcDate);

  // BMO date: next trading day (on Fri/Sat/Sun → Monday)
  const bmoDate = getNextTradingDay(amcDate);
  const bmoDateStr = fmt(bmoDate);

  // Query range covers both AMC and BMO dates
  const fromStr = amcDateStr;
  const toStr = bmoDateStr;

  let allEarnings = [];
  let source = 'none';

  if (keys.finnhub) {
    try {
      const res = await fetch(
        `${FINNHUB_BASE}/calendar/earnings?from=${fromStr}&to=${toStr}&token=${keys.finnhub}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data?.earningsCalendar?.length > 0) {
        allEarnings = data.earningsCalendar;
        source = 'finnhub';
      } else {
        source = 'finnhub'; // API worked, just no earnings in range
      }
    } catch (err) {
      console.warn('[EarningsAPI] Finnhub failed:', err.message);
    }
  }

  // Fallback to FMP
  if (source === 'none' && keys.fmp) {
    try {
      const res = await fetch(
        `${FMP_BASE}/earning_calendar?from=${fromStr}&to=${toStr}&apikey=${keys.fmp}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        allEarnings = data.map(e => ({
          symbol: e.symbol,
          date: e.date,
          hour: e.time,
          epsEstimate: e.epsEstimated,
          epsActual: e.eps,
          revenueEstimate: e.revenueEstimated,
        }));
        source = 'fmp';
      }
    } catch (err) {
      console.warn('[EarningsAPI] FMP failed:', err.message);
    }
  }

  const amcDayName = getDayName(amcDateStr);
  const bmoDayName = getDayName(bmoDateStr);

  if (allEarnings.length === 0) {
    return {
      amcEarnings: [], bmoEarnings: [],
      sources: { amc: source, bmo: source },
      today: amcDateStr, nextTradingDay: bmoDateStr,
      amcLabel: `${amcDayName} Evening (AMC)`,
      bmoLabel: `${bmoDayName} Morning (BMO)`,
    };
  }

  // AMC: earnings on the AMC date with after-close timing
  const amcRaw = allEarnings.filter(e => {
    return e.date === amcDateStr && mapTiming(e.hour) === 'AMC';
  });

  // BMO: earnings on the BMO date with before-open timing
  const bmoRaw = allEarnings.filter(e => {
    return e.date === bmoDateStr && mapTiming(e.hour) === 'BMO';
  });

  console.log(`[EarningsAPI] AMC: ${amcRaw.length} on ${amcDateStr} (${amcDayName}), BMO: ${bmoRaw.length} on ${bmoDateStr} (${bmoDayName})`);

  // Enrich with profile + historical data (batched to respect 60 calls/min)
  const amcEnriched = await enrichBatchRateLimited(amcRaw, 'AMC', keys);
  const bmoEnriched = await enrichBatchRateLimited(bmoRaw, 'BMO', keys);

  // Filter out penny stocks
  const amcFiltered = amcEnriched.filter(e => e.price >= MIN_PRICE);
  const bmoFiltered = bmoEnriched.filter(e => e.price >= MIN_PRICE);

  return {
    amcEarnings: amcFiltered,
    bmoEarnings: bmoFiltered,
    sources: { amc: source, bmo: source },
    today: amcDateStr,
    nextTradingDay: bmoDateStr,
    amcLabel: `${amcDayName} Evening (AMC)`,
    bmoLabel: `${bmoDayName} Morning (BMO)`,
  };
}

function mapTiming(hour) {
  if (hour === 'bmo') return 'BMO';
  if (hour === 'amc') return 'AMC';
  if (hour === 'dmh') return 'AMC';
  return 'AMC';
}

/**
 * Enrich in batches of 5, with 1.5s delay between batches.
 * Each stock needs 3 API calls (quote + profile + surprises) = 15 calls per batch.
 * At 60 calls/min, 5 stocks per 1.5s = ~40 calls/min (safe).
 */
async function enrichBatchRateLimited(rawList, timing, keys) {
  const batchSize = 5;
  const results = [];

  for (let i = 0; i < rawList.length; i += batchSize) {
    const batch = rawList.slice(i, i + batchSize);
    const enriched = await Promise.allSettled(
      batch.map(e => enrichSingle(e, timing, keys))
    );
    for (const r of enriched) {
      if (r.status === 'fulfilled' && r.value) {
        results.push(r.value);
      }
    }
    // Rate limit: wait between batches (skip after last batch)
    if (i + batchSize < rawList.length) {
      await delay(1500);
    }
  }

  return results;
}

async function enrichSingle(entry, timing, keys) {
  const ticker = entry.symbol;

  const [profile, historicalMoves] = await Promise.all([
    keys.finnhub ? fetchProfile(ticker, keys.finnhub) : Promise.resolve(null),
    keys.finnhub ? fetchSurprises(ticker, keys.finnhub) : Promise.resolve([]),
  ]);

  return {
    id: ticker,
    ticker,
    company: profile?.name || ticker,
    price: profile?.price || 0,
    marketCap: profile?.marketCap || '',
    sector: profile?.sector || '',
    date: entry.date,
    timing,
    hasWeeklyOptions: true,
    impliedMove: 0, // Options IV only available via backend (Yahoo Finance, no CORS)
    historicalMoves,
    // Finnhub calendar fields
    epsEstimate: entry.epsEstimate ?? null,
    epsPrior: entry.epsActual ?? null,
    revenueEstimate: entry.revenueEstimate ? formatRevenue(entry.revenueEstimate) : null,
    revenueActual: entry.revenueActual ? formatRevenue(entry.revenueActual) : null,
    quarter: entry.quarter || null,
    year: entry.year || null,
    consensusRating: '',
    analystCount: 0,
    news: [],
  };
}

async function fetchProfile(ticker, apiKey) {
  try {
    const [quoteRes, profileRes] = await Promise.all([
      fetch(`${FINNHUB_BASE}/quote?symbol=${ticker}&token=${apiKey}`),
      fetch(`${FINNHUB_BASE}/stock/profile2?symbol=${ticker}&token=${apiKey}`),
    ]);

    const quote = quoteRes.ok ? await quoteRes.json() : {};
    const prof = profileRes.ok ? await profileRes.json() : {};

    return {
      name: prof.name || ticker,
      price: quote.c || 0,
      marketCap: prof.marketCapitalization ? formatMarketCap(prof.marketCapitalization * 1e6) : '',
      sector: prof.finnhubIndustry || '',
    };
  } catch {
    return null;
  }
}

async function fetchSurprises(ticker, apiKey) {
  try {
    const res = await fetch(`${FINNHUB_BASE}/stock/earnings?symbol=${ticker}&limit=40&token=${apiKey}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map(e => {
      const pct = e.surprisePercent || 0;
      return {
        quarter: `Q${e.quarter} ${e.year}`,
        actual: Math.abs(pct),
        direction: pct >= 0 ? 'up' : 'down',
        date: e.period || '',
      };
    });
  } catch {
    return [];
  }
}

function formatMarketCap(mc) {
  if (!mc) return '';
  if (mc >= 1e12) return `${(mc / 1e12).toFixed(2)}T`;
  if (mc >= 1e9) return `${(mc / 1e9).toFixed(1)}B`;
  if (mc >= 1e6) return `${(mc / 1e6).toFixed(0)}M`;
  return '';
}

function formatRevenue(rev) {
  if (typeof rev === 'string') return rev;
  if (!rev) return null;
  if (rev >= 1e9) return `${(rev / 1e9).toFixed(1)}B`;
  if (rev >= 1e6) return `${(rev / 1e6).toFixed(0)}M`;
  return `${rev}`;
}
