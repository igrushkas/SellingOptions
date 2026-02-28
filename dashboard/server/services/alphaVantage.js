/**
 * Alpha Vantage API Integration
 *
 * Free tier: 25 calls/day — https://www.alphavantage.co/support/#api-key
 * Premium: from $49.99/month
 *
 * Provides:
 * - Historical options chains with IV and Greeks back to 2008
 * - Earnings calendar with EPS estimates
 * - Stock quotes
 *
 * Used as a secondary/fallback source for:
 * - Implied move calculation (from historical options chains)
 * - Earnings dates when Finnhub is down
 *
 * Rate limit strategy: Cache aggressively to stay under 25 calls/day.
 */

import https from 'https';

const BASE = 'https://www.alphavantage.co/query';

// In-memory cache with 24h TTL (critical for 25 calls/day limit)
const cache = {};
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getKey() {
  return process.env.ALPHA_VANTAGE_API_KEY || '';
}

function getCached(key) {
  const entry = cache[key];
  if (entry && Date.now() - entry.fetchedAt < CACHE_TTL) {
    return entry.data;
  }
  return null;
}

function setCache(key, data) {
  cache[key] = { data, fetchedAt: Date.now() };
}

/**
 * Fetch current options chain for a ticker.
 * Returns calls and puts with IV, Greeks, bid/ask, volume, OI.
 *
 * This gives us real implied volatility data to calculate the
 * implied move from the ATM straddle — replacing Yahoo Finance.
 */
export async function fetchOptionsChain(ticker) {
  const apiKey = getKey();
  if (!apiKey) return null;

  const cacheKey = `av:options:${ticker}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE}?function=REALTIME_OPTIONS&symbol=${ticker}&require_greeks=true&apikey=${apiKey}`;
    const data = await fetchJSON(url);

    if (!data?.data || data.data.length === 0) {
      // Try historical options for today's date as fallback
      return await fetchHistoricalOptions(ticker);
    }

    const result = parseOptionsChain(ticker, data.data);
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.warn(`[AlphaVantage] Options chain failed for ${ticker}: ${err.message}`);
    return null;
  }
}

/**
 * Fetch historical options chain for a specific date.
 * Available back to 2008-01-01 — useful for backtesting.
 *
 * Free tier: this counts toward the 25 calls/day limit.
 */
export async function fetchHistoricalOptions(ticker, date) {
  const apiKey = getKey();
  if (!apiKey) return null;

  const dateStr = date || new Date().toISOString().split('T')[0];
  const cacheKey = `av:hist-options:${ticker}:${dateStr}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE}?function=HISTORICAL_OPTIONS&symbol=${ticker}&date=${dateStr}&require_greeks=true&apikey=${apiKey}`;
    const data = await fetchJSON(url);

    if (!data?.data || data.data.length === 0) {
      console.warn(`[AlphaVantage] No historical options for ${ticker} on ${dateStr}`);
      return null;
    }

    const result = parseOptionsChain(ticker, data.data);
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.warn(`[AlphaVantage] Historical options failed for ${ticker}: ${err.message}`);
    return null;
  }
}

/**
 * Calculate implied move from Alpha Vantage options data.
 * Finds the ATM straddle and computes expected move as % of stock price.
 */
export async function fetchImpliedMove(ticker, stockPrice) {
  const chain = await fetchOptionsChain(ticker);
  if (!chain || !chain.calls.length || !chain.puts.length) return null;

  const price = stockPrice || chain.underlyingPrice || 0;
  if (price <= 0) return null;

  // Find nearest expiration
  const expirations = [...new Set(chain.calls.map(c => c.expiration))].sort();
  if (expirations.length === 0) return null;

  const nearestExp = expirations[0];
  const expCalls = chain.calls.filter(c => c.expiration === nearestExp);
  const expPuts = chain.puts.filter(p => p.expiration === nearestExp);

  // Find ATM call
  let bestCall = null;
  let bestDist = Infinity;
  for (const c of expCalls) {
    const dist = Math.abs(c.strike - price);
    if (dist < bestDist) {
      bestDist = dist;
      bestCall = c;
    }
  }
  if (!bestCall) return null;

  // Find matching put at same strike
  let bestPut = expPuts.find(p => p.strike === bestCall.strike);
  if (!bestPut) {
    let putDist = Infinity;
    for (const p of expPuts) {
      const dist = Math.abs(p.strike - price);
      if (dist < putDist) {
        putDist = dist;
        bestPut = p;
      }
    }
  }
  if (!bestPut) return null;

  const callMid = (bestCall.bid + bestCall.ask) / 2;
  const putMid = (bestPut.bid + bestPut.ask) / 2;
  const straddlePrice = callMid + putMid;
  const impliedMove = (straddlePrice / price) * 100;
  const avgIV = ((bestCall.iv || 0) + (bestPut.iv || 0)) / 2;

  return {
    impliedMove: Math.round(impliedMove * 10) / 10,
    iv: Math.round(avgIV * 10) / 10,
    nearestExpiry: nearestExp,
    straddlePrice: Math.round(straddlePrice * 100) / 100,
    atmStrike: bestCall.strike,
    source: 'alpha_vantage',
  };
}

