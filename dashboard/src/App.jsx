import { useState, useMemo, useEffect, useCallback } from 'react';
import Header from './components/Header';
import KPICards from './components/KPICards';
import EarningsTable from './components/EarningsTable';
import StockDetail from './components/StockDetail';
import AIAnalysisPanel from './components/AIAnalysisPanel';
import TodayPlays from './components/TodayPlays';
import TradeTracker from './components/TradeTracker';
import { subscribeTrades } from './services/tradeService';
import { Crosshair, LayoutGrid, BookOpen, RefreshCw, WifiOff } from 'lucide-react';
import './index.css';

const API_BASE = '/api';

function App() {
  const [selectedStock, setSelectedStock] = useState(null);
  const [dateFilter, setDateFilter] = useState(() => new Date().toISOString().split('T')[0]);
  const [showWeeklyOnly, setShowWeeklyOnly] = useState(true);
  const [activeTab, setActiveTab] = useState('today');
  const [addTradeStock, setAddTradeStock] = useState(null);

  // Live earnings data from API — NO mock fallback
  const [liveAMC, setLiveAMC] = useState([]);
  const [liveBMO, setLiveBMO] = useState([]);
  const [dataSource, setDataSource] = useState('loading'); // 'loading' | 'finnhub' | 'fmp' | 'offline'
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Load trades from Firestore (real-time)
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    const unsubscribe = subscribeTrades(setTrades);
    return () => unsubscribe();
  }, []);

  // Fetch live earnings from backend API
  const fetchLiveEarnings = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE}/plays/today`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();

      setLiveAMC(data.amcEarnings || []);
      setLiveBMO(data.bmoEarnings || []);

      // Determine source from the API response
      const src = data.sources?.amc || data.sources?.bmo || 'live';
      setDataSource(src === 'error' ? 'offline' : src);
    } catch (err) {
      setLiveAMC([]);
      setLiveBMO([]);
      setDataSource('offline');
      setErrorMsg('Backend server not running. Start it with: npm run dev:full');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveEarnings();
  }, [fetchLiveEarnings]);

  // Combined earnings for KPI cards and All Earnings tab
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
      />

      <main className="max-w-[1800px] mx-auto px-4 pb-8">
        <KPICards earnings={allEarnings} />

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-6 mb-4 border-b border-glass-border pb-3">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSelectedStock(null); }}
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

          {/* Data source indicator + refresh */}
          <div className="ml-auto flex items-center gap-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${badge.cls}`}>
              {badge.label}
            </span>
            <button
              onClick={fetchLiveEarnings}
              disabled={loading}
              className="p-1.5 rounded-lg hover:bg-dark-700 text-gray-400 hover:text-white transition-all disabled:opacity-50"
              title="Refresh earnings data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Offline banner */}
        {dataSource === 'offline' && (
          <div className="mb-4 p-3 rounded-lg bg-neon-red/10 border border-neon-red/20 flex items-center gap-3">
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
            <TodayPlays
              amcEarnings={amcStocks}
              bmoEarnings={bmoStocks}
              onSelectStock={setSelectedStock}
              onAddTrade={setAddTradeStock}
            />
            {selectedStock && (
              <div className="mt-6 space-y-6">
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
          <div className={`grid gap-6 ${selectedStock ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'}`}>
            <div className={selectedStock ? 'lg:col-span-1' : ''}>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
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
                <div className="flex items-center gap-2 mb-3">
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
