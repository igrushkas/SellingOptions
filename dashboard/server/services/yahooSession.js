/**
 * Shared Yahoo Finance Session Manager
 *
 * Yahoo Finance now requires cookie/crumb auth for ALL endpoints,
 * including the v8 chart API. This module provides a shared session
 * that all Yahoo-consuming services can use.
 *
 * Session flow:
 * 1. GET fc.yahoo.com → receive Set-Cookie header (consent cookie)
 * 2. GET query2.finance.yahoo.com/v1/test/getcrumb with cookie → receive crumb string
 * 3. Use cookie + crumb on all subsequent requests
 *
 * Sessions are cached for 10 minutes and auto-refresh.
 */

import https from 'https';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

let sessionCache = { cookie: null, crumb: null, fetchedAt: 0 };
const SESSION_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Get a valid Yahoo session (cookie + crumb).
 * Returns { cookie, crumb } or null if session cannot be established.
 */
export async function getYahooSession() {
  if (sessionCache.cookie && sessionCache.crumb && Date.now() - sessionCache.fetchedAt < SESSION_TTL) {
    return sessionCache;
  }

  try {
    const cookie = await getCookie();
    if (!cookie) {
      console.warn('[YahooSession] Could not obtain cookie');
      return null;
    }

    const crumb = await getCrumb(cookie);
    if (!crumb) {
      console.warn('[YahooSession] Could not obtain crumb');
      return null;
    }

    sessionCache = { cookie, crumb, fetchedAt: Date.now() };
    console.log('[YahooSession] Session established');
    return sessionCache;
  } catch (err) {
    console.warn('[YahooSession] Setup failed:', err.message);
    return null;
  }
}

/** Invalidate the cached session (call on 401/403 errors). */
export function invalidateYahooSession() {
  sessionCache = { cookie: null, crumb: null, fetchedAt: 0 };
}

/**
 * Fetch JSON from Yahoo with cookie/crumb auth.
 * Appends crumb param and cookie header automatically.
 * Returns parsed JSON or throws on error.
 */
export async function fetchYahooJSON(url) {
  const session = await getYahooSession();
  if (!session) {
    throw new Error('Yahoo session unavailable');
  }

  const separator = url.includes('?') ? '&' : '?';
  const authedUrl = `${url}${separator}crumb=${encodeURIComponent(session.crumb)}`;

  return new Promise((resolve, reject) => {
    const req = https.get(authedUrl, {
      headers: {
        'User-Agent': UA,
        'Cookie': session.cookie,
        'Accept': 'application/json',
      },
      timeout: 15000,
    }, (res) => {
      if (res.statusCode === 401 || res.statusCode === 403) {
        res.resume();
        invalidateYahooSession();
        return reject(new Error(`Yahoo HTTP ${res.statusCode} (auth expired)`));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`Yahoo HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Yahoo JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Yahoo timeout')); });
  });
}

// ── Internal helpers ──

function getCookie() {
  return new Promise((resolve) => {
    const req = https.get('https://fc.yahoo.com/', {
      headers: { 'User-Agent': UA },
      timeout: 8000,
    }, (res) => {
      const cookies = res.headers['set-cookie'];
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (cookies && cookies.length > 0) {
          resolve(cookies.map(c => c.split(';')[0]).join('; '));
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
      headers: { 'User-Agent': UA, 'Cookie': cookie },
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
