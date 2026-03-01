import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { scrapeEarningsCalendar, getTodaysPlays } from './services/earningsWhispers.js';
import { analyzeWithAI } from './services/openai.js';
import { fetchEarningsData, fetchIVSummary, fetchImpliedEarningsMove, buildHistoricalMoves, calcOratsIVCrushStats } from './services/orats.js';
import { fetchHistoricalOptions, fetchImpliedMove as avImpliedMove } from './services/alphaVantage.js';
import { fetchMarketMetrics, fetchOptionChain, isTastytradeConfigured } from './services/tastytrade.js';
import { getMarketSentiment, refreshMarketSentiment } from './services/marketSentiment.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Earnings calendar for a specific date
app.get('/api/earnings', async (req, res) => {
  try {
    const { date, timing } = req.query;
    const data = await scrapeEarningsCalendar(
      date || new Date().toISOString().split('T')[0],
      timing || null
    );
    res.json(data);
  } catch (error) {
    console.error('Earnings fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch earnings data', message: error.message });
  }
});

// Today's actionable plays: tonight AMC + next trading day BMO
// Optional ?date=YYYY-MM-DD to fetch plays for a specific date
app.get('/api/plays/today', async (req, res) => {
  try {
    const data = await getTodaysPlays(req.query.date || null);
    res.json(data);
  } catch (error) {
    console.error('Today plays fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch today plays', message: error.message });
  }
});

// AI analysis endpoint
app.post('/api/analyze', async (req, res) => {
  try {
    const { stock, apiKey } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }
    const analysis = await analyzeWithAI(stock, apiKey);
    res.json({ analysis });
  } catch (error) {
    console.error('AI analysis error:', error.message);
    res.status(500).json({ error: 'AI analysis failed', message: error.message });
  }
});

// ORATS: historical earnings with actual stock price moves + IV crush stats
app.get('/api/orats/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    if (!process.env.ORATS_API_TOKEN) {
      return res.status(400).json({
        error: 'ORATS not configured',
        setup: 'Add ORATS_API_TOKEN to .env — Get 14-day trial at https://orats.com/data-api',
      });
    }

    const [earnings, ivSummary, impliedMove] = await Promise.all([
      fetchEarningsData(ticker),
      fetchIVSummary(ticker),
      fetchImpliedEarningsMove(ticker),
    ]);

    const historicalMoves = earnings ? buildHistoricalMoves(earnings, 20) : [];
    const crushStats = earnings ? calcOratsIVCrushStats(earnings) : null;

    res.json({
      ticker,
      source: 'orats',
      earnings: earnings?.earnings || [],
      historicalMoves,
      crushStats,
      ivSummary,
      impliedMove: impliedMove?.impliedMove || null,
      nextEarningsDate: impliedMove?.nextEarningsDate || null,
      daysToEarnings: impliedMove?.daysToEarnings || null,
    });
  } catch (error) {
    console.error('ORATS fetch error:', error.message);
    res.status(500).json({ error: 'ORATS fetch failed', message: error.message });
  }
});

// Alpha Vantage: historical options chain with IV + Greeks
app.get('/api/alpha-vantage/options/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const { date } = req.query;

    if (!process.env.ALPHA_VANTAGE_API_KEY) {
      return res.status(400).json({
        error: 'Alpha Vantage not configured',
        setup: 'Add ALPHA_VANTAGE_API_KEY to .env — Get free key at https://www.alphavantage.co/support/#api-key',
      });
    }

    const data = date
      ? await fetchHistoricalOptions(ticker, date)
      : await avImpliedMove(ticker);

    if (!data) {
      return res.status(404).json({ error: `No options data for ${ticker}` });
    }

    res.json(data);
  } catch (error) {
    console.error('Alpha Vantage fetch error:', error.message);
    res.status(500).json({ error: 'Alpha Vantage fetch failed', message: error.message });
  }
});

// Tastytrade: market metrics (IV rank, IV percentile, per-expiration IV)
app.get('/api/tastytrade/metrics', async (req, res) => {
  try {
    const { symbols } = req.query;
    if (!isTastytradeConfigured()) {
      return res.status(400).json({
        error: 'Tastytrade not configured',
        setup: 'Add TASTYTRADE_CLIENT_SECRET and TASTYTRADE_REFRESH_TOKEN to .env',
      });
    }
    if (!symbols) {
      return res.status(400).json({ error: 'symbols query parameter required (comma-separated)' });
    }
    const metrics = await fetchMarketMetrics(symbols);
    res.json({ source: 'tastytrade', metrics });
  } catch (error) {
    console.error('Tastytrade metrics error:', error.message);
    res.status(500).json({ error: 'Tastytrade metrics failed', message: error.message });
  }
});

// Tastytrade: option chain for a ticker
app.get('/api/tastytrade/chain/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    if (!isTastytradeConfigured()) {
      return res.status(400).json({
        error: 'Tastytrade not configured',
        setup: 'Add TASTYTRADE_CLIENT_SECRET and TASTYTRADE_REFRESH_TOKEN to .env',
      });
    }
    const chain = await fetchOptionChain(ticker);
    res.json({ source: 'tastytrade', ticker, expirations: chain });
  } catch (error) {
    console.error('Tastytrade chain error:', error.message);
    res.status(500).json({ error: 'Tastytrade chain failed', message: error.message });
  }
});

// Market sentiment: ChatGPT analysis of market conditions + recent earnings
app.get('/api/market-sentiment', async (req, res) => {
  try {
    const apiKey = req.query.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error: 'OpenAI API key required',
        setup: 'Pass ?apiKey=sk-... or add OPENAI_API_KEY to .env',
      });
    }
    const force = req.query.refresh === 'true';
    const data = force
      ? await refreshMarketSentiment(apiKey)
      : await getMarketSentiment(apiKey);
    res.json(data);
  } catch (error) {
    console.error('Market sentiment error:', error.message);
    res.status(500).json({ error: 'Market sentiment failed', message: error.message });
  }
});

// Data sources status — shows which APIs are configured
app.get('/api/sources', (req, res) => {
  res.json({
    finnhub: !!process.env.FINNHUB_API_KEY,
    fmp: !!process.env.FMP_API_KEY,
    orats: !!process.env.ORATS_API_TOKEN,
    alphaVantage: !!process.env.ALPHA_VANTAGE_API_KEY,
    tastytrade: isTastytradeConfigured(),
    openai: !!process.env.OPENAI_API_KEY,
  });
});

app.listen(PORT, () => {
  const orats = process.env.ORATS_API_TOKEN ? '✓' : '✗';
  const av = process.env.ALPHA_VANTAGE_API_KEY ? '✓' : '✗';
  const finnhub = process.env.FINNHUB_API_KEY ? '✓' : '✗';
  const tasty = isTastytradeConfigured() ? '✓' : '✗';

  console.log(`\n  Volatility Crusher API Server`);
  console.log(`  Running on http://localhost:${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/api/health`);
  console.log(`\n  Data Sources:`);
  console.log(`    [${finnhub}] Finnhub      — Earnings calendar + EPS surprises`);
  console.log(`    [${tasty}] Tastytrade   — IV rank, IV percentile, option chains`);
  console.log(`    [${orats}] ORATS        — IV crush analytics + actual earnings moves`);
  console.log(`    [${av}] Alpha Vantage — Historical options with IV + Greeks`);
  console.log(`    [✓] Yahoo Finance — Stock quotes + options fallback (free)\n`);
});
