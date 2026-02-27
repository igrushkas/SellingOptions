/**
 * Earnings Data Orchestrator
 *
 * Flow: Finnhub (primary) → FMP (fallback) → Error (no mock)
 *
 * After fetching the calendar, enriches each ticker with:
 * - Yahoo Finance → stock price, company name
 * - Finnhub earnings surprises → historicalMoves (last 20 quarters)
 *
 * Caches enriched results for 1 hour.
 */

import https from 'https';
import { fetchEarningsCalendar as finnhubCalendar, fetchEarningsSurprises } from './finnhub.js';
import { fetchEarningsCalendar as fmpCalendar } from './fmp.js';

// In-memory cache: { [key]: { data, fetchedAt } }
const cache = {};
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getKeys() {
  return {
    finnhub: process.env.FINNHUB_API_KEY || '',
    fmp: process.env.FMP_API_KEY || '',
  };
}

/**
 * Fetch earnings for a date range + timing filter.
 * Tries Finnhub first, then FMP.
 */
export async function scrapeEarningsCalendar(dateStr, timing) {
  const cacheKey = `cal:${dateStr}:${timing || 'all'}`;

  if (cache[cacheKey] && Date.now() - cache[cacheKey].fetchedAt < CACHE_TTL) {
    return cache[cacheKey].data;
  }

  const keys = getKeys();
  let rawEarnings = [];
  let source = 'none';

  // Try Finnhub first
  if (keys.finnhub) {
    try {
      rawEarnings = await finnhubCalendar(keys.finnhub, dateStr, dateStr);
      source = 'finnhub';
      console.log(`[Orchestrator] Finnhub returned ${rawEarnings.length} earnings for ${dateStr}`);
    } catch (err) {
      console.warn(`[Orchestrator] Finnhub failed: ${err.message}`);
    }
  }

  // Fallback to FMP
  if (rawEarnings.length === 0 && keys.fmp) {
    try {
      rawEarnings = await fmpCalendar(keys.fmp, dateStr, dateStr);
      source = 'fmp';
      console.log(`[Orchestrator] FMP returned ${rawEarnings.length} earnings for ${dateStr}`);
    } catch (err) {
      console.warn(`[Orchestrator] FMP failed: ${err.message}`);
    }
  }

  if (rawEarnings.length === 0 && !keys.finnhub && !keys.fmp) {
    return {
      date: dateStr,
      timing,
      source: 'error',
      error: 'No API keys configured. Set FINNHUB_API_KEY and/or FMP_API_KEY in .env',
      earnings: [],
    };
  }

  // Filter by timing if specified
  if (timing) {
    rawEarnings = rawEarnings.filter(e => e.timing === timing);
  }

  // Enrich all tickers in parallel (price, company, historical moves)
  const enriched = await enrichAll(rawEarnings, keys);

  const result = {
    date: dateStr,
    timing: timing || 'all',
    source,
    count: enriched.length,
    earnings: enriched,
  };

  cache[cacheKey] = { data: result, fetchedAt: Date.now() };
  return result;
}

/**
 * Fetch today's actionable plays: tonight's AMC + next trading day's BMO.
 */
export async function getTodaysPlays() {
  const today = new Date();
  const todayStr = fmt(today);
  const nextDay = getNextTradingDay(today);
  const nextDayStr = fmt(nextDay);

  console.log(`[Orchestrator] Today=${todayStr}, NextTradingDay=${nextDayStr}`);

  const [amcResult, bmoResult] = await Promise.all([
    scrapeEarningsCalendar(todayStr, 'AMC'),
    scrapeEarningsCalendar(nextDayStr, 'BMO'),
  ]);

  return {
    today: todayStr,
    nextTradingDay: nextDayStr,
    amcEarnings: amcResult.earnings,
    bmoEarnings: bmoResult.earnings,
    sources: { amc: amcResult.source, bmo: bmoResult.source },
  };
}

// ── Enrichment ──

async function enrichAll(rawEarnings, keys) {
  // Process in batches of 10 to respect rate limits
  const batchSize = 10;
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
  }

  return results;
}

async function enrichTicker(entry, keys) {
  const { ticker, date, timing, epsEstimate, epsPrior, revenueEstimate } = entry;

  // Fetch in parallel: Yahoo Finance price + Finnhub historical earnings
  const [yahooData, historicalMoves] = await Promise.all([
    fetchYahooQuote(ticker),
    keys.finnhub ? fetchEarningsSurprises(keys.finnhub, ticker) : Promise.resolve([]),
  ]);

  return {
    id: ticker,
    ticker,
    company: yahooData.name || ticker,
    price: yahooData.price || 0,
    marketCap: yahooData.marketCap || '',
    sector: '',
    date,
    timing,
    hasWeeklyOptions: true,
    impliedMove: 0, // requires options chain data
    historicalMoves,
    epsEstimate: epsEstimate || null,
    epsPrior: epsPrior || null,
    revenueEstimate: revenueEstimate ? formatRevenue(revenueEstimate) : null,
    consensusRating: '',
    analystCount: 0,
    news: [],
  };
}

// ── Yahoo Finance ──

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

// ── Formatters ──

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
  return d.toISOString().split('T')[0];
}

function getNextTradingDay(date) {
  const next = new Date(date);
  const day = next.getDay();
  if (day === 5) next.setDate(next.getDate() + 3);      // Fri → Mon
  else if (day === 6) next.setDate(next.getDate() + 2);  // Sat → Mon
  else next.setDate(next.getDate() + 1);
  return next;
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      },
      timeout: 10000,
    }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
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
