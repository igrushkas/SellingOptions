import express from 'express';
import cors from 'cors';
import { scrapeEarningsCalendar } from './services/earningsWhispers.js';
import { getOptionsChain } from './services/schwabApi.js';
import { analyzeWithAI } from './services/openai.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Earnings calendar
app.get('/api/earnings', async (req, res) => {
  try {
    const { date } = req.query;
    const data = await scrapeEarningsCalendar(date || new Date().toISOString().split('T')[0]);
    res.json(data);
  } catch (error) {
    console.error('Earnings fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch earnings data', message: error.message });
  }
});

// Options chain from Schwab
app.get('/api/options/:ticker', async (req, res) => {
  try {
    const { ticker } = req.params;
    const { expiration } = req.query;
    const data = await getOptionsChain(ticker, expiration);
    res.json(data);
  } catch (error) {
    console.error('Options fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch options data', message: error.message });
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

app.listen(PORT, () => {
  console.log(`\n  Volatility Crusher API Server`);
  console.log(`  Running on http://localhost:${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/api/health\n`);
});
