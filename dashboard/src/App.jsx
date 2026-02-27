import { useState, useMemo } from 'react';
import { earningsCalendar } from './data/mockData';
import Header from './components/Header';
import KPICards from './components/KPICards';
import EarningsTable from './components/EarningsTable';
import StockDetail from './components/StockDetail';
import AIAnalysisPanel from './components/AIAnalysisPanel';
import './index.css';

function App() {
  const [selectedStock, setSelectedStock] = useState(null);
  const [dateFilter, setDateFilter] = useState('2026-02-28');
  const [showWeeklyOnly, setShowWeeklyOnly] = useState(true);

  const filteredEarnings = useMemo(() => {
    let data = earningsCalendar;
    if (showWeeklyOnly) {
      data = data.filter(e => e.hasWeeklyOptions);
    }
    return data;
  }, [dateFilter, showWeeklyOnly]);

  const bmoStocks = filteredEarnings.filter(e => e.timing === 'BMO');
  const amcStocks = filteredEarnings.filter(e => e.timing === 'AMC');

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

        <div className={`grid gap-6 mt-6 ${selectedStock ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'}`}>
          <div className={selectedStock ? 'lg:col-span-1' : ''}>
            {/* Pre-Market Earnings */}
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

            {/* After Market Close Earnings */}
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

          {/* Detail Panel */}
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
      </main>
    </div>
  );
}

export default App;
