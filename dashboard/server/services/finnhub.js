/**
 * Finnhub.io earnings API (PRIMARY source)
 * Free tier: 60 calls/min
 *
 * Endpoints used:
 * - /calendar/earnings — upcoming earnings dates + EPS estimates
 * - /stock/earnings — historical earnings surprises (for historicalMoves)
 */

import https from 'https';

const BASE = 'https://finnhub.io/api/v1';

/**
 * Fetch earnings calendar for a date range.
 * Returns basic calendar entries (ticker, date, timing, EPS).
 */
export async function fetchEarningsCalendar(apiKey, fromDate, toDate) {
  const url = `${BASE}/calendar/earnings?from=${fromDate}&to=${toDate}&token=${apiKey}`;
  console.log(`[Finnhub] Fetching earnings ${fromDate} → ${toDate}`);

  const data = await fetchJSON(url);

  if (!data?.earningsCalendar) {
    throw new Error('Finnhub returned no earningsCalendar');
  }

  return data.earningsCalendar.map(e => ({
    ticker: e.symbol,
    company: e.symbol,
    date: e.date,
    timing: mapTiming(e.hour),
    epsEstimate: e.epsEstimate,
    epsPrior: e.epsActual,
    revenueEstimate: e.revenueEstimate,
    revenueActual: e.revenueActual,
    quarter: e.quarter,
    year: e.year,
    source: 'finnhub',
  }));
}

/**
 * Fetch historical earnings surprises for a ticker.
 * Returns last N quarters of actual EPS vs estimate, which we convert to historicalMoves.
 * Finnhub /stock/earnings returns: [{ actual, estimate, period, quarter, surprise, surprisePercent, symbol, year }]
 */
export async function fetchEarningsSurprises(apiKey, ticker) {
  const url = `${BASE}/stock/earnings?symbol=${ticker}&limit=20&token=${apiKey}`;

  try {
    const data = await fetchJSON(url);

    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }

    return data.map(e => {
      const surprisePct = e.surprisePercent || 0;
      return {
        quarter: `Q${e.quarter} ${e.year}`,
        actual: Math.abs(surprisePct),
        direction: surprisePct >= 0 ? 'up' : 'down',
        date: e.period || '',
      };
    });
  } catch {
    return [];
  }
}

function mapTiming(hour) {
  if (hour === 'bmo') return 'BMO';
  if (hour === 'amc') return 'AMC';
  if (hour === 'dmh') return 'AMC';
  return 'AMC';
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'Accept': 'application/json' },
      timeout: 10000,
    }, (res) => {
      if (res.statusCode === 429) {
        return reject(new Error('Finnhub rate limit exceeded'));
      }
      if (res.statusCode === 401 || res.statusCode === 403) {
        return reject(new Error('Finnhub API key invalid'));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Finnhub HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Finnhub JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Finnhub timeout')); });
  });
}
