/**
 * Earnings Data Orchestrator
 *
 * Flow: Finnhub (primary) → FMP (fallback) → Error (no mock)
 *
 * On Friday: fetches Fri AMC through Mon BMO (full weekend window).
 * Filters out penny stocks (< $5).
 * Rate-limits enrichment to respect API limits.
 */

import https from 'https';
import { fetchEarningsCalendar as finnhubCalendar, fetchEarningsSurprises } from './finnhub.js';
import { fetchEarningsCalendar as fmpCalendar } from './fmp.js';
import { fetchImpliedMove as yahooImpliedMove } from './yahooOptions.js';

const cache = {};
const CACHE_TTL = 60 * 60 * 1000; // 1 hour
const MIN_PRICE = 5;

function getKeys() {
  return {
    finnhub: process.env.FINNHUB_API_KEY || '',
    fmp: process.env.FMP_API_KEY || '',
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

  // AMC: current trading day (on weekends, look back to Friday)
  const amcDate = getCurrentTradingDay(now);
  const amcDateStr = fmt(amcDate);

  // BMO: next trading day (Fri/Sat/Sun → Monday)
  const bmoDate = getNextTradingDay(amcDate);
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

  const [yahooData, historicalMoves] = await Promise.all([
    fetchYahooQuote(ticker),
    keys.finnhub ? fetchEarningsSurprises(keys.finnhub, ticker, 40) : Promise.resolve([]),
  ]);

  const price = yahooData.price || 0;

  // Fetch implied move from Yahoo Finance options chain (free, no API key)
  let impliedMove = 0;
  let optionsData = null;
  if (price > 0) {
    optionsData = await yahooImpliedMove(ticker, price);
    if (optionsData) {
      impliedMove = optionsData.impliedMove;
    }
  }

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
