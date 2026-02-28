/**
 * Financial Modeling Prep earnings calendar API (FALLBACK source)
 * Free tier: 250 calls/day
 * Docs: https://site.financialmodelingprep.com/developer/docs/earnings-calendar-api
 */

import https from 'https';

const BASE = 'https://financialmodelingprep.com/api/v3';

export async function fetchEarningsCalendar(apiKey, fromDate, toDate) {
  const url = `${BASE}/earning_calendar?from=${fromDate}&to=${toDate}&apikey=${apiKey}`;
  console.log(`[FMP] Fetching earnings ${fromDate} → ${toDate}`);

  const data = await fetchJSON(url);

  if (!Array.isArray(data)) {
    throw new Error('FMP returned unexpected format');
  }

  // FMP returns: [{ date, symbol, eps, epsEstimated, time, revenue, revenueEstimated, fiscalDateEnding, updatedFromDate }]
  // time: "bmo" or "amc"
  return data.map(e => ({
    ticker: e.symbol,
    company: e.symbol,
    date: e.date,
    timing: mapTiming(e.time),
    epsEstimate: e.epsEstimated,
    epsPrior: e.eps,
    revenueEstimate: e.revenueEstimated,
    quarter: null,
    year: null,
    source: 'fmp',
  }));
}

function mapTiming(time) {
  if (time === 'bmo') return 'BMO';
  if (time === 'amc') return 'AMC';
  return 'AMC';
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'Accept': 'application/json' },
      timeout: 10000,
    }, (res) => {
      if (res.statusCode === 429) {
        return reject(new Error('FMP rate limit exceeded'));
      }
      if (res.statusCode === 401 || res.statusCode === 403) {
        return reject(new Error('FMP API key invalid'));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`FMP HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('FMP JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('FMP timeout')); });
  });
}
