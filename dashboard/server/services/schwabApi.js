/**
 * Charles Schwab / TD Ameritrade API Integration
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to https://developer.schwab.com
 * 2. Log in with your Schwab brokerage credentials
 * 3. Register a new app to get CLIENT_ID and CLIENT_SECRET
 * 4. Set redirect URI to http://localhost:3001/callback
 * 5. Add these to your .env file:
 *    SCHWAB_CLIENT_ID=your_client_id
 *    SCHWAB_CLIENT_SECRET=your_client_secret
 *    SCHWAB_REDIRECT_URI=http://localhost:3001/callback
 *
 * The Schwab API provides:
 * - Real-time options chains with Greeks
 * - Weekly options availability
 * - Implied volatility data
 * - Historical price data
 *
 * This is FREE with your Schwab/ThinkorSwim account!
 */

const SCHWAB_BASE_URL = 'https://api.schwabapi.com/marketdata/v1';

let accessToken = null;
let tokenExpiry = null;

/**
 * Authenticate with Schwab API using OAuth2
 */
export async function authenticate() {
  const clientId = process.env.SCHWAB_CLIENT_ID;
  const clientSecret = process.env.SCHWAB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Schwab API credentials not configured. ' +
      'Set SCHWAB_CLIENT_ID and SCHWAB_CLIENT_SECRET in .env file. ' +
      'Get these free at https://developer.schwab.com'
    );
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch('https://api.schwabapi.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(`Schwab auth failed: ${response.statusText}`);
  }

  const data = await response.json();
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000);

  return accessToken;
}

/**
 * Get options chain for a ticker
 * Includes weekly options if available
 */
export async function getOptionsChain(ticker, expiration) {
  try {
    // Try live API first
    if (!accessToken || Date.now() >= tokenExpiry) {
      await authenticate();
    }

    const params = new URLSearchParams({
      symbol: ticker,
      contractType: 'ALL',
      includeUnderlyingQuote: 'true',
      strategy: 'SINGLE',
      range: 'OTM', // Out of the money only (what we sell)
      strikeCount: 20,
    });

    if (expiration) {
      params.append('toDate', expiration);
    }

    const response = await fetch(
      `${SCHWAB_BASE_URL}/chains?${params.toString()}`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      throw new Error(`Options API error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      source: 'schwab',
      ticker,
      underlying: data.underlyingPrice,
      hasWeeklyOptions: data.numberOfContracts > 0,
      callExpDateMap: data.callExpDateMap,
      putExpDateMap: data.putExpDateMap,
    };
  } catch (error) {
    console.warn(`Schwab API unavailable for ${ticker}:`, error.message);

    // Return guidance for setup
    return {
      source: 'mock',
      ticker,
      message: 'Schwab API not configured. Using mock data.',
      setupGuide: {
        step1: 'Visit https://developer.schwab.com and log in',
        step2: 'Create a new app to get API credentials',
        step3: 'Add SCHWAB_CLIENT_ID and SCHWAB_CLIENT_SECRET to .env',
        step4: 'Restart the server',
        cost: 'FREE with your ThinkorSwim account',
      },
      hasWeeklyOptions: true,
      calls: [],
      puts: [],
    };
  }
}

/**
 * Check if a ticker has weekly options available
 */
export async function hasWeeklyOptions(ticker) {
  try {
    const chain = await getOptionsChain(ticker);
    // Weekly options have expirations within the next 7 days
    if (chain.callExpDateMap) {
      const expirations = Object.keys(chain.callExpDateMap);
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return expirations.some(exp => {
        const expDate = new Date(exp.split(':')[0]);
        return expDate <= nextWeek;
      });
    }
    return chain.hasWeeklyOptions || false;
  } catch {
    return true; // Assume yes if we can't check
  }
}
