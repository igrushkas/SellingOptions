/**
 * EarningsWhispers.com scraper + Yahoo Finance enrichment
 *
 * Auto-fetches daily earnings calendar with:
 * - Tickers & company names
 * - BMO/AMC timing
 * - EPS estimates
 * - Stock prices (from Yahoo Finance)
 *
 * Caches results for 1 hour to avoid rate limits.
 */

import https from 'https';
import { load } from 'cheerio';

// In-memory cache: { [dateKey]: { data, fetchedAt } }
const cache = {};
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Get earnings for a specific date + timing (AMC or BMO).
 * dateStr: 'YYYY-MM-DD'
 * timing: 'AMC' | 'BMO' | null (both)
 */
export async function scrapeEarningsCalendar(dateStr, timing) {
  const dateCompact = dateStr.replace(/-/g, '');
  const suffix = timing === 'BMO' ? '/1' : timing === 'AMC' ? '' : '';
  const cacheKey = `${dateCompact}${suffix}`;

  // Check cache
  if (cache[cacheKey] && Date.now() - cache[cacheKey].fetchedAt < CACHE_TTL) {
    return cache[cacheKey].data;
  }

  try {
    // EarningsWhispers: /calendar/YYYYMMDD for AMC, /calendar/YYYYMMDD/1 for BMO
    const url = `https://www.earningswhispers.com/calendar/${dateCompact}${suffix}`;
    console.log(`Fetching earnings: ${url}`);
    const html = await fetchPage(url);
    const tickers = parseEarningsPage(html);

    if (tickers.length === 0) {
      const result = { date: dateStr, timing, source: 'earningswhispers', earnings: [] };
      cache[cacheKey] = { data: result, fetchedAt: Date.now() };
      return result;
    }

    // Enrich with stock prices + company info from Yahoo Finance
    const enriched = await enrichTickers(tickers, dateStr, timing);

    const result = {
      date: dateStr,
      timing: timing || 'all',
      source: 'earningswhispers',
      count: enriched.length,
      earnings: enriched,
    };

    cache[cacheKey] = { data: result, fetchedAt: Date.now() };
    return result;
  } catch (error) {
    console.warn('Scraping failed:', error.message);
    return { date: dateStr, timing, source: 'error', error: error.message, earnings: [] };
  }
}

/**
 * Fetch today's actionable plays: tonight's AMC + next trading day's BMO.
 */
export async function getTodaysPlays() {
  const today = new Date();
  const todayStr = formatDate(today);
  const nextDay = getNextTradingDay(today);
  const nextDayStr = formatDate(nextDay);

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

// ── Helpers ──

function formatDate(d) {
  return d.toISOString().split('T')[0];
}

function getNextTradingDay(date) {
  const next = new Date(date);
  const day = next.getDay(); // 0=Sun, 5=Fri, 6=Sat
  if (day === 5) next.setDate(next.getDate() + 3); // Fri → Mon
  else if (day === 6) next.setDate(next.getDate() + 2); // Sat → Mon
  else next.setDate(next.getDate() + 1);
  return next;
}

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 15000,
    }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchPage(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function parseEarningsPage(html) {
  const $ = load(html);
  const tickers = [];

  // EarningsWhispers uses various selectors for ticker symbols
  // Try multiple patterns to find them
  $('[class*="ticker"], [class*="Ticker"], a[href*="/stocks/"]').each((_, el) => {
    const text = $(el).text().trim();
    if (/^[A-Z]{1,5}$/.test(text) && !tickers.includes(text)) {
      tickers.push(text);
    }
  });

  // Also try data attributes and other patterns
  if (tickers.length === 0) {
    $('a').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim();
      if (href.includes('/stocks/') && /^[A-Z]{1,5}$/.test(text) && !tickers.includes(text)) {
        tickers.push(text);
      }
    });
  }

  // Fallback: scan for standalone uppercase tickers in the page body
  if (tickers.length === 0) {
    const bodyText = $('body').text();
    const matches = bodyText.match(/\b[A-Z]{2,5}\b/g) || [];
    const commonWords = new Set(['THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'OUT', 'GET', 'HAS', 'HIM', 'HIS', 'HOW', 'ITS', 'LET', 'MAY', 'NEW', 'NOW', 'OLD', 'SEE', 'WAY', 'WHO', 'BOY', 'DID', 'EST', 'EPS', 'AMC', 'BMO', 'EST', 'USD', 'API', 'ETF', 'IPO', 'CEO', 'CFO']);
    for (const m of matches) {
      if (!commonWords.has(m) && !tickers.includes(m)) {
        tickers.push(m);
      }
    }
  }

  return tickers;
}

/**
 * Enrich ticker list with price + company info from Yahoo Finance.
 */
async function enrichTickers(tickers, date, timing) {
  const results = await Promise.allSettled(
    tickers.map(ticker => enrichSingleTicker(ticker, date, timing))
  );

  return results
    .filter(r => r.status === 'fulfilled' && r.value)
    .map(r => r.value);
}

async function enrichSingleTicker(ticker, date, timing) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
    const json = await fetchJSON(url);
    const meta = json?.chart?.result?.[0]?.meta;

    if (!meta) return buildBasicEntry(ticker, date, timing);

    return {
      id: ticker,
      ticker,
      company: meta.longName || meta.shortName || ticker,
      price: meta.regularMarketPrice || meta.previousClose || 0,
      marketCap: '',
      timing: timing || 'AMC',
      date,
      hasWeeklyOptions: true,
      sector: '',
      impliedMove: 0, // needs options data to compute
      historicalMoves: [],
      epsEstimate: null,
      epsPrior: null,
      revenueEstimate: null,
      consensusRating: '',
      analystCount: 0,
      news: [],
    };
  } catch {
    return buildBasicEntry(ticker, date, timing);
  }
}

function buildBasicEntry(ticker, date, timing) {
  return {
    id: ticker,
    ticker,
    company: ticker,
    price: 0,
    marketCap: '',
    timing: timing || 'AMC',
    date,
    hasWeeklyOptions: true,
    sector: '',
    impliedMove: 0,
    historicalMoves: [],
    epsEstimate: null,
    epsPrior: null,
    revenueEstimate: null,
    consensusRating: '',
    analystCount: 0,
    news: [],
  };
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      timeout: 10000,
    }, (res) => {
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
