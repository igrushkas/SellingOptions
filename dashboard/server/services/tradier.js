/**
 * Tradier API — Options Chain (Backend)
 *
 * Calculates implied move from ATM straddle pricing.
 * Sandbox: https://sandbox.tradier.com/v1/ (free, 15min delayed)
 */

import https from 'https';

const BASE = 'sandbox.tradier.com';

/**
 * Calculate implied move % for a ticker.
 */
export async function fetchImpliedMove(token, ticker, stockPrice) {
  if (!token || !stockPrice || stockPrice <= 0) return null;

  try {
    const expiry = await getNearestExpiry(token, ticker);
    if (!expiry) return null;

    const chain = await getOptionsChain(token, ticker, expiry);
    if (!chain || chain.length === 0) return null;

    const atm = findATMStraddle(chain, stockPrice);
    if (!atm) return null;

    const straddlePrice = atm.callMid + atm.putMid;
    const impliedMove = (straddlePrice / stockPrice) * 100;
    const avgIV = ((atm.callIV || 0) + (atm.putIV || 0)) / 2;

    return {
      impliedMove: Math.round(impliedMove * 10) / 10,
      iv: Math.round(avgIV * 1000) / 10,
      nearestExpiry: expiry,
      straddlePrice: Math.round(straddlePrice * 100) / 100,
      atmStrike: atm.strike,
    };
  } catch (err) {
    console.warn(`[Tradier] Failed for ${ticker}: ${err.message}`);
    return null;
  }
}

async function getNearestExpiry(token, ticker) {
  const data = await tradierGet(token, `/v1/markets/options/expirations?symbol=${ticker}&includeAllRoots=true&strikes=false`);
  const dates = data?.expirations?.date;
  if (!dates) return null;

  const expirations = Array.isArray(dates) ? dates : [dates];
  const today = new Date().toISOString().split('T')[0];
  const future = expirations.filter(d => d >= today).sort();
  return future[0] || null;
}

async function getOptionsChain(token, ticker, expiry) {
  const data = await tradierGet(token, `/v1/markets/options/chains?symbol=${ticker}&expiration=${expiry}&greeks=true`);
  const options = data?.options?.option;
  if (!options) return null;
  return Array.isArray(options) ? options : [options];
}

function findATMStraddle(chain, stockPrice) {
  const strikes = new Map();
  for (const opt of chain) {
    if (!opt.strike) continue;
    if (!strikes.has(opt.strike)) strikes.set(opt.strike, { call: null, put: null });
    const side = strikes.get(opt.strike);
    if (opt.option_type === 'call') side.call = opt;
    if (opt.option_type === 'put') side.put = opt;
  }

  let bestStrike = null;
  let bestDist = Infinity;
  for (const [strike, { call, put }] of strikes) {
    if (!call || !put) continue;
    const dist = Math.abs(strike - stockPrice);
    if (dist < bestDist) { bestDist = dist; bestStrike = strike; }
  }

  if (!bestStrike) return null;
  const { call, put } = strikes.get(bestStrike);

  return {
    strike: bestStrike,
    callMid: ((call.bid || 0) + (call.ask || 0)) / 2,
    putMid: ((put.bid || 0) + (put.ask || 0)) / 2,
    callIV: call.greeks?.mid_iv || call.greeks?.smv_vol || 0,
    putIV: put.greeks?.mid_iv || put.greeks?.smv_vol || 0,
  };
}

function tradierGet(token, path) {
  return new Promise((resolve, reject) => {
    const req = https.get({
      hostname: BASE,
      path,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      timeout: 10000,
    }, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`Tradier HTTP ${res.statusCode}`));
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Tradier JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Tradier timeout')); });
  });
}
