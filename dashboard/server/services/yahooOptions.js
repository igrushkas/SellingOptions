/**
 * Yahoo Finance Options Chain — Free, No API Key
 *
 * Fetches options chain data from Yahoo Finance to calculate
 * implied move from ATM straddle pricing.
 *
 * Uses the v7 options endpoint with cookie/crumb auth.
 * Works server-side only (Node.js) due to CORS restrictions.
 */

import https from 'https';

// Cache the cookie/crumb pair (valid ~10-20 min)
let sessionCache = { cookie: null, crumb: null, fetchedAt: 0 };
const SESSION_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Calculate implied move % from ATM straddle.
 * Returns { impliedMove, iv, nearestExpiry, straddlePrice, atmStrike } or null.
 */
export async function fetchImpliedMove(ticker, stockPrice) {
  if (!stockPrice || stockPrice <= 0) return null;

  try {
    // 1. Get session (cookie + crumb)
    const session = await getSession();
    if (!session) {
      console.warn('[YahooOptions] Could not obtain session');
      return null;
    }

    // 2. Get options expirations
    const optionsData = await fetchOptions(ticker, session, null);
    if (!optionsData) return null;

    const expirations = optionsData.expirationDates || [];
    if (expirations.length === 0) return null;

    // Use nearest expiration (first one)
    const nearestExpiry = expirations[0];

    // If the first fetch already has the right expiration, use it; otherwise fetch again
    let chain = optionsData;
    const chainExpiry = chain.options?.[0]?.expirationDate;
    if (chainExpiry !== nearestExpiry) {
      chain = await fetchOptions(ticker, session, nearestExpiry);
      if (!chain) return null;
    }

    const calls = chain.options?.[0]?.calls || [];
    const puts = chain.options?.[0]?.puts || [];

    if (calls.length === 0 || puts.length === 0) return null;

    // 3. Find ATM straddle
    const atm = findATMStraddle(calls, puts, stockPrice);
    if (!atm) return null;

    const straddlePrice = atm.callMid + atm.putMid;
    const impliedMove = (straddlePrice / stockPrice) * 100;
    const avgIV = ((atm.callIV || 0) + (atm.putIV || 0)) / 2;

    // Convert expiration timestamp to date string
    const expiryDate = new Date(nearestExpiry * 1000).toISOString().split('T')[0];

    return {
      impliedMove: Math.round(impliedMove * 10) / 10,
      iv: Math.round(avgIV * 1000) / 10,
      nearestExpiry: expiryDate,
      straddlePrice: Math.round(straddlePrice * 100) / 100,
      atmStrike: atm.strike,
    };
  } catch (err) {
    console.warn(`[YahooOptions] Failed for ${ticker}: ${err.message}`);
    return null;
  }
}

// ── Session Management (cookie + crumb) ──

async function getSession() {
  // Return cached session if still valid
  if (sessionCache.cookie && Date.now() - sessionCache.fetchedAt < SESSION_TTL) {
    return sessionCache;
  }

  try {
    // Step 1: GET fc.yahoo.com to obtain consent cookie
    const cookie = await getCookie();
    if (!cookie) return null;

    // Step 2: GET crumb using the cookie
    const crumb = await getCrumb(cookie);
    if (!crumb) return null;

    sessionCache = { cookie, crumb, fetchedAt: Date.now() };
    console.log('[YahooOptions] Session established');
    return sessionCache;
  } catch (err) {
    console.warn('[YahooOptions] Session setup failed:', err.message);
    return null;
  }
}

function getCookie() {
  return new Promise((resolve) => {
    const req = https.get('https://fc.yahoo.com/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 8000,
    }, (res) => {
      // We want the Set-Cookie header regardless of status code (often 404)
      const cookies = res.headers['set-cookie'];
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (cookies && cookies.length > 0) {
          // Extract just the cookie name=value pairs
          const cookieStr = cookies.map(c => c.split(';')[0]).join('; ');
          resolve(cookieStr);
        } else {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function getCrumb(cookie) {
  return new Promise((resolve) => {
    const req = https.get('https://query2.finance.yahoo.com/v1/test/getcrumb', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': cookie,
      },
      timeout: 8000,
    }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return resolve(null);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data.trim() || null));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// ── Options Chain Fetch ──

async function fetchOptions(ticker, session, expirationTs) {
  let url = `https://query2.finance.yahoo.com/v7/finance/options/${ticker}?crumb=${encodeURIComponent(session.crumb)}`;
  if (expirationTs) url += `&date=${expirationTs}`;

  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Cookie': session.cookie,
        'Accept': 'application/json',
      },
      timeout: 10000,
    }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        // Invalidate session on auth errors
        if (res.statusCode === 401 || res.statusCode === 403) {
          sessionCache = { cookie: null, crumb: null, fetchedAt: 0 };
        }
        return resolve(null);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json?.optionChain?.result?.[0] || null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// ── ATM Straddle Calculation ──

function findATMStraddle(calls, puts, stockPrice) {
  // Find ATM call (strike closest to stock price)
  let bestCall = null;
  let bestCallDist = Infinity;
  for (const c of calls) {
    const dist = Math.abs(c.strike - stockPrice);
    if (dist < bestCallDist) {
      bestCallDist = dist;
      bestCall = c;
    }
  }

  if (!bestCall) return null;

  // Find matching put at the same strike
  const matchingPut = puts.find(p => p.strike === bestCall.strike);

  // If no exact match, find closest put
  let bestPut = matchingPut;
  if (!bestPut) {
    let bestPutDist = Infinity;
    for (const p of puts) {
      const dist = Math.abs(p.strike - stockPrice);
      if (dist < bestPutDist) {
        bestPutDist = dist;
        bestPut = p;
      }
    }
  }

  if (!bestPut) return null;

  const callMid = ((bestCall.bid || 0) + (bestCall.ask || 0)) / 2;
  const putMid = ((bestPut.bid || 0) + (bestPut.ask || 0)) / 2;

  // Yahoo provides impliedVolatility directly on each contract
  const callIV = bestCall.impliedVolatility || 0;
  const putIV = bestPut.impliedVolatility || 0;

  return {
    strike: bestCall.strike,
    callMid,
    putMid,
    callIV,
    putIV,
  };
}
