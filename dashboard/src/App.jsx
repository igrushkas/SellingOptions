import { useState, useMemo, useEffect, useCallback } from 'react';
import Header from './components/Header';
import KPICards from './components/KPICards';
import EarningsTable from './components/EarningsTable';
import StockDetail from './components/StockDetail';
import AIAnalysisPanel from './components/AIAnalysisPanel';
import TodayPlays from './components/TodayPlays';
import TradeTracker from './components/TradeTracker';
import LoginScreen from './components/LoginScreen';
import MarketSentiment from './components/MarketSentiment';
import { useAuth } from './hooks/useAuth';
import { subscribeTrades } from './services/tradeService';
import { fetchTodaysPlaysDirect } from './services/earningsApi';
import { Crosshair, LayoutGrid, BookOpen, RefreshCw, WifiOff, Database } from 'lucide-react';
import './index.css';

const API_BASE = '/api';

function App() {
  const { user, loading: authLoading, error: authError, login, logout } = useAuth();

  // Auth gate — show login screen until authenticated
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

function Dashboard({ user, onLogout }) {
  const [selectedStock, setSelectedStock] = useState(null);
  const [dateFilter, setDateFilter] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [showWeeklyOnly, setShowWeeklyOnly] = useState(true);
  const [activeTab, setActiveTab] = useState('today');
  const [addTradeStock, setAddTradeStock] = useState(null);

  // Live earnings data — NO mock fallback
  const [liveAMC, setLiveAMC] = useState([]);
  const [liveBMO, setLiveBMO] = useState([]);
  const [dataSource, setDataSource] = useState('loading');
  const [dataSources, setDataSources] = useState(null); // { finnhub, orats, alphaVantage, ... }
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [amcLabel, setAmcLabel] = useState('');
  const [bmoLabel, setBmoLabel] = useState('');

  // Load trades from Firestore
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    const unsubscribe = subscribeTrades(setTrades);
    return () => unsubscribe();
  }, []);

  // Fetch live earnings: try backend first, then call APIs directly
  const fetchLiveEarnings = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');

    // 1. Try backend server (local dev)
    try {
      const [playsRes, sourcesRes] = await Promise.all([
        fetch(`${API_BASE}/plays/today`),
        fetch(`${API_BASE}/sources`).catch(() => null),
      ]);

      // Capture which data sources are configured
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

        // Detect best data source from enriched stock data
        const allStocks = [...(data.amcEarnings || []), ...(data.bmoEarnings || [])];
        const hasOrats = allStocks.some(s => s.ivSource === 'orats' || s.historySource === 'orats');
        const hasAV = allStocks.some(s => s.ivSource === 'alpha_vantage');
        const src = hasOrats ? 'orats' : hasAV ? 'alpha_vantage' : (data.sources?.amc || data.sources?.bmo || 'finnhub');
        setDataSource(src === 'error' ? 'offline' : src);
        setLoading(false);
        return;
      }
    } catch {
      // Backend not available — fall through to direct API calls
    }

    // 2. Call Finnhub/FMP directly from browser
    try {
      const data = await fetchTodaysPlaysDirect();
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
  }, []);

  useEffect(() => {
    fetchLiveEarnings();
  }, [fetchLiveEarnings]);

  const allEarnings = useMemo(() => {
    let data = [...liveAMC, ...liveBMO];

    // Filter out stocks with no useful data (implied move 0 AND no historical moves)
    data = data.filter(e => {
      const hasImplied = e.impliedMove > 0;
      const hasHistory = e.historicalMoves && e.historicalMoves.length > 0;
      return hasImplied || hasHistory;
    });

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

      <main className="max-w-[1400px] mx-auto px-8 lg:px-12 pt-6 pb-12">
        <KPICards earnings={allEarnings} />

        {/* Tab Navigation */}
        <div className="flex items-center gap-3 mt-8 mb-6 border-b border-glass-border pb-3">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSelectedStock(null); }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab.key
                  ? 'bg-neon-blue/15 text-neon-blue border border-neon-blue/30'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-dark-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-3">
            {dataSources && (
              <div className="flex items-center gap-1.5" title="Active data sources">
                <Database className="w-3 h-3 text-gray-500" />
                {dataSources.orats && <span className="text-[9px] px-1.5 py-0.5 rounded bg-neon-purple/10 text-neon-purple font-semibold">ORATS</span>}
                {dataSources.alphaVantage && <span className="text-[9px] px-1.5 py-0.5 rounded bg-neon-green/10 text-neon-green font-semibold">AV</span>}
                {dataSources.finnhub && <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400 font-semibold">FH</span>}
              </div>
            )}
            <span className={`text-[10px] px-2.5 py-1 rounded-full border font-semibold ${badge.cls}`}>
              {badge.label}
            </span>
            <button
              onClick={fetchLiveEarnings}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-dark-700 text-gray-400 hover:text-white transition-all disabled:opacity-50"
              title="Refresh earnings data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Offline banner */}
        {dataSource === 'offline' && (
          <div className="mb-6 p-4 rounded-lg bg-neon-red/10 border border-neon-red/20 flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-neon-red shrink-0" />
            <div className="text-sm">
              <span className="text-neon-red font-semibold">No live data.</span>
              <span className="text-gray-400 ml-2">{errorMsg || 'API keys may be missing or server is down.'}</span>
            </div>
          </div>
        )}

        {/* Today's Plays Tab */}
        {activeTab === 'today' && (
          <>
            <MarketSentiment />
            <TodayPlays
              amcEarnings={amcStocks}
              bmoEarnings={bmoStocks}
              amcLabel={amcLabel}
              bmoLabel={bmoLabel}
              onSelectStock={setSelectedStock}
              onAddTrade={setAddTradeStock}
            />
            {selectedStock && (
              <div className="mt-8 space-y-6">
                <StockDetail
                  stock={selectedStock}
                  onClose={() => setSelectedStock(null)}
                />
                <AIAnalysisPanel stock={selectedStock} />
              </div>
            )}
          </>
        )}

        {/* All Earnings Tab */}
        {activeTab === 'all' && (
          <div className={`grid gap-8 ${selectedStock ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'}`}>
            <div className={selectedStock ? 'lg:col-span-1' : ''}>
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-2 h-2 rounded-full bg-neon-orange pulse-live"></div>
                  <h2 className="text-lg font-semibold text-white">
                    Before Market Open ({bmoStocks.length})
                  </h2>
                  <span className="text-xs text-gray-500 ml-2">Pre-market earnings</span>
                </div>
                <EarningsTable
                  stocks={bmoStocks}
                  selectedStock={selectedStock}
                  onSelectStock={setSelectedStock}
                />
              </div>

              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-2 h-2 rounded-full bg-neon-purple pulse-live"></div>
                  <h2 className="text-lg font-semibold text-white">
                    After Market Close ({amcStocks.length})
                  </h2>
                  <span className="text-xs text-gray-500 ml-2">Post-market earnings</span>
                </div>
                <EarningsTable
                  stocks={amcStocks}
                  selectedStock={selectedStock}
                  onSelectStock={setSelectedStock}
                />
              </div>
            </div>

            {selectedStock && (
              <div className="lg:col-span-2 space-y-6">
                <StockDetail
                  stock={selectedStock}
                  onClose={() => setSelectedStock(null)}
                />
                <AIAnalysisPanel stock={selectedStock} />
              </div>
            )}
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
  );
}

export default App;
