import { useState, useMemo, useEffect } from 'react';
import { earningsCalendar } from './data/mockData';
import Header from './components/Header';
import KPICards from './components/KPICards';
import EarningsTable from './components/EarningsTable';
import StockDetail from './components/StockDetail';
import AIAnalysisPanel from './components/AIAnalysisPanel';
import TodayPlays from './components/TodayPlays';
import TradeTracker from './components/TradeTracker';
import { subscribeTrades } from './services/tradeService';
import { Crosshair, LayoutGrid, BookOpen } from 'lucide-react';
import './index.css';

function App() {
  const [selectedStock, setSelectedStock] = useState(null);
  const [dateFilter, setDateFilter] = useState('2026-02-28');
  const [showWeeklyOnly, setShowWeeklyOnly] = useState(true);
  const [activeTab, setActiveTab] = useState('today'); // today, all, journal
  const [addTradeStock, setAddTradeStock] = useState(null);

  // Load trades from Firestore (real-time)
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    const unsubscribe = subscribeTrades(setTrades);
    return () => unsubscribe();
  }, []);

  const filteredEarnings = useMemo(() => {
    let data = earningsCalendar;
    if (showWeeklyOnly) {
      data = data.filter(e => e.hasWeeklyOptions);
    }
    return data;
  }, [dateFilter, showWeeklyOnly]);

  const bmoStocks = filteredEarnings.filter(e => e.timing === 'BMO');
  const amcStocks = filteredEarnings.filter(e => e.timing === 'AMC');

  const openTradesCount = trades.filter(t => t.status === 'open').length;

  const tabs = [
    { key: 'today', label: "Today's Plays", icon: Crosshair },
    { key: 'all', label: 'All Earnings', icon: LayoutGrid },
    { key: 'journal', label: `Trade Journal${openTradesCount ? ` (${openTradesCount})` : ''}`, icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-dark-900">
      <Header
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        showWeeklyOnly={showWeeklyOnly}
        setShowWeeklyOnly={setShowWeeklyOnly}
        totalStocks={filteredEarnings.length}
      />

      <main className="max-w-[1800px] mx-auto px-4 pb-8">
        <KPICards earnings={filteredEarnings} />

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
        </div>

        {/* Today's Plays Tab */}
        {activeTab === 'today' && (
          <>
            <TodayPlays
              earnings={filteredEarnings}
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
