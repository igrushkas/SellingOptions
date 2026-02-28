# Volatility Crusher — Architecture & Infrastructure Guide

## What This App Does

An options-selling dashboard for profiting from **IV crush** around earnings announcements. The strategy: when implied volatility (what the market expects) is higher than actual historical moves, sell options outside the expected range and collect premium as IV collapses after earnings.

**Core workflow:**
1. Fetch upcoming earnings (AMC = after market close, BMO = before market open)
2. For each stock, compare implied move vs historical actual moves
3. Calculate IV crush ratio, win rates, and safe strike zones
4. Show trade signals (Excellent / Good / Neutral / Risky)
5. Log trades and track P&L in a journal

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + Vite | React 19.2, Vite 7.3 |
| Styling | Tailwind CSS v4 | Dark glassmorphism theme |
| Charts | Recharts | 3.7 |
| Icons | Lucide React | 0.575 |
| Backend | Express.js | 5.1 |
| Database | Firebase Firestore | 12.10 |
| Auth | Firebase Auth (Google OAuth) | Email-gated |
| Hosting | Firebase Hosting | Auto-deploy via GitHub Actions |
| HTTP | Axios (server) + Fetch (client) | |

---

## Repository Structure

```
SellingOptions/
├── .github/workflows/
│   └── firebase-deploy.yml          # CI/CD: build + deploy to Firebase Hosting
├── dashboard/
│   ├── .env                          # API keys (gitignored, never committed)
│   ├── .env.example                  # Template for .env setup
│   ├── package.json                  # Dependencies + scripts
│   ├── vite.config.js                # Vite config (base path, proxy, Tailwind)
│   ├── eslint.config.js              # ESLint flat config
│   ├── index.html                    # HTML entry point
│   ├── server/
│   │   ├── index.js                  # Express server — all API routes
│   │   └── services/
│   │       ├── earningsWhispers.js   # Orchestrator: Finnhub→FMP fallback + enrichment
│   │       ├── finnhub.js            # Finnhub API: earnings calendar + EPS surprises
│   │       ├── fmp.js                # FMP API: earnings calendar (fallback)
│   │       ├── orats.js              # ORATS API: historical earnings moves + IV crush
│   │       ├── alphaVantage.js       # Alpha Vantage: options chain + implied move
│   │       ├── tastytrade.js         # Tastytrade: IV rank/percentile + option chains
│   │       ├── yahooOptions.js       # Yahoo Finance: free ATM straddle implied move
│   │       └── openai.js             # OpenAI GPT-4o: AI trade analysis
│   └── src/
│       ├── main.jsx                  # React entry point
│       ├── App.jsx                   # Main dashboard: auth gate, tabs, data fetching
│       ├── App.css                   # (empty — styles in index.css)
│       ├── index.css                 # Tailwind theme + glassmorphism + animations
│       ├── firebase.js               # Firebase config + Firestore/Auth init
│       ├── components/
│       │   ├── LoginScreen.jsx       # Google OAuth login (email-gated)
│       │   ├── Header.jsx            # Top bar: date filter, weekly toggle, logout
│       │   ├── KPICards.jsx           # 6 KPI cards: setups, win rate, IV crush, etc.
│       │   ├── TodayPlays.jsx        # Card grid: tonight AMC + tomorrow BMO plays
│       │   ├── EarningsTable.jsx     # Sortable earnings table (All Earnings tab)
│       │   ├── StockDetail.jsx       # Deep stock analysis panel (chart, zones, stats)
│       │   ├── AIAnalysisPanel.jsx   # Local + ChatGPT analysis engine
│       │   └── TradeTracker.jsx      # Trade journal with P&L tracking
│       ├── services/
│       │   ├── earningsApi.js        # Client-side Finnhub/FMP direct calls (no backend needed)
│       │   └── tradeService.js       # Firestore CRUD for trades collection
│       ├── hooks/
│       │   └── useAuth.js            # Firebase Google OAuth hook (email gate)
│       ├── utils/
│       │   └── calculations.js       # IV crush ratio, win rate, safe zones, predictions
│       └── data/
│           └── mockData.js           # 8-stock mock data (development fallback)
├── firebase.json                     # Firebase Hosting + Firestore config
├── .firebaserc                       # Firebase project: sellingoptions-a8da4
├── firestore.rules                   # Firestore security rules (owner-only)
├── firestore.indexes.json            # (empty — no custom indexes)
└── README.md                         # Basic setup instructions
```

