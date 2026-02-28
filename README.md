# Volatility Crusher - Earnings Options Selling Dashboard

AI-powered dashboard for selling naked options around earnings events. Identifies overpriced implied volatility and recommends safe strike zones for maximizing probability of profit.

## Features

- **Earnings Calendar** — Stocks with upcoming earnings, split by pre-market (BMO) and after-market (AMC)
- **Weekly Options Filter** — Only shows stocks with weekly options available
- **Historical Earnings Moves** — 5 years of actual vs. implied moves per stock
- **IV Crush Ratio** — Identifies when implied volatility is overpriced vs. reality
- **Safe Strike Zone Calculator** — Recommends call/put strike prices at aggressive, recommended, and conservative levels
- **Win Rate Analysis** — Historical probability of profit at each strike distance
- **AI Trade Analysis** — Built-in analysis engine (local + ChatGPT API)
- **News Sentiment** — Recent headlines with impact assessment
- **Move Predictions** — Weighted predictions based on historical patterns

## Quick Start

```bash
cd dashboard
npm install
npm run dev
```

Open http://localhost:5173

## Backend Server (for live data)

```bash
# Copy and fill in your API keys
cp .env.example .env

# Start the API server
npm run server

# Or run both frontend + backend
npm run dev:full
```

## API Integrations

### Schwab / ThinkorSwim (FREE)
1. Go to https://developer.schwab.com
2. Register with your Schwab brokerage credentials
3. Create an app to get CLIENT_ID and CLIENT_SECRET
4. Add to `.env` file

### OpenAI / ChatGPT API
1. Get API key at https://platform.openai.com/api-keys
2. Enter key in the dashboard's AI Analysis panel (or add to `.env`)

## Strategy Overview

This dashboard is built for **selling premium** around earnings:

1. **Find overpriced IV** — When implied move > average historical move (IV Crush Ratio > 1.0)
2. **Sell outside the expected range** — Naked calls above the safe high, naked puts below the safe low
3. **Profit from IV crush** — After earnings, implied volatility collapses, options lose value rapidly
4. **Target 85-95% win rate** — Using recommended/conservative strike zones

## Tech Stack

- React 19 + Vite
- Tailwind CSS v4 (dark glassmorphism theme)
- Recharts (charting)
- Express.js (API server)
- Schwab API (live options data)
- OpenAI API (AI analysis)
