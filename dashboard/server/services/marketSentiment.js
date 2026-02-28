/**
 * Market Sentiment & Earnings Context Service
 *
 * Fetches overall market data (SPY, QQQ, VIX) + recent earnings results,
 * then uses ChatGPT to generate a market context report analyzing how
 * broad market conditions affect upcoming earnings plays.
 *
 * Designed to run ~3x/day (8-hour cache).
 */

import https from 'https';

const CACHE_TTL = 8 * 60 * 60 * 1000; // 8 hours (run 3x/day)
let sentimentCache = null;
let cacheTimestamp = 0;

/**
 * Get market sentiment analysis. Returns cached version if fresh.
 */
export async function getMarketSentiment(openaiKey) {
  if (!openaiKey) {
    throw new Error('OpenAI API key required for market sentiment analysis');
  }

  // Return cache if fresh
  if (sentimentCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return sentimentCache;
  }

  // 1. Fetch market data in parallel
  const [spyData, qqqData, vixData, recentEarnings] = await Promise.all([
    fetchMarketHistory('SPY', 5),
    fetchMarketHistory('QQQ', 5),
    fetchMarketHistory('%5EVIX', 5),  // ^VIX encoded
    fetchRecentEarningsResults(),
  ]);

  // 2. Build context for ChatGPT
  const marketContext = buildMarketContext(spyData, qqqData, vixData, recentEarnings);

  // 3. Get ChatGPT analysis
  const analysis = await fetchChatGPTAnalysis(openaiKey, marketContext);

  // 4. Cache and return
  sentimentCache = {
    generatedAt: new Date().toISOString(),
    cacheExpiresAt: new Date(Date.now() + CACHE_TTL).toISOString(),
    market: {
      spy: formatMarketSummary(spyData),
      qqq: formatMarketSummary(qqqData),
      vix: formatVIXSummary(vixData),
    },
    recentEarnings: recentEarnings.slice(0, 10),
    analysis,
  };
  cacheTimestamp = Date.now();

  return sentimentCache;
}

/**
 * Force refresh the sentiment (ignores cache).
 */
export async function refreshMarketSentiment(openaiKey) {
  cacheTimestamp = 0;
  sentimentCache = null;
  return getMarketSentiment(openaiKey);
}

// ── Market Data Fetching ──

