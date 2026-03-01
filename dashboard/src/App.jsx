import { useState, useMemo, useEffect, useCallback } from 'react';
import Header from './components/Header';
import KPICards from './components/KPICards';
import EarningsTable from './components/EarningsTable';
import StockDetail from './components/StockDetail';
import AIAnalysisPanel from './components/AIAnalysisPanel';
import TodayPlays from './components/TodayPlays';
import TradeTracker, { AddTradeModal, CloseTradeModal } from './components/TradeTracker';
import LoginScreen from './components/LoginScreen';
import { useAuth } from './hooks/useAuth';
import { subscribeTrades, addTrade } from './services/tradeService';
import { fetchTodaysPlaysDirect } from './services/earningsApi';
import { formatCurrency } from './utils/calculations';
import { updateTrade } from './services/tradeService';
import { isMarketOpen, isHalfDay, getMarketStatus, fmt } from './utils/marketCalendar';
import { Crosshair, LayoutGrid, BookOpen, RefreshCw, WifiOff, Database, Clock, ChevronDown, ChevronUp, BarChart3, Sun, Moon, Activity, AlertCircle, Check } from 'lucide-react';
import './index.css';

const API_BASE = '/api';

// ── Collapsible Section wrapper ──
function Section({ title, icon: Icon, count, color = 'gray', defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const colorMap = {
    blue: { bg: 'bg-neon-blue/8', border: 'border-neon-blue/15', text: 'text-neon-blue' },
    purple: { bg: 'bg-neon-purple/8', border: 'border-neon-purple/15', text: 'text-neon-purple' },
    green: { bg: 'bg-neon-green/8', border: 'border-neon-green/15', text: 'text-neon-green' },
    orange: { bg: 'bg-neon-orange/8', border: 'border-neon-orange/15', text: 'text-neon-orange' },
    gray: { bg: 'bg-dark-700/50', border: 'border-glass-border', text: 'text-gray-300' },
  };
  const c = colorMap[color] || colorMap.gray;

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 text-left"
      >
        {Icon && <Icon className={`w-4 h-4 ${c.text}`} />}
        <span className={`text-sm font-bold ${c.text}`}>{title}</span>
        {count != null && (
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/5 text-gray-400 font-semibold">{count}</span>
        )}
        <div className="ml-auto">
          {open ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
        </div>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

function App() {
  const { user, loading: authLoading, error: authError, login, logout } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={login} error={authError} loading={authLoading} />;
  }

  return <Dashboard user={user} onLogout={logout} />;
}

// ── Time phase detection ──
function useTimePhase() {
  const [phase, setPhase] = useState(() => getPhase());

  function getPhase() {
    const now = new Date();
    const todayStr = fmt(now);
    if (!isMarketOpen(todayStr)) return 'off'; // Weekend, holiday
    const halfDay = isHalfDay(todayStr);
    const h = now.getHours();
    const m = now.getMinutes();
    const t = h + m / 60;
    if (halfDay && t >= 13) return 'off'; // Half day: market closes at 1pm ET
    if (t >= 9 && t < 14) return 'morning';     // 9am–2pm: close trades
    if (t >= 14 && t < 16) return 'afternoon';   // 2pm–4pm: scan & sell
    return 'off';
  }

  useEffect(() => {
    const id = setInterval(() => setPhase(getPhase()), 60_000);
    return () => clearInterval(id);
  }, []);

  return phase;
}

// ── Open Trades Alert (morning section) ──
function OpenTradesAlert({ trades, dimmed, onCloseTrade }) {
  const openTrades = trades.filter(t => t.status === 'open');

  return (
    <div className={`rounded-2xl border p-6 transition-opacity ${
      dimmed
        ? 'border-glass-border bg-dark-700/30 opacity-40'
        : 'border-neon-green/30 bg-neon-green/5 glow-green'
    }`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${dimmed ? 'bg-dark-600' : 'bg-neon-green/15'}`}>
          <AlertCircle className={`w-5 h-5 ${dimmed ? 'text-gray-500' : 'text-neon-green'}`} />
        </div>
        <div>
          <h3 className={`text-base font-bold ${dimmed ? 'text-gray-500' : 'text-neon-green'}`}>
            Close Open Trades
          </h3>
          {!dimmed && (
            <p className="text-xs text-gray-400">
              Review positions from last night and close for IV crush profit
            </p>
          )}
        </div>
      </div>

      {openTrades.length === 0 ? (
        <p className={`text-sm ${dimmed ? 'text-gray-600' : 'text-gray-400'}`}>
          You did not have anything to close.
        </p>
      ) : (
        <div className="space-y-2">
          {openTrades.map(trade => (
            <div
              key={trade.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                dimmed ? 'bg-dark-700/30 border-glass-border' : 'bg-dark-700/60 border-neon-green/20'
              }`}
            >
              <div className="flex items-center gap-4">
                <span className="text-base font-bold text-white">{trade.ticker}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  trade.tradeType === 'call'
                    ? 'bg-neon-red/15 text-neon-red'
                    : 'bg-neon-green/15 text-neon-green'
                }`}>
                  SELL {trade.tradeType.toUpperCase()}
                </span>
                <span className="text-sm text-gray-300">@ {formatCurrency(trade.strike)}</span>
                <span className="text-xs text-gray-500">
                  {trade.contracts} contract{trade.contracts > 1 ? 's' : ''} | Premium: {formatCurrency(trade.premium)}
                </span>
                <span className="text-xs text-gray-600">
                  Opened {new Date(trade.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
              {!dimmed && (
                <button
                  onClick={() => onCloseTrade(trade)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neon-green/20 text-neon-green text-xs font-semibold border border-neon-green/30 hover:bg-neon-green/30 transition-all"
                >
                  <Check className="w-3.5 h-3.5" />
                  Close
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Dashboard({ user, onLogout }) {
  const timePhase = useTimePhase(); // 'morning' | 'afternoon' | 'off'
  const [closingTrade, setClosingTrade] = useState(null);
  const [selectedStock, setSelectedStock] = useState(null);
  const [dateFilter, setDateFilter] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [showWeeklyOnly, setShowWeeklyOnly] = useState(true);
  const [activeTab, setActiveTab] = useState('today');
  const [addTradeStock, setAddTradeStock] = useState(null);

  const [liveAMC, setLiveAMC] = useState([]);
  const [liveBMO, setLiveBMO] = useState([]);
  const [dataSource, setDataSource] = useState('loading');
  const [dataSources, setDataSources] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [amcLabel, setAmcLabel] = useState('');
  const [bmoLabel, setBmoLabel] = useState('');

  const [trades, setTrades] = useState([]);

  useEffect(() => {
    const unsubscribe = subscribeTrades(setTrades);
    return () => unsubscribe();
  }, []);

  const fetchLiveEarnings = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const isCustomDate = dateFilter !== todayStr;
    const dateParam = isCustomDate ? `?date=${dateFilter}` : '';

    try {
      const [playsRes, sourcesRes] = await Promise.all([
        fetch(`${API_BASE}/plays/today${dateParam}`),
        fetch(`${API_BASE}/sources`).catch(() => null),
      ]);

      if (sourcesRes?.ok) {
        const sources = await sourcesRes.json();
        setDataSources(sources);
      }

      if (playsRes.ok) {
        const data = await playsRes.json();
        setLiveAMC(data.amcEarnings || []);
        setLiveBMO(data.bmoEarnings || []);
        setAmcLabel(data.amcLabel || '');
        setBmoLabel(data.bmoLabel || '');

        const allStocks = [...(data.amcEarnings || []), ...(data.bmoEarnings || [])];
        const hasOrats = allStocks.some(s => s.ivSource === 'orats' || s.historySource === 'orats');
        const hasAV = allStocks.some(s => s.ivSource === 'alpha_vantage');
        const src = hasOrats ? 'orats' : hasAV ? 'alpha_vantage' : (data.sources?.amc || data.sources?.bmo || 'finnhub');
        setDataSource(src === 'error' ? 'offline' : src);
        setLoading(false);
        return;
      }
    } catch {
      // Backend not available
    }

    try {
      const data = await fetchTodaysPlaysDirect(isCustomDate ? dateFilter : null);
      setLiveAMC(data.amcEarnings || []);
      setLiveBMO(data.bmoEarnings || []);
      setAmcLabel(data.amcLabel || '');
      setBmoLabel(data.bmoLabel || '');
      const src = data.sources?.amc || data.sources?.bmo || 'none';
      setDataSource(src === 'none' ? 'offline' : src);
      if (src === 'none') {
        setErrorMsg('No API keys found. Add VITE_FINNHUB_API_KEY to .env and rebuild.');
      } else if (data.amcEarnings.length === 0 && data.bmoEarnings.length === 0) {
        setErrorMsg('No earnings scheduled for this period.');
      }
    } catch {
      setLiveAMC([]);
      setLiveBMO([]);
      setDataSource('offline');
      setErrorMsg('Failed to fetch earnings data.');
    } finally {
      setLoading(false);
    }
  }, [dateFilter]);

  useEffect(() => {
    fetchLiveEarnings();
  }, [fetchLiveEarnings]);

  const allEarnings = useMemo(() => {
    let data = [...liveAMC, ...liveBMO];
    if (showWeeklyOnly) {
      data = data.filter(e => e.hasWeeklyOptions);
    }
    return data;
  }, [liveAMC, liveBMO, showWeeklyOnly]);

  const bmoStocks = allEarnings.filter(e => e.timing === 'BMO');
  const amcStocks = allEarnings.filter(e => e.timing === 'AMC');
  const openTradesCount = trades.filter(t => t.status === 'open').length;

  const tabs = [
    { key: 'today', label: "Today's Plays", icon: Crosshair },
    { key: 'all', label: 'All Earnings', icon: LayoutGrid },
    { key: 'journal', label: `Trade Journal${openTradesCount ? ` (${openTradesCount})` : ''}`, icon: BookOpen },
  ];

  const sourceBadge = {
    orats: { label: 'ORATS', cls: 'bg-neon-purple/15 text-neon-purple border-neon-purple/30' },
    alpha_vantage: { label: 'ALPHA V', cls: 'bg-neon-green/15 text-neon-green border-neon-green/30' },
    finnhub: { label: 'FINNHUB', cls: 'bg-neon-green/15 text-neon-green border-neon-green/30' },
    fmp: { label: 'FMP', cls: 'bg-neon-blue/15 text-neon-blue border-neon-blue/30' },
    offline: { label: 'OFFLINE', cls: 'bg-neon-red/15 text-neon-red border-neon-red/30' },
    loading: { label: 'LOADING', cls: 'bg-neon-orange/15 text-neon-orange border-neon-orange/30' },
  };
  const badge = sourceBadge[dataSource] || sourceBadge.finnhub;

  // ── Full-page Stock Detail View ──
  if (selectedStock) {
    return (
      <div className="min-h-screen bg-dark-900">
        <Header
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          showWeeklyOnly={showWeeklyOnly}
          setShowWeeklyOnly={setShowWeeklyOnly}
          totalStocks={allEarnings.length}
          user={user}
          onLogout={onLogout}
        />
        <main className="max-w-[1400px] mx-auto px-6 lg:px-10 pt-4 pb-12">
          <StockDetail
            stock={selectedStock}
            onClose={() => setSelectedStock(null)}
            onAddTrade={setAddTradeStock}
          />
          <div className="mt-3">
            <AIAnalysisPanel stock={selectedStock} />
          </div>
        </main>

        {addTradeStock && (
          <AddTradeModal
            stock={addTradeStock}
            onSave={async (trade) => { await addTrade(trade); setAddTradeStock(null); }}
            onClose={() => setAddTradeStock(null)}
          />
        )}
      </div>
    );
  }

  // ── Main Dashboard View — Sidebar + Content layout ──
  const statusMsg = (() => {
    if (timePhase === 'morning') return 'Morning — Close your open trades for IV crush profit';
    if (timePhase === 'afternoon') return 'Afternoon — Time to scan plays and sell';
    const status = getMarketStatus(fmt(new Date()));
    if (!status.open) return `Market closed${status.holiday ? ` — ${status.holiday}` : ''}`;
    return 'Market closed — Prepare for next session';
  })();

  return (
    <div className="min-h-screen bg-dark-900 flex">
      {/* ── Sidebar ── */}
      <aside className="hidden lg:flex flex-col w-56 bg-dark-800/60 border-r border-glass-border p-6 sticky top-0 h-screen">
        <div className="flex items-center gap-2.5 mb-10">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center">
            <Crosshair className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="text-base font-bold gradient-text">Volatility Crusher</span>
        </div>

        <nav className="space-y-1.5 flex-1">
          <div className="text-[11px] text-gray-500 uppercase tracking-wider mb-2 px-3">Main</div>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-neon-blue/15 text-neon-blue'
                  : 'text-gray-400 hover:text-white hover:bg-dark-700/60'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}

          <div className="text-[11px] text-gray-500 uppercase tracking-wider mt-8 mb-2 px-3">Controls</div>
          <div className="px-3 space-y-3">
            <div>
              <label className="text-[11px] text-gray-500 uppercase block mb-1">Date</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full bg-dark-700 border border-glass-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-neon-blue"
              />
            </div>
            <button
              onClick={() => setShowWeeklyOnly(!showWeeklyOnly)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                showWeeklyOnly
                  ? 'bg-neon-blue/15 text-neon-blue border border-neon-blue/30'
                  : 'bg-dark-700 text-gray-400 border border-glass-border'
              }`}
            >
              Weekly Options Only
            </button>
          </div>
        </nav>

        {/* Data source + refresh */}
        <div className="mt-auto pt-4 border-t border-glass-border space-y-3">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-lg border font-semibold ${badge.cls}`}>{badge.label}</span>
            <button
              onClick={fetchLiveEarnings}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-dark-700 text-gray-400 hover:text-white transition-all disabled:opacity-50"
              title="Refresh earnings data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {user && (
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:text-neon-red hover:bg-neon-red/10 transition-all"
            >
              Sign out
            </button>
          )}
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 min-h-screen overflow-y-auto">
        {/* Mobile header (hidden on desktop where sidebar shows) */}
        <div className="lg:hidden">
          <Header
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            showWeeklyOnly={showWeeklyOnly}
            setShowWeeklyOnly={setShowWeeklyOnly}
            totalStocks={allEarnings.length}
            user={user}
            onLogout={onLogout}
          />
        </div>

        <main className="max-w-[1400px] mx-auto px-8 lg:px-12 pt-8 pb-16 space-y-8">
          {/* Welcome Banner */}
          <div className="rounded-2xl bg-gradient-to-r from-dark-700 via-dark-600 to-dark-700 border border-glass-border p-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">
                  {timePhase === 'morning' ? 'Good morning!' : timePhase === 'afternoon' ? 'Time to trade!' : 'Welcome back!'}
                </h1>
                <p className="text-sm text-gray-400">{statusMsg}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-xs text-gray-500 block">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="text-lg font-bold text-white">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>

            {/* Workflow Steps — inline in banner */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              {[
                { step: '1', time: '9:30 AM', desc: 'Close positions', phase: 'morning' },
                { step: '2', time: '10 AM', desc: 'Mark won/lost', phase: 'morning' },
                { step: '3', time: '2-3 PM', desc: 'Review plays', phase: 'afternoon' },
                { step: '4', time: '3:45 PM', desc: 'Sell options', phase: 'afternoon' },
              ].map(({ step, time, desc, phase }) => {
                const isActive = timePhase === phase;
                return (
                  <div key={step} className={`rounded-xl border px-4 py-3 transition-all ${
                    isActive
                      ? 'bg-neon-blue/10 border-neon-blue/30'
                      : 'bg-dark-800/40 border-glass-border opacity-40'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                        isActive ? 'bg-neon-blue/30 text-neon-blue' : 'bg-dark-600 text-gray-600'
                      }`}>{step}</span>
                      <span className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-gray-600'}`}>{time}</span>
                    </div>
                    <p className={`text-xs ${isActive ? 'text-gray-300' : 'text-gray-600'}`}>{desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* KPI Cards */}
          <KPICards earnings={allEarnings} />

          {/* Offline banner */}
          {dataSource === 'offline' && (
            <div className="p-4 rounded-2xl bg-neon-red/10 border border-neon-red/20 flex items-center gap-3">
              <WifiOff className="w-5 h-5 text-neon-red shrink-0" />
              <div className="text-sm">
                <span className="text-neon-red font-semibold">No live data.</span>
                <span className="text-gray-400 ml-2">{errorMsg || 'API keys may be missing or server is down.'}</span>
              </div>
            </div>
          )}

          {/* Today's Plays Tab */}
          {activeTab === 'today' && (
            <div className="space-y-8">
              <OpenTradesAlert
                trades={trades}
                dimmed={timePhase !== 'morning'}
                onCloseTrade={setClosingTrade}
              />
              <TodayPlays
                amcEarnings={amcStocks}
                bmoEarnings={bmoStocks}
                amcLabel={amcLabel}
                bmoLabel={bmoLabel}
                onSelectStock={setSelectedStock}
                onAddTrade={setAddTradeStock}
                dimPlays={timePhase === 'morning'}
              />
            </div>
          )}

          {/* All Earnings Tab */}
          {activeTab === 'all' && (
            <div className="space-y-8">
              <Section title={`After Market Close (${amcStocks.length})`} icon={Moon} color="purple">
                <EarningsTable
                  stocks={amcStocks}
                  selectedStock={selectedStock}
                  onSelectStock={setSelectedStock}
                />
              </Section>
              <Section title={`Before Market Open (${bmoStocks.length})`} icon={Sun} color="orange">
                <EarningsTable
                  stocks={bmoStocks}
                  selectedStock={selectedStock}
                  onSelectStock={setSelectedStock}
                />
              </Section>
            </div>
          )}

          {/* Trade Journal Tab */}
          {activeTab === 'journal' && (
            <TradeTracker
              trades={trades}
              setTrades={setTrades}
              addTradeStock={addTradeStock}
              setAddTradeStock={setAddTradeStock}
            />
          )}
        </main>
      </div>

      {addTradeStock && (
        <AddTradeModal
          stock={addTradeStock}
          onSave={async (trade) => { await addTrade(trade); setAddTradeStock(null); }}
          onClose={() => setAddTradeStock(null)}
        />
      )}

      {closingTrade && (
        <CloseTradeModal
          trade={closingTrade}
          onSave={async (updated) => {
            const { id, ...fields } = updated;
            await updateTrade(id, {
              status: fields.status,
              closedPrice: fields.closedPrice,
              closedDate: fields.closedDate,
              pnl: fields.pnl,
            });
            setClosingTrade(null);
          }}
          onClose={() => setClosingTrade(null)}
        />
      )}
    </div>
  );
}

export default App;
