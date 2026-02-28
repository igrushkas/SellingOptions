import { TrendingUp, Filter, Calendar, Zap } from 'lucide-react';

export default function Header({ dateFilter, setDateFilter, showWeeklyOnly, setShowWeeklyOnly, totalStocks }) {
  return (
    <header className="sticky top-0 z-50 bg-dark-900/80 backdrop-blur-xl border-b border-glass-border">
      <div className="max-w-[1400px] mx-auto px-8 lg:px-12 py-4">
        <div className="flex items-center justify-between">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text">Volatility Crusher</h1>
              <p className="text-xs text-gray-500">Earnings Options Selling Dashboard</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-dark-700 border border-glass-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-neon-blue"
              />
            </div>

            <button
              onClick={() => setShowWeeklyOnly(!showWeeklyOnly)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                showWeeklyOnly
                  ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30'
                  : 'bg-dark-700 text-gray-400 border border-glass-border'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Weekly Options Only
            </button>

            <div className="flex items-center gap-2 text-sm text-gray-400">
              <TrendingUp className="w-4 h-4 text-neon-green" />
              <span className="text-white font-semibold">{totalStocks}</span> stocks reporting
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
