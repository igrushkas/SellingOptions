/**
 * ORATS (Option Research & Technology Services) API Integration
 *
 * 14-day trial: $29 at https://orats.com/data-api
 * Individual plan: $99/month
 *
 * ORATS is the gold standard for earnings-specific IV data:
 * - Implied earnings move (strips earnings effect from IV)
 * - Ex-earnings IV (predicts post-crush IV level)
 * - Historical earnings straddle prices
 * - Actual vs implied earnings moves
 * - Full historical options chains with Greeks back to 2007
 *
 * Key endpoints used:
 * - /datav2/earnings          — historical earnings moves + implied earnings move
 * - /datav2/cores/dailies     — daily IV summaries (IV30, IV60, IV rank, etc.)
 * - /datav2/strikes/history   — historical options chain data
 */

import https from 'https';

const BASE = 'https://api.orats.io/datav2';

function getToken() {
  return process.env.ORATS_API_TOKEN || '';
}

/**
 * Fetch historical earnings data for a ticker.
 * Returns actual stock price moves around earnings, implied earnings moves,
 * straddle prices, and forecasted straddle prices.
 *
 * This is the core data for our IV crush strategy — tells us:
 * 1. What was the implied move before each earnings?
 * 2. What was the actual stock move?
 * 3. How often does the implied move overstate the actual move?
 */
export async function fetchEarningsData(ticker) {
  const token = getToken();
  if (!token) return null;

  try {
    const url = `${BASE}/earnings?token=${token}&ticker=${ticker}`;
    const data = await fetchJSON(url);

    if (!data?.data || data.data.length === 0) {
      console.warn(`[ORATS] No earnings data for ${ticker}`);
      return null;
    }

    // Map ORATS earnings data to our format
    const earnings = data.data.map(e => ({
      ticker: e.ticker,
      earnDate: e.earnDate,
      // Actual stock price move on earnings day (%)
      actualMove: e.stockPctChg1d != null ? Math.round(e.stockPctChg1d * 10000) / 100 : null,
      // Direction
      direction: e.stockPctChg1d >= 0 ? 'up' : 'down',
      // ORATS implied earnings move (%) — the expected move priced into options
      impliedEarningsMove: e.ernStraPct1 != null ? Math.round(e.ernStraPct1 * 10000) / 100 : null,
      // Smoothed straddle price as % of stock
      smoothStraddlePct: e.smoothStraPxM1 != null ? Math.round(e.smoothStraPxM1 * 10000) / 100 : null,
      // Forecasted straddle price as % of stock
      forecastStraddlePct: e.fcstStraPxM1 != null ? Math.round(e.fcstStraPxM1 * 10000) / 100 : null,
      // Straddle price the day before earnings
      straddlePrice: e.straPxM1 || null,
      // Stock price on earnings date
      stockPrice: e.stockCloseM1 || null,
      // EPS data
      epsActual: e.epsActual || null,
      epsEstimate: e.epsEstimate || null,
      epsSurprise: e.epsSurprise || null,
    }));

    // Sort by date descending (most recent first)
    earnings.sort((a, b) => new Date(b.earnDate) - new Date(a.earnDate));

    return {
      ticker,
      source: 'orats',
      earningsCount: earnings.length,
      earnings,
    };
  } catch (err) {
    console.warn(`[ORATS] Earnings fetch failed for ${ticker}: ${err.message}`);
    return null;
  }
}

/**
 * Fetch current IV summary for a ticker.
 * Returns IV30, IV60, IV90, IV rank, IV percentile, and implied earnings move.
 *
 * The cores/dailies endpoint gives us the real-time IV surface data.
 */
export async function fetchIVSummary(ticker) {
  const token = getToken();
  if (!token) return null;

  try {
    const url = `${BASE}/cores/dailies?token=${token}&ticker=${ticker}`;
    const data = await fetchJSON(url);

    if (!data?.data || data.data.length === 0) {
      return null;
    }

    // Get most recent entry
    const latest = data.data[data.data.length - 1];

    return {
      ticker,
      date: latest.tradeDate,
      // Implied volatility at various tenors
      iv30d: latest.orIvXern30d != null ? Math.round(latest.orIvXern30d * 10000) / 100 : null,
      iv60d: latest.orIvXern60d != null ? Math.round(latest.orIvXern60d * 10000) / 100 : null,
      iv90d: latest.orIvXern90d != null ? Math.round(latest.orIvXern90d * 10000) / 100 : null,
      // IV with earnings effect included
      ivWithEarnings30d: latest.orIv30d != null ? Math.round(latest.orIv30d * 10000) / 100 : null,
      // Fair implied volatility excluding earnings
      fairIvXern90d: latest.fairXieeVol90d != null ? Math.round(latest.fairXieeVol90d * 10000) / 100 : null,
      // Implied earnings effect (the IV attributable to upcoming earnings)
      impliedEarningsEffect: null, // Calculated below
      // IV rank and percentile
      ivRank1m: latest.ivRnk1m || null,
      ivRank1y: latest.ivRnk1y || null,
      ivPct1m: latest.ivPct1m || null,
      ivPct1y: latest.ivPct1y || null,
      // Stock price
      stockPrice: latest.stockPrice || null,
      source: 'orats',
    };
  } catch (err) {
    console.warn(`[ORATS] IV summary fetch failed for ${ticker}: ${err.message}`);
    return null;
  }
}