---

## Data Flow Architecture

### Earnings Data Pipeline

```
Frontend (App.jsx)
  │
  ├─ TRY: Backend server (localhost:3001)
  │     GET /api/plays/today
  │     │
  │     └─ earningsWhispers.js (orchestrator)
  │          │
  │          ├─ Step 1: Get earnings calendar
  │          │   ├─ TRY: Finnhub /calendar/earnings
  │          │   └─ FALLBACK: FMP /earning_calendar
  │          │
  │          ├─ Step 2: Enrich each ticker
  │          │   ├─ Yahoo Finance quote → price, company name
  │          │   ├─ Finnhub /stock/earnings → historical EPS surprises
  │          │   ├─ ORATS (if configured) → actual stock moves + implied moves
  │          │   ├─ Alpha Vantage (if configured) → ATM straddle implied move
  │          │   └─ Yahoo Options (free fallback) → ATM straddle implied move
  │          │
  │          └─ Returns: enriched stock objects with historicalMoves, impliedMove, etc.
  │
  └─ FALLBACK: Direct browser API calls
        earningsApi.js → Finnhub/FMP directly (no backend required)
```

### IV Data Source Priority (for impliedMove)

1. **ORATS** — Most accurate, has pre-calculated implied earnings moves
2. **Alpha Vantage** — ATM straddle pricing, 25 calls/day free tier
3. **Yahoo Finance** — Free, no API key, cookie+crumb auth
4. **Default: 0** — If no options data source available

### Historical Moves Source Priority

1. **ORATS** — Actual stock price % moves on earnings day
2. **Finnhub** — EPS surprise % (not stock move, but useful proxy)

---

## API Integrations

### Server-Side APIs (dashboard/server/services/)

| Service | File | Auth | Rate Limit | What It Provides |
|---------|------|------|-----------|-----------------|
| **Finnhub** | finnhub.js | API key (`FINNHUB_API_KEY`) | 60/min free | Earnings calendar, EPS surprises |
| **FMP** | fmp.js | API key (`FMP_API_KEY`) | 250/day free | Earnings calendar (fallback) |
| **ORATS** | orats.js | Token (`ORATS_API_TOKEN`) | Paid ($99/mo) | IV crush stats, actual earnings moves, implied earnings move |
| **Alpha Vantage** | alphaVantage.js | API key (`ALPHA_VANTAGE_API_KEY`) | 25/day free | Options chain with Greeks, implied move from ATM straddle |
| **Tastytrade** | tastytrade.js | OAuth2 refresh token | Unknown | IV rank, IV percentile, HV, liquidity, per-expiration IVs |
| **Yahoo Finance** | yahooOptions.js | Cookie + crumb (free) | Unknown | ATM straddle implied move (free fallback) |
| **OpenAI** | openai.js | Bearer token (user-supplied) | Per OpenAI plan | GPT-4o trade analysis |

### Client-Side APIs (dashboard/src/services/)

| Service | File | Auth | What It Does |
|---------|------|------|-------------|
| **Finnhub** | earningsApi.js | `VITE_FINNHUB_API_KEY` | Direct browser calls when backend is down |
| **FMP** | earningsApi.js | `VITE_FMP_API_KEY` | Fallback for direct browser calls |

---

## Environment Variables (.env)

```bash
# --- Server-side keys (for Express backend, never exposed to browser) ---
FINNHUB_API_KEY=...              # Earnings calendar + EPS surprises
FMP_API_KEY=...                  # Earnings calendar fallback
ORATS_API_TOKEN=                 # IV crush analytics (paid, optional)
ALPHA_VANTAGE_API_KEY=...        # Options chain + implied move (free 25/day)
TASTYTRADE_CLIENT_SECRET=...     # OAuth2 client secret
TASTYTRADE_REFRESH_TOKEN=...     # OAuth2 refresh token (never expires)

# --- Frontend keys (baked into Vite build, exposed to browser) ---
VITE_FINNHUB_API_KEY=...         # Same Finnhub key for client-side fallback
VITE_FMP_API_KEY=...             # Same FMP key for client-side fallback
```

**Important:** `.env` is gitignored. When pulling code to a new machine, you must recreate it from `.env.example` and add your API keys.

---

## Express Server Routes