/**
 * Fetch earnings calendar from Alpha Vantage.
 * Returns upcoming and recent earnings dates with EPS estimates.
 */
export async function fetchEarningsCalendar(ticker) {
  const apiKey = getKey();
  if (!apiKey) return null;

  const cacheKey = `av:earnings:${ticker}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const url = `${BASE}?function=EARNINGS&symbol=${ticker}&apikey=${apiKey}`;
    const data = await fetchJSON(url);

    if (!data?.quarterlyEarnings || data.quarterlyEarnings.length === 0) {
      return null;
    }

    const result = data.quarterlyEarnings.map(e => ({
      date: e.reportedDate,
      epsEstimate: parseFloat(e.estimatedEPS) || null,
      epsActual: parseFloat(e.reportedEPS) || null,
      epsSurprise: parseFloat(e.surprise) || null,
      epsSurprisePct: parseFloat(e.surprisePercentage) || null,
      fiscalDate: e.fiscalDateEnding,
    }));

    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.warn(`[AlphaVantage] Earnings fetch failed for ${ticker}: ${err.message}`);
    return null;
  }
}

// ── Parsers ──

function parseOptionsChain(ticker, rawContracts) {
  const calls = [];
  const puts = [];
  let underlyingPrice = 0;

  for (const c of rawContracts) {
    const contract = {
      symbol: c.contractID || c.symbol || '',
      expiration: c.expiration || '',
      strike: parseFloat(c.strike) || 0,
      type: c.type || '',
      bid: parseFloat(c.bid) || 0,
      ask: parseFloat(c.ask) || 0,
      last: parseFloat(c.last) || 0,
      volume: parseInt(c.volume) || 0,
      openInterest: parseInt(c.open_interest) || 0,
      iv: parseFloat(c.implied_volatility) || 0,
      delta: parseFloat(c.delta) || 0,
      gamma: parseFloat(c.gamma) || 0,
      theta: parseFloat(c.theta) || 0,
      vega: parseFloat(c.vega) || 0,
    };

    if (c.type === 'call') {
      calls.push(contract);
    } else if (c.type === 'put') {
      puts.push(contract);
    }
  }

  // Estimate underlying price from ATM options
  if (calls.length > 0 && puts.length > 0) {
    const allStrikes = [...calls, ...puts].map(c => c.strike);
    const mid = (Math.max(...allStrikes) + Math.min(...allStrikes)) / 2;
    underlyingPrice = mid;
  }

  return {
    ticker,
    source: 'alpha_vantage',
    underlyingPrice,
    calls: calls.sort((a, b) => a.strike - b.strike),
    puts: puts.sort((a, b) => a.strike - b.strike),
    expirations: [...new Set(calls.map(c => c.expiration))].sort(),
  };
}

// ── HTTP helper ──

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'VolatilityCrusher/1.0' },
      timeout: 20000,
    }, (res) => {
      if (res.statusCode === 429) {
        return reject(new Error('Alpha Vantage rate limit exceeded (25 calls/day on free tier)'));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Alpha Vantage HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          // Alpha Vantage returns error messages in the JSON body
          if (parsed?.Note) {
            return reject(new Error(`Alpha Vantage: ${parsed.Note}`));
          }
          if (parsed?.['Error Message']) {
            return reject(new Error(`Alpha Vantage: ${parsed['Error Message']}`));
          }
          if (parsed?.Information) {
            return reject(new Error(`Alpha Vantage: ${parsed.Information}`));
          }
          resolve(parsed);
        } catch {
          reject(new Error('Alpha Vantage JSON parse error'));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Alpha Vantage timeout')); });
  });
}