async function fetchMarketHistory(symbol, days) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${days}d`;
    const json = await fetchJSON(url);
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};

    const history = timestamps.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().split('T')[0],
      open: quotes.open?.[i],
      high: quotes.high?.[i],
      low: quotes.low?.[i],
      close: quotes.close?.[i],
      volume: quotes.volume?.[i],
    })).filter(d => d.close != null);

    return {
      symbol: meta.symbol || symbol,
      name: meta.longName || meta.shortName || symbol,
      currentPrice: meta.regularMarketPrice || meta.previousClose,
      history,
    };
  } catch (err) {
    console.warn(`[MarketSentiment] Failed to fetch ${symbol}: ${err.message}`);
    return null;
  }
}

async function fetchRecentEarningsResults() {
  const finnhubKey = process.env.FINNHUB_API_KEY;
  if (!finnhubKey) return [];

  try {
    // Fetch last 5 trading days of earnings
    const today = new Date();
    const fiveDaysAgo = new Date(today);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const from = fmt(fiveDaysAgo);
    const to = fmt(today);
    const url = `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${finnhubKey}`;
    const data = await fetchJSON(url);

    if (!data?.earningsCalendar) return [];

    // Only return stocks that have actual results (epsActual not null)
    return data.earningsCalendar
      .filter(e => e.epsActual != null && e.epsEstimate != null)
      .map(e => ({
        ticker: e.symbol,
        date: e.date,
        epsEstimate: e.epsEstimate,
        epsActual: e.epsActual,
        surprise: e.epsActual - e.epsEstimate,
        surprisePct: e.epsEstimate !== 0
          ? (((e.epsActual - e.epsEstimate) / Math.abs(e.epsEstimate)) * 100).toFixed(1)
          : 'N/A',
        beat: e.epsActual > e.epsEstimate,
        revenueEstimate: e.revenueEstimate,
        revenueActual: e.revenueActual,
      }))
      .slice(0, 20);
  } catch (err) {
    console.warn(`[MarketSentiment] Failed to fetch recent earnings: ${err.message}`);
    return [];
  }
}

// ── Formatting Helpers ──

function formatMarketSummary(data) {
  if (!data || !data.history?.length) return null;

  const hist = data.history;
  const latest = hist[hist.length - 1];
  const first = hist[0];
  const periodChange = ((latest.close - first.open) / first.open * 100).toFixed(2);

  const dailyChanges = hist.map((d, i) => {
    if (i === 0) return { ...d, change: 0 };
    const prev = hist[i - 1];
    return { ...d, change: ((d.close - prev.close) / prev.close * 100).toFixed(2) };
  });

  return {
    symbol: data.symbol,
    currentPrice: data.currentPrice,
    periodChange: parseFloat(periodChange),
    dailyChanges: dailyChanges.map(d => ({
      date: d.date,
      close: d.close?.toFixed(2),
      change: parseFloat(d.change),
    })),
  };
}

function formatVIXSummary(data) {
  if (!data || !data.history?.length) return null;

  const hist = data.history;
  const latest = hist[hist.length - 1];
  const direction = latest.close > 20 ? 'elevated' : latest.close > 15 ? 'moderate' : 'low';

  return {
    current: latest.close?.toFixed(2),
    direction,
    history: hist.map(d => ({ date: d.date, close: d.close?.toFixed(2) })),
  };
}

function buildMarketContext(spyData, qqqData, vixData, recentEarnings) {
  let context = '## Current Market Conditions (Last 5 Trading Days)\n\n';

  if (spyData?.history?.length) {
    const spy = formatMarketSummary(spyData);
    context += `### S&P 500 (SPY): $${spy.currentPrice} (${spy.periodChange > 0 ? '+' : ''}${spy.periodChange}% over 5 days)\n`;
    spy.dailyChanges.forEach(d => {
      context += `  - ${d.date}: $${d.close} (${d.change > 0 ? '+' : ''}${d.change}%)\n`;
    });
    context += '\n';
  }

  if (qqqData?.history?.length) {
    const qqq = formatMarketSummary(qqqData);
    context += `### Nasdaq 100 (QQQ): $${qqq.currentPrice} (${qqq.periodChange > 0 ? '+' : ''}${qqq.periodChange}% over 5 days)\n`;
    qqq.dailyChanges.forEach(d => {
      context += `  - ${d.date}: $${d.close} (${d.change > 0 ? '+' : ''}${d.change}%)\n`;
    });
    context += '\n';
  }

  if (vixData?.history?.length) {
    const vix = formatVIXSummary(vixData);
    context += `### VIX (Fear Index): ${vix.current} — ${vix.direction}\n`;
    vix.history.forEach(d => {
      context += `  - ${d.date}: ${d.close}\n`;
    });
    context += '\n';
  }

  if (recentEarnings.length > 0) {
    context += '## Recent Earnings Results (Last 5 Days)\n\n';
    const beats = recentEarnings.filter(e => e.beat).length;
    const misses = recentEarnings.length - beats;
    context += `**Summary:** ${beats} beats, ${misses} misses out of ${recentEarnings.length} reports\n\n`;

    recentEarnings.forEach(e => {
      const emoji = e.beat ? 'BEAT' : 'MISS';
      context += `- **${e.ticker}** (${e.date}): ${emoji} — EPS $${e.epsActual} vs est $${e.epsEstimate} (${e.surprisePct}% surprise)\n`;
    });
    context += '\n';
  }

  return context;
}

// ── ChatGPT Analysis ──

async function fetchChatGPTAnalysis(apiKey, marketContext) {
  const systemPrompt = `You are a senior options strategist who specializes in selling premium around earnings events.
Your job is to provide a daily market context briefing that helps options sellers understand how broad market conditions
affect their earnings plays.

You focus on:
1. How overall market direction (bullish/bearish/choppy) affects post-earnings stock moves
2. Whether recent earnings beats/misses are being rewarded or punished by the market
3. VIX levels and what they mean for premium sellers
4. Specific patterns: Are stocks going down despite beating? Are markets rotating sectors?
5. Actionable guidance for today's options selling decisions

Use real examples from the recent earnings data provided.
Be concise but insightful. Format in markdown.
IMPORTANT: Always include a disclaimer that this is not financial advice.`;

  const userPrompt = `${marketContext}

Based on this data, provide your daily market sentiment briefing for options sellers:

1. **Market Mood** — Is the market rewarding or punishing earnings beats right now? (1-2 sentences)
2. **Recent Earnings Patterns** — Pick 2-3 notable recent earnings from the data and explain what happened and why (were beats sold off? did misses rally?)
3. **VIX & Volatility Context** — What does the current VIX tell us about premium selling opportunities?
4. **Impact on Today's Plays** — How should these conditions change our approach to tonight's AMC and tomorrow's BMO earnings?
5. **Risk Factors** — Any macro concerns (Fed, geopolitics, sector rotation) that could override individual stock setups?
6. **Bottom Line** — One clear sentence: Is today a good day to sell premium or should we be more cautious?`;

  try {
    const body = JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body,
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || `OpenAI HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (err) {
    console.error(`[MarketSentiment] ChatGPT analysis failed: ${err.message}`);
    throw err;
  }
}

// ── Utilities ──

function fmt(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      timeout: 10000,
    }, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}
