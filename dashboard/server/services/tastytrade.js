import axios from 'axios';

const BASE_URL = 'https://api.tastyworks.com';
const USER_AGENT = 'VolatilityCrusher/1.0';

let accessToken = null;
let tokenExpiresAt = 0;

/**
 * Get a valid access token, refreshing if needed.
 * Uses OAuth2 refresh_token grant (refresh tokens never expire).
 */
async function getAccessToken() {
  const { TASTYTRADE_CLIENT_SECRET, TASTYTRADE_REFRESH_TOKEN } = process.env;

  if (!TASTYTRADE_CLIENT_SECRET || !TASTYTRADE_REFRESH_TOKEN) {
    throw new Error('TASTYTRADE_CLIENT_SECRET and TASTYTRADE_REFRESH_TOKEN required in .env');
  }

  // Reuse token if still valid (with 60s buffer)
  if (accessToken && Date.now() < tokenExpiresAt - 60_000) {
    return accessToken;
  }

  const res = await axios.post(`${BASE_URL}/oauth/token`, {
    'grant_type': 'refresh_token',
    'client_secret': TASTYTRADE_CLIENT_SECRET,
    'refresh_token': TASTYTRADE_REFRESH_TOKEN,
  }, {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
  });

  accessToken = res.data.access_token;
  tokenExpiresAt = Date.now() + (res.data.expires_in * 1000);
  return accessToken;
}

/**
 * Make an authenticated GET request to the Tastytrade API.
 */
async function apiGet(path, params = {}) {
  const token = await getAccessToken();
  const res = await axios.get(`${BASE_URL}${path}`, {
    params,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'User-Agent': USER_AGENT,
    },
  });
  return res.data;
}

/**
 * Fetch market metrics for one or more tickers.
 * Returns IV rank, IV percentile, per-expiration IV, earnings, etc.
 */
export async function fetchMarketMetrics(symbols) {
  const symbolList = Array.isArray(symbols) ? symbols.join(',') : symbols;
  const data = await apiGet('/market-metrics', { symbols: symbolList });
  const items = data?.data?.items || [];

  return items.map(item => ({
    symbol: item.symbol,
    impliedVolatilityIndex: item['implied-volatility-index'],
    ivIndex5DayChange: item['implied-volatility-index-5-day-change'],
    ivRank: item['implied-volatility-index-rank'],
    tosIvRank: item['tos-implied-volatility-index-rank'],
    twIvRank: item['tw-implied-volatility-index-rank'],
    ivRankSource: item['implied-volatility-index-rank-source'],
    ivPercentile: item['implied-volatility-percentile'],
    ivUpdatedAt: item['implied-volatility-updated-at'],
    iv30Day: item['implied-volatility-30-day'],
    hv30Day: item['historical-volatility-30-day'],
    hv60Day: item['historical-volatility-60-day'],
    hv90Day: item['historical-volatility-90-day'],
    ivHvDiff30Day: item['iv-hv-30-day-difference'],
    liquidityRating: item['liquidity-rating'],
    liquidityRank: item['liquidity-rank'],
    beta: item.beta,
    marketCap: item['market-cap'],
    earnings: item.earnings ? {
      expectedReportDate: item.earnings['expected-report-date'],
      isEstimated: item.earnings['estimated'],
      lateFlag: item.earnings['late-flag'],
      quarterEndDate: item.earnings['quarter-end-date'],
      actualEps: item.earnings['actual-eps'],
      consensusEstimate: item.earnings['consensus-estimate'],
      timeOfDay: item.earnings['time-of-day'],
    } : null,
    priceEarningsRatio: item['price-earnings-ratio'],
    earningsPerShare: item['earnings-per-share'],
    dividendRatePerShare: item['dividend-rate-per-share'],
    expirationIVs: (item['option-expiration-implied-volatilities'] || []).map(exp => ({
      expirationDate: exp['expiration-date'],
      settlementType: exp['settlement-type'],
      optionChainType: exp['option-chain-type'],
      impliedVolatility: exp['implied-volatility'],
    })),
  }));
}

/**
 * Fetch nested option chain for a ticker.
 * Returns all expirations with strikes, types, and OCC symbols.
 */
export async function fetchOptionChain(symbol) {
  const data = await apiGet(`/option-chains/${encodeURIComponent(symbol)}/nested`);
  const expirations = data?.data?.items?.[0]?.expirations || [];

  return expirations.map(exp => ({
    expirationDate: exp['expiration-date'],
    daysToExpiration: exp['days-to-expiration'],
    expirationType: exp['expiration-type'],
    settlementType: exp['settlement-type'],
    strikes: (exp.strikes || []).map(strike => ({
      strikePrice: strike['strike-price'],
      call: strike.call ? formatOptionLeg(strike.call) : null,
      put: strike.put ? formatOptionLeg(strike.put) : null,
    })),
  }));
}

function formatOptionLeg(leg) {
  return {
    symbol: leg['occ-symbol'] || leg.symbol,
    streamerSymbol: leg['streamer-symbol'],
  };
}

/**
 * Check if Tastytrade is configured.
 */
export function isTastytradeConfigured() {
  return !!(process.env.TASTYTRADE_CLIENT_SECRET && process.env.TASTYTRADE_REFRESH_TOKEN);
}
