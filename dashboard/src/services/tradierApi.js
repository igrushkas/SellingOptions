/**
 * Tradier API — Options Chain Data
 *
 * Used to calculate implied move from ATM straddle pricing.
 * Sandbox (free, delayed 15min): https://sandbox.tradier.com/v1/
 * Production (live account): https://api.tradier.com/v1/
 *
 * Sign up free at https://tradier.com → API settings → Sandbox token
 */

// Frontend uses VITE_ prefix, backend uses plain env
const getToken = () =>
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TRADIER_TOKEN) || '';

const BASE = 'https://sandbox.tradier.com/v1';

/**
 * Calculate implied move % for a ticker from the nearest weekly options expiration.
 * Returns { impliedMove, iv, nearestExpiry } or null on failure.
 */
export async function fetchImpliedMove(ticker, stockPrice) {
  const token = getToken();
  if (!token || !stockPrice || stockPrice <= 0) return null;

  try {
    // 1. Get nearest expiration
    const expiry = await getNearestExpiry(ticker, token);
    if (!expiry) return null;

    // 2. Get options chain with greeks
    const chain = await getOptionsChain(ticker, expiry, token);
    if (!chain || chain.length === 0) return null;

    // 3. Find ATM call and put
    const atm = findATMStraddle(chain, stockPrice);
    if (!atm) return null;

    // Implied move = ATM straddle mid price / stock price * 100
    const straddlePrice = atm.callMid + atm.putMid;
    const impliedMove = (straddlePrice / stockPrice) * 100;

    // Average IV from ATM options
    const avgIV = ((atm.callIV || 0) + (atm.putIV || 0)) / 2;

    return {
      impliedMove: Math.round(impliedMove * 10) / 10, // 1 decimal
      iv: Math.round(avgIV * 1000) / 10, // e.g. 0.45 → 45.0%
      nearestExpiry: expiry,
      straddlePrice: Math.round(straddlePrice * 100) / 100,
      atmStrike: atm.strike,
    };
  } catch (err) {
    console.warn(`[Tradier] Failed for ${ticker}:`, err.message);
    return null;
  }
}

async function getNearestExpiry(ticker, token) {
  const res = await fetch(
    `${BASE}/markets/options/expirations?symbol=${ticker}&includeAllRoots=true&strikes=false`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
  );
  if (!res.ok) return null;
  const data = await res.json();

  const dates = data?.expirations?.date;
  if (!dates || (Array.isArray(dates) && dates.length === 0)) return null;

  // dates can be a single string or an array
  const expirations = Array.isArray(dates) ? dates : [dates];

  // Find the nearest expiration that's >= today
  const today = new Date().toISOString().split('T')[0];
  const future = expirations.filter(d => d >= today).sort();
  return future[0] || null;
}

async function getOptionsChain(ticker, expiry, token) {
  const res = await fetch(
    `${BASE}/markets/options/chains?symbol=${ticker}&expiration=${expiry}&greeks=true`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
  );
  if (!res.ok) return null;
  const data = await res.json();

  const options = data?.options?.option;
  if (!options) return null;
  return Array.isArray(options) ? options : [options];
}

function findATMStraddle(chain, stockPrice) {
  // Group by strike
  const strikes = new Map();
  for (const opt of chain) {
    if (!opt.strike) continue;
    if (!strikes.has(opt.strike)) {
      strikes.set(opt.strike, { call: null, put: null });
    }
    const side = strikes.get(opt.strike);
    if (opt.option_type === 'call') side.call = opt;
    if (opt.option_type === 'put') side.put = opt;
  }

  // Find strike closest to stock price that has both call and put
  let bestStrike = null;
  let bestDist = Infinity;

  for (const [strike, { call, put }] of strikes) {
    if (!call || !put) continue;
    const dist = Math.abs(strike - stockPrice);
    if (dist < bestDist) {
      bestDist = dist;
      bestStrike = strike;
    }
  }

  if (!bestStrike) return null;

  const { call, put } = strikes.get(bestStrike);

  const callMid = ((call.bid || 0) + (call.ask || 0)) / 2;
  const putMid = ((put.bid || 0) + (put.ask || 0)) / 2;
  const callIV = call.greeks?.mid_iv || call.greeks?.smv_vol || 0;
  const putIV = put.greeks?.mid_iv || put.greeks?.smv_vol || 0;

  return {
    strike: bestStrike,
    callMid,
    putMid,
    callIV,
    putIV,
  };
}