| Method | Endpoint | Handler | Description |
|--------|----------|---------|-------------|
| GET | `/api/health` | inline | Health check |
| GET | `/api/earnings?date=&timing=` | earningsWhispers | Earnings calendar for date |
| GET | `/api/plays/today` | earningsWhispers | Tonight AMC + next day BMO (main endpoint) |
| POST | `/api/analyze` | openai | AI analysis (requires `apiKey` in body) |
| GET | `/api/orats/:ticker` | orats | ORATS earnings data + IV crush stats |
| GET | `/api/alpha-vantage/options/:ticker?date=` | alphaVantage | Options chain or implied move |
| GET | `/api/tastytrade/metrics?symbols=X,Y` | tastytrade | IV rank, IV percentile, market metrics |
| GET | `/api/tastytrade/chain/:ticker` | tastytrade | Full nested option chain |
| GET | `/api/sources` | inline | Which APIs are configured (boolean map) |

---

## Frontend Components

### App.jsx — Main Dashboard
- **Auth gate**: Shows `LoginScreen` until Google OAuth sign-in
- **Dashboard**: Three tabs — Today's Plays, All Earnings, Trade Journal
- **Data fetch**: Tries backend `/api/plays/today` first, falls back to direct Finnhub/FMP browser calls
- **Source badges**: Shows ORATS / ALPHA V / FINNHUB / FMP / OFFLINE status

### LoginScreen.jsx
- Google Sign-In button
- Email gate: Only `irishka.lebedeva@gmail.com` allowed (enforced in `useAuth` hook + Firestore rules)

### Header.jsx
- Date filter (calendar picker)
- Weekly Options toggle (filters to stocks with market cap > $2B)
- Stock count indicator
- Sign-out button

### KPICards.jsx
- 6 aggregate metrics computed from all earnings:
  - Excellent Setups (IV crush > 1.2, win rate > 75%)
  - Good Setups (IV crush > 1.0, win rate > 60%)
  - Avg Win Rate
  - Avg IV Crush Ratio
  - Highest IV Stock
  - Risky Setups (crush < 0.8)

### TodayPlays.jsx (Today's Plays tab)
- Two sections: "Tonight's Earnings (AMC)" + "Next Trading Day Morning (BMO)"
- PlayCard for each stock: ticker, signal, price, implied move, win rate, IV crush, quick strike zones
- "Log Trade" button on each card
- 4-step daily workflow reminder

### EarningsTable.jsx (All Earnings tab)
- Sortable table: Company, Price, Implied Move, Avg Move, IV Crush, Win Rate, Bias, Signal
- Color-coded signal badges
- Row click → opens StockDetail

### StockDetail.jsx
- **HistoricalMovesChart**: Recharts bar chart showing 20 quarters of actual vs implied moves
- **SafeZoneVisual**: Price bar with aggressive/recommended/conservative strike zones + win rates
- **PredictionCard**: Grid with predicted range, IV crush ratio, win rate, directional bias, signal
- **NewsPanel**: Headlines with sentiment (positive/negative/mixed) and options selling impact
- **StatsRow**: 8 stats (Avg/Median/Max Move, EPS Est/Prior, Revenue Est, Rating, Analysts)
- **OratsInsights**: ORATS IV crush statistics (when ORATS data available)
- **TastytradeMetrics**: Live IV rank, IV percentile, HV, beta, liquidity (fetches from `/api/tastytrade/metrics`)

### AIAnalysisPanel.jsx
- **Local Analysis**: Algorithm-generated markdown analysis from calculations.js
- **ChatGPT Mode**: User enters OpenAI API key → calls `/api/analyze` → GPT-4o analysis
- Markdown renderer for analysis output

### TradeTracker.jsx (Trade Journal tab)
- P&L summary cards: Total P&L, Win Rate, Open Positions, Premium Collected, Total Trades
- Filter tabs: All / Open / Closed / Won / Lost
- Trade table with date, ticker, type, strike, premium, quantity, status, P&L
- **AddTradeModal**: Log new trade (type, strike, premium, contracts, notes)
- **CloseTradeModal**: Close position (result: won/lost, buy-to-close price)
- Firestore real-time sync

---

## Key Calculation Functions (utils/calculations.js)

