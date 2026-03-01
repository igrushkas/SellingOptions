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
 * Fetch plays directly from Finnhub/FMP APIs.
 * On Friday: fetches Fri evening through Mon morning.
 *
 * @param {string|null} dateStr - Optional date in YYYY-MM-DD format (null = today)
 */
export async function fetchTodaysPlaysDirect(dateStr) {
  const keys = getKeys();
  const now = dateStr ? new Date(dateStr + 'T12:00:00') : new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat
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

  const [profile, finnhubMoves] = await Promise.all([
    keys.finnhub ? fetchProfile(ticker, keys.finnhub) : Promise.resolve(null),
    keys.finnhub ? fetchSurprises(ticker, keys.finnhub) : Promise.resolve([]),
  ]);

  // Try to get ACTUAL stock price moves from Yahoo Finance (free, no key)
  // Uses Finnhub earnings dates + Yahoo chart prices (no auth needed from browser)
  let historicalMoves = finnhubMoves;
  let historySource = finnhubMoves.length > 0 ? 'finnhub' : 'none';

  if (finnhubMoves.length > 0) {
    try {
      const earningsDates = finnhubMoves.map(m => m.date).filter(Boolean);
      const yahooMoves = await fetchYahooPriceMoves(ticker, earningsDates);
      if (yahooMoves && yahooMoves.length > 0) {
        historicalMoves = yahooMoves;
        historySource = 'yahoo';
      }
    } catch {
      // Yahoo chart failed, use Finnhub EPS surprises as fallback
    }
  }

  const rawCap = profile?.marketCapRaw || 0;

  // Estimate implied move from historical data when no options data source is available.
  // Markets typically overprice earnings moves by ~10-20%, so avg * 1.1 is reasonable.
  let impliedMove = 0;
  let ivSource = 'none';
  if (historicalMoves && historicalMoves.length >= 2) {
    const absValues = historicalMoves.map(m => Math.abs(m.actual));
    const avgMove = absValues.reduce((s, v) => s + v, 0) / absValues.length;
    if (avgMove > 0) {
      impliedMove = Math.round(avgMove * 1.1 * 10) / 10;
      ivSource = 'estimated';
    }
  }

  return {
    id: ticker,
    ticker,
    company: profile?.name || ticker,
    price: profile?.price || 0,
    marketCap: profile?.marketCap || '',
    sector: profile?.sector || '',
    date: entry.date,
    timing,
    hasWeeklyOptions: rawCap >= 2e9,
    impliedMove,
    ivSource,
    historicalMoves,
    historySource,
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
      marketCapRaw: prof.marketCapitalization ? prof.marketCapitalization * 1e6 : 0,
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

/**
 * Fetch ACTUAL stock price moves around known earnings dates.
 * Takes earnings dates from Finnhub + gets price data from Yahoo chart endpoint.
 * Yahoo chart (v8) works from the browser without auth (unlike v10 quoteSummary).
 *
 * This converts EPS surprise dates into actual stock price moves.
 */
const yahooPriceCache = {};
async function fetchYahooPriceMoves(ticker, earningsDates) {
  if (yahooPriceCache[ticker]) return yahooPriceCache[ticker];
  if (!earningsDates || earningsDates.length === 0) return [];

  try {
    const chartRes = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5y`
    );
    if (!chartRes.ok) return [];
    const chartData = await chartRes.json();
    const result = chartData?.chart?.result?.[0];
    if (!result?.timestamp) return [];

    const timestamps = result.timestamp;
    const closes = result.indicators?.quote?.[0]?.close || [];
    const opens = result.indicators?.quote?.[0]?.open || [];

    // Build price lookup by date
    const prices = [];
    for (let i = 0; i < timestamps.length; i++) {
      const d = new Date(timestamps[i] * 1000);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      prices.push({ date: dateStr, open: opens[i], close: closes[i] });
    }

    const dateIdx = {};
    prices.forEach((p, i) => { dateIdx[p.date] = i; });

    const moves = [];
    for (const earningsDate of earningsDates) {
      let idx = dateIdx[earningsDate];
      if (idx == null) {
        const d = new Date(earningsDate + 'T12:00:00');
        for (let off = 1; off <= 3; off++) {
          const tryD = new Date(d);
          tryD.setDate(tryD.getDate() + off);
          const tryStr = `${tryD.getFullYear()}-${String(tryD.getMonth() + 1).padStart(2, '0')}-${String(tryD.getDate()).padStart(2, '0')}`;
          if (dateIdx[tryStr] != null) { idx = dateIdx[tryStr]; break; }
        }
      }
      if (idx == null || idx < 1) continue;

      const dayOf = prices[idx];
      const dayBefore = prices[idx - 1];
      if (!dayOf?.close || !dayBefore?.close) continue;

      const closeToClose = ((dayOf.close - dayBefore.close) / dayBefore.close) * 100;
      const gapMove = dayOf.open && dayBefore.close
        ? ((dayOf.open - dayBefore.close) / dayBefore.close) * 100 : 0;

      const bestMove = Math.abs(gapMove) > Math.abs(closeToClose) ? gapMove : closeToClose;

      const d = new Date(earningsDate + 'T12:00:00');
      const quarter = Math.floor(d.getMonth() / 3) + 1;

      moves.push({
        quarter: `Q${quarter} ${d.getFullYear()}`,
        actual: Math.round(Math.abs(bestMove) * 10) / 10,
        direction: bestMove >= 0 ? 'up' : 'down',
        date: earningsDate,
      });
    }

    moves.sort((a, b) => b.date.localeCompare(a.date));
    yahooPriceCache[ticker] = moves;
    return moves;
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
