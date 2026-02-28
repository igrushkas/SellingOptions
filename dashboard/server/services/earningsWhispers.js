/**
 * Earnings Data Orchestrator
 *
 * Data source priority for each data type:
 *
 * Implied Move:  ORATS (best) → Alpha Vantage → Yahoo Finance → 0
 * Historical Moves: ORATS (actual stock moves) → Finnhub (EPS surprises as fallback)
 * Earnings Calendar: Finnhub (primary) → FMP (fallback)
 * Stock Quote: Yahoo Finance (free, no key)
 *
 * On Friday: fetches Fri AMC through Mon BMO (full weekend window).
 * Filters out penny stocks (< $5).
 * Rate-limits enrichment to respect API limits.
 */

import https from 'https';
import { fetchEarningsCalendar as finnhubCalendar, fetchEarningsSurprises } from './finnhub.js';
import { fetchEarningsCalendar as fmpCalendar } from './fmp.js';
import { fetchImpliedMove as yahooImpliedMove } from './yahooOptions.js';
import { fetchHistoricalEarningsMoves } from './yahooEarnings.js';
import { fetchEarningsData, fetchImpliedEarningsMove, buildHistoricalMoves, calcOratsIVCrushStats } from './orats.js';
import { fetchImpliedMove as alphaVantageImpliedMove, fetchEarningsCalendar as avEarningsCalendar } from './alphaVantage.js';

const cache = {};
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const MIN_PRICE = 5;

function getKeys() {
  return {
    finnhub: process.env.FINNHUB_API_KEY || '',
    fmp: process.env.FMP_API_KEY || '',
    orats: process.env.ORATS_API_TOKEN || '',
    alphaVantage: process.env.ALPHA_VANTAGE_API_KEY || '',
  };
}

/**
 * Fetch earnings for a date range + timing filter.
 */
export async function scrapeEarningsCalendar(fromDate, toDate, timing) {
  const cacheKey = `cal:${fromDate}:${toDate}:${timing || 'all'}`;

  if (cache[cacheKey] && Date.now() - cache[cacheKey].fetchedAt < CACHE_TTL) {
    return cache[cacheKey].data;
  }

  const keys = getKeys();
  let rawEarnings = [];
  let source = 'none';

  // Try Finnhub
  if (keys.finnhub) {
    try {
      rawEarnings = await finnhubCalendar(keys.finnhub, fromDate, toDate);
      source = 'finnhub';
      console.log(`[Orchestrator] Finnhub: ${rawEarnings.length} earnings for ${fromDate}→${toDate}`);
    } catch (err) {
      console.warn(`[Orchestrator] Finnhub failed: ${err.message}`);
    }
  }

  // Fallback to FMP
  if (rawEarnings.length === 0 && keys.fmp) {
    try {
      rawEarnings = await fmpCalendar(keys.fmp, fromDate, toDate);
      source = 'fmp';
      console.log(`[Orchestrator] FMP: ${rawEarnings.length} earnings for ${fromDate}→${toDate}`);
    } catch (err) {
      console.warn(`[Orchestrator] FMP failed: ${err.message}`);
    }
  }

  if (rawEarnings.length === 0 && !keys.finnhub && !keys.fmp) {
    return { date: fromDate, timing, source: 'error', error: 'No API keys configured', earnings: [] };
  }

  // Filter by timing
  if (timing) {
    rawEarnings = rawEarnings.filter(e => e.timing === timing);
  }

  // Enrich (rate-limited batches)
  const enriched = await enrichAll(rawEarnings, keys);

  // Filter penny stocks
  const filtered = enriched.filter(e => e.price >= MIN_PRICE);

  const result = {
    date: fromDate,
    timing: timing || 'all',
    source,
    count: filtered.length,
    earnings: filtered,
  };

  cache[cacheKey] = { data: result, fetchedAt: Date.now() };
  return result;
}

/**
 * Fetch today's actionable plays.
 * On Friday: Fri AMC + Mon BMO (covers full weekend).
 */