| Function | What It Does |
|----------|-------------|
| `calcIVCrushRatio(impliedMove, historicalMoves)` | impliedMove / avgMove — >1.0 means IV is overpriced |
| `calcHistoricalWinRate(impliedMove, historicalMoves)` | % of times actual move was less than implied |
| `calcSafeZone(price, impliedMove, historicalMoves)` | Returns 3 strike zones with estimated win rates |
| `getTradeSignal(crushRatio, winRate)` | excellent / good / neutral / risky |
| `calcDirectionalBias(historicalMoves)` | bullish / bearish / neutral from last 8 quarters |
| `predictNextMove(historicalMoves)` | Weighted prediction using exponential decay |
| `calcAvgMove / calcMedianMove / calcMaxMove / calcStdDev` | Statistical functions on historical moves |

---

## Authentication & Security

- **Firebase Auth**: Google OAuth provider
- **Email gate**: Only `irishka.lebedeva@gmail.com` can sign in (checked in `useAuth.js`)
- **Firestore rules**: `/trades/{tradeId}` — read/write only for authenticated owner email
- **API keys**: Server-side keys never exposed to browser; `VITE_` prefixed keys are build-time only

---

## Deployment

### Firebase Hosting (Production)
- **Project**: `sellingoptions-a8da4`
- **Site**: `sellingoptions-a8da4.web.app`
- **Public dir**: `dashboard/dist`
- **SPA rewrite**: All routes → `/index.html`

### GitHub Actions CI/CD
- **Trigger**: Push to `main`/`master` affecting `dashboard/**` or `firebase.json`
- **Steps**: Install → Create .env with secrets → Build → Deploy to Firebase
- **Secrets needed**: `FIREBASE_SERVICE_ACCOUNT`, `VITE_FINNHUB_API_KEY`, `VITE_FMP_API_KEY`

### Local Development
```bash
cd dashboard
npm install

# Frontend only (uses direct browser API calls)
npm run dev          # http://localhost:5173

# Backend API server
npm run server       # http://localhost:3001

# Both (full stack)
npm run dev:full     # Frontend + Backend
```

Vite proxies `/api/*` → `http://localhost:3001` in dev mode.

---

## Tastytrade OAuth2 Setup

Tastytrade uses OAuth2 refresh token flow (username/password was deprecated Dec 2025):

1. Go to https://developer.tastytrade.com/ → OAuth Applications → Create App
2. Create a Grant → get `client_secret` and `refresh_token`
3. Add to `.env`:
   ```
   TASTYTRADE_CLIENT_SECRET=your_secret
   TASTYTRADE_REFRESH_TOKEN=your_refresh_token
   ```
4. Refresh tokens never expire; access tokens auto-refresh every 15 minutes
5. Base URL: `https://api.tastyworks.com`
6. Required header: `User-Agent: VolatilityCrusher/1.0`

---

## Stock Data Object Shape

Each earnings stock flowing through the system has this structure:

```javascript
{
  id: "NVDA-2026-02-28",
  ticker: "NVDA",
  company: "NVIDIA Corp",
  price: 285.50,
  marketCap: 1800000000000,
  sector: "Technology",
  date: "2026-02-28",
  timing: "AMC",                    // AMC or BMO
  hasWeeklyOptions: true,           // true if marketCap > $2B
  impliedMove: 7.2,                 // % expected move from options pricing
  ivSource: "orats",                // orats | alpha_vantage | yahoo | null
  historicalMoves: [                // last 20 quarters
    { quarter: "Q4 2025", actual: 3.2, direction: "up", date: "2025-11-20" }
  ],
  historySource: "orats",           // orats | finnhub
  epsEstimate: 0.89,
  epsPrior: 0.78,
  revenueEstimate: 12400000000,
  consensusRating: "Buy",
  analystCount: 42,
  news: [
    { title: "NVDA beats expectations", sentiment: "positive", date: "2026-02-27" }
  ]
}
```

---

## Known Limitations

1. **impliedMove = 0** when no options data source is available (ORATS, Alpha Vantage, or Yahoo). This makes IV crush ratio and strike zones show as "neutral/unknown."
2. **Alpha Vantage free tier** is limited to 25 API calls/day — cached for 24 hours to stay within limits.
3. **ORATS is paid** ($99/month) — most data works without it, but historical actual stock moves (not just EPS) require ORATS.
4. **Production build** (Firebase Hosting) only has frontend — no Express backend. Production uses direct browser API calls to Finnhub/FMP only.
5. **Single-user app** — email-gated to one Google account.