/**
 * Fetch current implied earnings move for a ticker.
 * Uses the SMV summaries endpoint which includes pre-calculated
 * implied earnings move data.
 */
export async function fetchImpliedEarningsMove(ticker) {
  const token = getToken();
  if (!token) return null;

  try {
    const url = `${BASE}/smv/summaries?token=${token}&ticker=${ticker}`;
    const data = await fetchJSON(url);

    if (!data?.data || data.data.length === 0) {
      return null;
    }

    const latest = data.data[0];

    return {
      ticker,
      date: latest.tradeDate,
      // Next earnings date
      nextEarningsDate: latest.nextErnDate || null,
      // Implied earnings move from ATM straddle
      impliedMove: latest.ernImpMove != null ? Math.round(latest.ernImpMove * 10000) / 100 : null,
      // Current ATM IV
      atmIv: latest.atmIv != null ? Math.round(latest.atmIv * 10000) / 100 : null,
      // Stock price
      stockPrice: latest.stockPrice || null,
      // Days to next earnings
      daysToEarnings: latest.daysToNextErn || null,
      source: 'orats',
    };
  } catch (err) {
    console.warn(`[ORATS] SMV summary fetch failed for ${ticker}: ${err.message}`);
    return null;
  }
}

/**
 * Build historical moves array from ORATS earnings data.
 * Converts ORATS earnings response into our standard historicalMoves format
 * used by the dashboard calculations.
 *
 * This is much more accurate than Finnhub's EPS surprise % because
 * ORATS gives us the actual STOCK PRICE move, not EPS surprise.
 */
export function buildHistoricalMoves(oratsEarnings, limit = 20) {
  if (!oratsEarnings?.earnings) return [];

  return oratsEarnings.earnings
    .filter(e => e.actualMove != null)
    .slice(0, limit)
    .map(e => {
      const earnDate = new Date(e.earnDate);
      const quarter = `Q${Math.ceil((earnDate.getMonth() + 1) / 3)} ${earnDate.getFullYear()}`;
      return {
        quarter,
        actual: Math.abs(e.actualMove),
        direction: e.direction,
        date: e.earnDate,
        // ORATS bonus data
        impliedAtTime: e.impliedEarningsMove,
        straddlePct: e.smoothStraddlePct,
      };
    });
}

/**
 * Calculate IV crush statistics from ORATS historical data.
 * Shows how often the implied move overstated the actual move.
 */
export function calcOratsIVCrushStats(oratsEarnings) {
  if (!oratsEarnings?.earnings) return null;

  const withBoth = oratsEarnings.earnings.filter(
    e => e.actualMove != null && e.impliedEarningsMove != null && e.impliedEarningsMove > 0
  );

  if (withBoth.length === 0) return null;

  const wins = withBoth.filter(e => Math.abs(e.actualMove) < e.impliedEarningsMove);
  const avgCrush = withBoth.reduce((sum, e) => {
    return sum + (e.impliedEarningsMove - Math.abs(e.actualMove));
  }, 0) / withBoth.length;

  return {
    totalEarnings: withBoth.length,
    timesImpliedOverstated: wins.length,
    winRate: Math.round((wins.length / withBoth.length) * 1000) / 10,
    avgCrushPct: Math.round(avgCrush * 100) / 100,
    avgImpliedMove: Math.round(
      (withBoth.reduce((s, e) => s + e.impliedEarningsMove, 0) / withBoth.length) * 100
    ) / 100,
    avgActualMove: Math.round(
      (withBoth.reduce((s, e) => s + Math.abs(e.actualMove), 0) / withBoth.length) * 100
    ) / 100,
  };
}

// ── HTTP helper ──

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'Accept': 'application/json' },
      timeout: 15000,
    }, (res) => {
      if (res.statusCode === 429) {
        return reject(new Error('ORATS rate limit exceeded'));
      }
      if (res.statusCode === 401 || res.statusCode === 403) {
        return reject(new Error('ORATS API token invalid or expired'));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`ORATS HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('ORATS JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('ORATS timeout')); });
  });
}