export async function getTodaysPlays() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  let amcDate, bmoDate;

  if (isWeekend) {
    // On weekends: look forward to Monday (both BMO and AMC)
    const monday = getNextTradingDay(now);
    bmoDate = monday;
    amcDate = new Date(monday); // Monday evening
  } else {
    // Weekday: AMC = today evening, BMO = next trading day morning
    amcDate = new Date(now);
    bmoDate = getNextTradingDay(now);
  }

  const amcDateStr = fmt(amcDate);
  const bmoDateStr = fmt(bmoDate);

  console.log(`[Orchestrator] AMC=${amcDateStr} (${getDayName(amcDateStr)}), BMO=${bmoDateStr} (${getDayName(bmoDateStr)})`);

  const [amcResult, bmoResult] = await Promise.all([
    scrapeEarningsCalendar(amcDateStr, amcDateStr, 'AMC'),
    scrapeEarningsCalendar(bmoDateStr, bmoDateStr, 'BMO'),
  ]);

  return {
    today: amcDateStr,
    nextTradingDay: bmoDateStr,
    amcEarnings: amcResult.earnings,
    bmoEarnings: bmoResult.earnings,
    sources: { amc: amcResult.source, bmo: bmoResult.source },
    amcLabel: `${getDayName(amcDateStr)} Evening (AMC)`,
    bmoLabel: `${getDayName(bmoDateStr)} Morning (BMO)`,
  };
}

// ── Enrichment ──

async function enrichAll(rawEarnings, keys) {
  const batchSize = 5;
  const results = [];

  for (let i = 0; i < rawEarnings.length; i += batchSize) {
    const batch = rawEarnings.slice(i, i + batchSize);
    const enriched = await Promise.allSettled(
      batch.map(e => enrichTicker(e, keys))
    );
    for (const r of enriched) {
      if (r.status === 'fulfilled' && r.value) {
        results.push(r.value);
      }
    }
    // Rate limit between batches
    if (i + batchSize < rawEarnings.length) {
      await new Promise(resolve => setTimeout(resolve, 1200));
    }
  }

  return results;
}

async function enrichTicker(entry, keys) {
  const { ticker, date, timing, epsEstimate, epsPrior, revenueEstimate, revenueActual, quarter, year } = entry;

  // Parallel fetch: quote + historical data from all available sources
  const fetchPromises = [
    fetchYahooQuote(ticker),
    keys.finnhub ? fetchEarningsSurprises(keys.finnhub, ticker, 40) : Promise.resolve([]),
  ];

  // ORATS: historical earnings with actual stock price moves (much better than EPS surprises)
  if (keys.orats) {
    fetchPromises.push(fetchEarningsData(ticker));
    fetchPromises.push(fetchImpliedEarningsMove(ticker));
  } else {
    fetchPromises.push(Promise.resolve(null));
    fetchPromises.push(Promise.resolve(null));
  }

  const [yahooData, finnhubSurprises, oratsEarnings, oratsImplied] = await Promise.all(fetchPromises);

  const price = yahooData.price || 0;

  // ── Historical Moves: ORATS > Yahoo (actual stock price moves) > Finnhub (EPS) ──
  //
  // IMPORTANT: The strategy engine needs ACTUAL STOCK PRICE MOVES, not EPS surprises.
  // ORATS and Yahoo Finance provide stock price moves. Finnhub/Alpha Vantage only
  // provide EPS surprise % which is a poor proxy (stock can drop on positive EPS surprise).
  //
  let historicalMoves;
  let historySource = 'none';

  // 1. ORATS: best source — actual stock price moves with pre-calculated IV
  if (oratsEarnings) {
    historicalMoves = buildHistoricalMoves(oratsEarnings, 20);
    historySource = 'orats';
    console.log(`[Orchestrator] ${ticker}: ORATS historical moves (${historicalMoves.length} quarters)`);
  }

  // 2. Yahoo Finance: actual stock price moves (free, no API key, unlimited)
  if (!historicalMoves || historicalMoves.length < 4) {
    try {
      const yahooMoves = await fetchHistoricalEarningsMoves(ticker);
      if (yahooMoves && yahooMoves.length > (historicalMoves?.length || 0)) {
        historicalMoves = yahooMoves;
        historySource = 'yahoo';
        console.log(`[Orchestrator] ${ticker}: Yahoo historical price moves (${historicalMoves.length} quarters)`);
      }
    } catch {
      // Yahoo failed, fall through to Finnhub EPS
    }
  }

  // 3. Finnhub EPS surprises (last resort — these are EPS %, not stock price moves)
  if (!historicalMoves || historicalMoves.length < 4) {
    const finnhubMoves = finnhubSurprises || [];
    if (finnhubMoves.length > (historicalMoves?.length || 0)) {
      historicalMoves = finnhubMoves;
      historySource = finnhubMoves.length > 0 ? 'finnhub' : 'none';
      if (finnhubMoves.length > 0) {
        console.log(`[Orchestrator] ${ticker}: Finnhub EPS surprises as fallback (${finnhubMoves.length} quarters) — note: these are EPS %, not stock price moves`);
      }
    }
  }

  // ── Implied Move: ORATS > Alpha Vantage > Yahoo Finance ──
  let impliedMove = 0;
  let optionsData = null;
  let ivSource = 'none';

  // 1. ORATS implied earnings move (best: strips non-earnings IV)
  if (oratsImplied?.impliedMove) {
    impliedMove = oratsImplied.impliedMove;
    ivSource = 'orats';
    optionsData = oratsImplied;
    console.log(`[Orchestrator] ${ticker}: ORATS implied move ±${impliedMove}%`);
  }

  // 2. Alpha Vantage (ATM straddle calculation)
  if (impliedMove === 0 && keys.alphaVantage && price > 0) {
    try {
      const avData = await alphaVantageImpliedMove(ticker, price);
      if (avData?.impliedMove) {
        impliedMove = avData.impliedMove;
        ivSource = 'alpha_vantage';
        optionsData = avData;
        console.log(`[Orchestrator] ${ticker}: Alpha Vantage implied move ±${impliedMove}%`);
      }
    } catch {
      // Alpha Vantage failed, try Yahoo
    }
  }

  // 3. Yahoo Finance (free fallback)
  if (impliedMove === 0 && price > 0) {
    try {
      const yahooOpts = await yahooImpliedMove(ticker, price);
      if (yahooOpts?.impliedMove) {
        impliedMove = yahooOpts.impliedMove;
        ivSource = 'yahoo';
        optionsData = yahooOpts;
      }
    } catch {
      // Yahoo failed too
    }
  }

  // ── ORATS IV crush stats (bonus data when available) ──
  const ivCrushStats = oratsEarnings ? calcOratsIVCrushStats(oratsEarnings) : null;

  return {
    id: ticker,
    ticker,
    company: yahooData.name || ticker,
    price,
    marketCap: yahooData.marketCap || '',
    sector: '',
    date,
    timing,
    hasWeeklyOptions: !!optionsData,
    impliedMove,
    historicalMoves,
    // Data source tracking
    ivSource,
    historySource,
    // ORATS bonus data (null if ORATS not configured)
    ivCrushStats,
    oratsImpliedMove: oratsImplied?.impliedMove || null,
    daysToEarnings: oratsImplied?.daysToEarnings || null,
    epsEstimate: epsEstimate ?? null,
    epsPrior: epsPrior ?? null,
    revenueEstimate: revenueEstimate ? formatRevenue(revenueEstimate) : null,
    revenueActual: revenueActual ? formatRevenue(revenueActual) : null,
    quarter: quarter || null,
    year: year || null,
    consensusRating: '',
    analystCount: 0,
    news: [],
  };
}

