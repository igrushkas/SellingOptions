import { useState, useMemo, useEffect, useCallback } from 'react';
import Header from './components/Header';
import KPICards from './components/KPICards';
import EarningsTable from './components/EarningsTable';
import StockDetail from './components/StockDetail';
import AIAnalysisPanel from './components/AIAnalysisPanel';
import TodayPlays from './components/TodayPlays';
import TradeTracker, { AddTradeModal, CloseTradeModal } from './components/TradeTracker';
import LoginScreen from './components/LoginScreen';
import MarketSentiment from './components/MarketSentiment';
import { useAuth } from './hooks/useAuth';
import { subscribeTrades, addTrade } from './services/tradeService';
import { fetchTodaysPlaysDirect } from './services/earningsApi';
import { formatCurrency } from './utils/calculations';
import { updateTrade } from './services/tradeService';
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
    const day = now.getDay(); // 0=Sun, 6=Sat
    if (day === 0 || day === 6) return 'off'; // Weekends: market closed
    const h = now.getHours();
    const m = now.getMinutes();
    const t = h + m / 60;
    if (t >= 9 && t < 14) return 'morning';     // 9am–2pm: close trades
    if (t >= 14 && t < 16) return 'afternoon';   // 2pm–4pm: scan & sell
    return 'off';                                 // before 9am or after 4pm
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
    <div className={`rounded-xl border p-4 transition-opacity ${
      dimmed
        ? 'border-glass-border bg-dark-700/30 opacity-40'
        : 'border-neon-green/30 bg-neon-green/5 glow-green'
    }`}>
      <div className="flex items-center gap-2 mb-3">
        <AlertCircle className={`w-5 h-5 ${dimmed ? 'text-gray-500' : 'text-neon-green'}`} />
        <h3 className={`text-sm font-bold ${dimmed ? 'text-gray-500' : 'text-neon-green'}`}>
          Close Open Trades
        </h3>
        {!dimmed && (
          <span className="text-xs text-gray-400 ml-1">
            — Review positions from last night and close for IV crush profit
          </span>
        )}
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

  // ── Main Dashboard View ──
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

      <main className="max-w-[1400px] mx-auto px-6 lg:px-10 pt-4 pb-12 space-y-4">
        {/* Time-aware status banner */}
        <div className={`rounded-xl border p-3 flex items-center gap-3 ${
          timePhase === 'morning' ? 'border-neon-green/30 bg-neon-green/5' :
          timePhase === 'afternoon' ? 'border-neon-blue/30 bg-neon-blue/5' :
          'border-glass-border bg-dark-700/30'
        }`}>
          <Clock className={`w-5 h-5 ${
            timePhase === 'morning' ? 'text-neon-green' :
            timePhase === 'afternoon' ? 'text-neon-blue' :
            'text-gray-500'
          }`} />
          <span className={`text-sm font-semibold ${
            timePhase === 'morning' ? 'text-neon-green' :
            timePhase === 'afternoon' ? 'text-neon-blue' :
            'text-gray-500'
          }`}>
            {timePhase === 'morning' && 'Morning — Close your open trades for IV crush profit'}
            {timePhase === 'afternoon' && 'Afternoon — Time to scan tonight & tomorrow plays and sell'}
            {timePhase === 'off' && (new Date().getDay() === 0 || new Date().getDay() === 6
              ? 'Weekend — Previewing Monday evening & Tuesday morning plays'
              : 'Market closed — Review your positions and prepare for next session')}
          </span>
          <span className="ml-auto text-xs text-gray-500">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Daily Workflow + Strategy */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Section title="Daily Workflow" icon={Clock} color="blue">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-xs">
                {[
                  { step: '1', time: '9:30-10 AM', desc: 'Close positions within first 30 min for IV crush profit.', phase: 'morning' },
                  { step: '2', time: '10 AM', desc: 'Mark trades as won/lost. Review P&L.', phase: 'morning' },
                  { step: '3', time: '2-3 PM', desc: 'Review tonight AMC + next day BMO. Pick best setups.', phase: 'afternoon' },
                  { step: '4', time: '3-3:45 PM', desc: 'Sell options at recommended strikes. Log trades.', phase: 'afternoon' },
                ].map(({ step, time, desc, phase }) => {
                  const isActive = timePhase === phase;
                  return (
                    <div key={step} className={`flex items-start gap-2 p-2 rounded-lg transition-all ${
                      isActive ? 'bg-neon-blue/10 border border-neon-blue/20 ring-1 ring-neon-blue/20' : 'opacity-40'
                    }`}>
                      <span className={`rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-xs font-bold ${
                        isActive ? 'bg-neon-blue/30 text-neon-blue' : 'bg-dark-600 text-gray-500'
                      }`}>{step}</span>
                      <div>
                        <span className={`font-semibold ${isActive ? 'text-white' : 'text-gray-600'}`}>{time}</span>
                        <p className={`mt-0.5 ${isActive ? 'text-gray-300' : 'text-gray-600'}`}>{desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          </div>
          <div className="lg:col-span-1">
            <Section title="Strategy" icon={Crosshair} color="purple">
              <p className="text-xs text-gray-300 leading-relaxed">
                <span className="text-white font-semibold">Volatility Crusher</span> finds stocks where the options market is <span className="text-neon-orange font-semibold">overpricing</span> the expected earnings move. Sell options outside the expected range and collect premium as IV collapses. Each stock gets a <span className="text-neon-green font-semibold">strategy recommendation</span> based on directional bias, IV crush ratio, and win rate.
              </p>
            </Section>
          </div>
        </div>

        {/* KPI Stats */}
        <Section title="Stats Overview" icon={BarChart3} color="green" count={allEarnings.length}>
          <KPICards earnings={allEarnings} />
        </Section>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-glass-border pb-3">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab.key
                  ? 'bg-neon-blue/15 text-neon-blue border border-neon-blue/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-dark-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            {dataSources && (
              <div className="flex items-center gap-1" title="Active data sources">
                <Database className="w-3 h-3 text-gray-500" />
                {dataSources.orats && <span className="text-[11px] px-1 py-0.5 rounded bg-neon-purple/10 text-neon-purple font-semibold">ORATS</span>}
                {dataSources.alphaVantage && <span className="text-[11px] px-1 py-0.5 rounded bg-neon-green/10 text-neon-green font-semibold">AV</span>}
                {dataSources.finnhub && <span className="text-[11px] px-1 py-0.5 rounded bg-gray-700 text-gray-400 font-semibold">FH</span>}
              </div>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${badge.cls}`}>
              {badge.label}
            </span>
            <button
              onClick={fetchLiveEarnings}
              disabled={loading}
              className="p-1.5 rounded-lg hover:bg-dark-700 text-gray-400 hover:text-white transition-all disabled:opacity-50"
              title="Refresh earnings data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Offline banner */}
        {dataSource === 'offline' && (
          <div className="p-3 rounded-lg bg-neon-red/10 border border-neon-red/20 flex items-center gap-3">
            <WifiOff className="w-4 h-4 text-neon-red shrink-0" />
            <div className="text-xs">
              <span className="text-neon-red font-semibold">No live data.</span>
              <span className="text-gray-400 ml-2">{errorMsg || 'API keys may be missing or server is down.'}</span>
            </div>
          </div>
        )}

        {/* Today's Plays Tab */}
        {activeTab === 'today' && (
          <div className="space-y-4">
            {/* Morning: Open trades to close */}
            <OpenTradesAlert
              trades={trades}
              dimmed={timePhase !== 'morning'}
              onCloseTrade={setClosingTrade}
            />

            <Section title="Market Sentiment" icon={Activity} color="blue" defaultOpen={false}>
              <MarketSentiment />
            </Section>
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
          <div className="space-y-4">
            <Section title={`Before Market Open (${bmoStocks.length})`} icon={Sun} color="orange">
              <EarningsTable
                stocks={bmoStocks}
                selectedStock={selectedStock}
                onSelectStock={setSelectedStock}
              />
            </Section>
            <Section title={`After Market Close (${amcStocks.length})`} icon={Moon} color="purple">
              <EarningsTable
                stocks={amcStocks}
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