async function fetchYahooQuote(ticker) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
    const json = await fetchJSON(url);
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return { name: ticker, price: 0, marketCap: '' };
    return {
      name: meta.longName || meta.shortName || ticker,
      price: meta.regularMarketPrice || meta.previousClose || 0,
      marketCap: formatMarketCap(meta.marketCap || 0),
    };
  } catch {
    return { name: ticker, price: 0, marketCap: '' };
  }
}

// ── Helpers ──

function formatMarketCap(mc) {
  if (!mc || mc === 0) return '';
  if (mc >= 1e12) return `${(mc / 1e12).toFixed(2)}T`;
  if (mc >= 1e9) return `${(mc / 1e9).toFixed(1)}B`;
  if (mc >= 1e6) return `${(mc / 1e6).toFixed(0)}M`;
  return `${mc}`;
}

function formatRevenue(rev) {
  if (typeof rev === 'string') return rev;
  if (!rev || rev === 0) return null;
  if (rev >= 1e9) return `${(rev / 1e9).toFixed(1)}B`;
  if (rev >= 1e6) return `${(rev / 1e6).toFixed(0)}M`;
  return `${rev}`;
}

function formatQuarterFromDate(dateStr) {
  if (!dateStr) return 'Unknown';
  const d = new Date(dateStr + 'T12:00:00');
  const month = d.getMonth(); // 0-indexed
  const year = d.getFullYear();
  const quarter = Math.floor(month / 3) + 1;
  return `Q${quarter} ${year}`;
}

function fmt(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDayName(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long' });
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

function getCurrentTradingDay(date) {
  const d = new Date(date);
  const day = d.getDay();
  if (day === 0) d.setDate(d.getDate() - 2);       // Sun → Fri
  else if (day === 6) d.setDate(d.getDate() - 1);   // Sat → Fri
  return d;
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      timeout: 10000,
    }, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}
