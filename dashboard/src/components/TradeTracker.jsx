import { useState } from 'react';
import { X, Check, Trash2, TrendingUp, TrendingDown, DollarSign, Target, Award, Calendar } from 'lucide-react';
import { formatCurrency } from '../utils/calculations';
import { addTrade, updateTrade, deleteTrade } from '../services/tradeService';

export function AddTradeModal({ stock, onSave, onClose }) {
  const [tradeType, setTradeType] = useState('call');
  const [strike, setStrike] = useState('');
  const [premium, setPremium] = useState('');
  const [contracts, setContracts] = useState('1');
  const [notes, setNotes] = useState('');

  const handleSave = () => {
    if (!strike || !premium) return;
    onSave({
      id: Date.now(),
      ticker: stock.ticker,
      company: stock.company,
      stockPrice: stock.price,
      tradeType,
      strike: parseFloat(strike),
      premium: parseFloat(premium),
      contracts: parseInt(contracts),
      notes,
      date: new Date().toISOString(),
      earningsDate: stock.date,
      earningsTiming: stock.timing,
      impliedMove: stock.impliedMove,
      status: 'open', // open, won, lost
      closedPrice: null,
      closedDate: null,
      pnl: null,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-card p-6 w-full max-w-md mx-4 border border-glass-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Log Trade — {stock.ticker}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-dark-600">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Trade Type */}
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider">Type</label>
            <div className="flex gap-2 mt-1">
              {['call', 'put'].map(t => (
                <button
                  key={t}
                  onClick={() => setTradeType(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                    tradeType === t
                      ? t === 'call'
                        ? 'bg-neon-red/20 text-neon-red border border-neon-red/30'
                        : 'bg-neon-green/20 text-neon-green border border-neon-green/30'
                      : 'bg-dark-700 text-gray-400 border border-glass-border'
                  }`}
                >
                  Sell {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Strike Price */}
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider">Strike Price</label>
            <input
              type="number"
              step="0.5"
              value={strike}
              onChange={(e) => setStrike(e.target.value)}
              placeholder={`Stock at ${formatCurrency(stock.price)}`}
              className="w-full mt-1 bg-dark-700 border border-glass-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-neon-blue"
            />
          </div>

          {/* Premium Collected */}
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider">Premium Collected (per contract)</label>
            <input
              type="number"
              step="0.01"
              value={premium}
              onChange={(e) => setPremium(e.target.value)}
              placeholder="e.g. 3.50"
              className="w-full mt-1 bg-dark-700 border border-glass-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-neon-blue"
            />
          </div>

          {/* Contracts */}
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider">Contracts</label>
            <input
              type="number"
              value={contracts}
              onChange={(e) => setContracts(e.target.value)}
              className="w-full mt-1 bg-dark-700 border border-glass-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-neon-blue"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. High IV crush setup"
              className="w-full mt-1 bg-dark-700 border border-glass-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-neon-blue"
            />
          </div>

          <div className="text-xs text-gray-500 bg-dark-700/50 rounded-lg p-2">
            Total premium: <span className="text-neon-green font-bold">
              {premium && contracts ? formatCurrency(parseFloat(premium) * parseInt(contracts) * 100) : '$0.00'}
            </span>
            <span className="text-gray-600"> ({contracts || 0} × {premium || 0} × 100 shares)</span>
          </div>

          <button
            onClick={handleSave}
            disabled={!strike || !premium}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-neon-purple to-neon-blue text-white font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            Log Trade
          </button>
        </div>
      </div>
    </div>
  );
}

function CloseTradeModal({ trade, onClose, onSave }) {
  const [closedPrice, setClosedPrice] = useState('');
  const [result, setResult] = useState('won');

  const handleSave = () => {
    const closed = parseFloat(closedPrice) || 0;
    const premiumCollected = trade.premium * trade.contracts * 100;
    const closeCost = closed * trade.contracts * 100;
    const pnl = premiumCollected - closeCost;

    onSave({
      ...trade,
      status: result,
      closedPrice: closed,
      closedDate: new Date().toISOString(),
      pnl,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-card p-6 w-full max-w-md mx-4 border border-glass-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Close — {trade.ticker} {trade.strike} {trade.tradeType.toUpperCase()}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-dark-600">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-dark-700/50 rounded-lg p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-400">Opened:</span>
              <span className="text-white">{new Date(trade.date).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Premium Collected:</span>
              <span className="text-neon-green font-semibold">{formatCurrency(trade.premium)} per contract</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Total Collected:</span>
              <span className="text-neon-green font-semibold">{formatCurrency(trade.premium * trade.contracts * 100)}</span>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider">Result</label>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => { setResult('won'); setClosedPrice('0.05'); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  result === 'won' ? 'bg-neon-green/20 text-neon-green border border-neon-green/30' : 'bg-dark-700 text-gray-400 border border-glass-border'
                }`}
              >
                WON (Expired/Cheap)
              </button>
              <button
                onClick={() => setResult('lost')}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  result === 'lost' ? 'bg-neon-red/20 text-neon-red border border-neon-red/30' : 'bg-dark-700 text-gray-400 border border-glass-border'
                }`}
              >
                LOST (Bought Back Higher)
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider">Buy-to-Close Price (per contract)</label>
            <input
              type="number"
              step="0.01"
              value={closedPrice}
              onChange={(e) => setClosedPrice(e.target.value)}
              placeholder="0.05 if expired worthless"
              className="w-full mt-1 bg-dark-700 border border-glass-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-neon-blue"
            />
          </div>

          {closedPrice && (
            <div className="text-xs text-gray-500 bg-dark-700/50 rounded-lg p-2">
              P&L: <span className={`font-bold ${(trade.premium - parseFloat(closedPrice)) >= 0 ? 'text-neon-green' : 'text-neon-red'}`}>
                {formatCurrency((trade.premium - parseFloat(closedPrice)) * trade.contracts * 100)}
              </span>
            </div>
          )}

          <button
            onClick={handleSave}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-neon-green to-neon-blue text-white font-semibold hover:opacity-90 transition-opacity"
          >
            Close Position
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TradeTracker({ trades, setTrades, addTradeStock, setAddTradeStock }) {
  const [closingTrade, setClosingTrade] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  const handleSaveTrade = async (trade) => {
    await addTrade(trade);
    setAddTradeStock(null);
  };

  const handleCloseTrade = async (updatedTrade) => {
    const { id, ...fields } = updatedTrade;
    await updateTrade(id, {
      status: fields.status,
      closedPrice: fields.closedPrice,
      closedDate: fields.closedDate,
      pnl: fields.pnl,
    });
    setClosingTrade(null);
  };

  const handleDeleteTrade = async (id) => {
    await deleteTrade(id);
  };

  // Stats
  const closedTrades = trades.filter(t => t.status !== 'open');
  const openTrades = trades.filter(t => t.status === 'open');
  const wonTrades = trades.filter(t => t.status === 'won');
  const lostTrades = trades.filter(t => t.status === 'lost');
  const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const winRate = closedTrades.length > 0 ? (wonTrades.length / closedTrades.length * 100) : 0;
  const totalPremium = trades.reduce((sum, t) => sum + (t.premium * t.contracts * 100), 0);

  const filteredTrades = filterStatus === 'all' ? trades
    : filterStatus === 'open' ? openTrades
    : filterStatus === 'won' ? wonTrades
    : lostTrades;

  return (
    <div className="space-y-4">
      {closingTrade && (
        <CloseTradeModal trade={closingTrade} onSave={handleCloseTrade} onClose={() => setClosingTrade(null)} />
      )}

      {/* P&L Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="glass-card p-3 glow-green">
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <DollarSign className="w-3 h-3" /> Total P&L
          </div>
          <div className={`text-xl font-bold ${totalPnL >= 0 ? 'text-neon-green' : 'text-neon-red'}`}>
            {formatCurrency(totalPnL)}
          </div>
        </div>
        <div className="glass-card p-3">
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Award className="w-3 h-3" /> Win Rate
          </div>
          <div className={`text-xl font-bold ${winRate >= 75 ? 'text-neon-green' : winRate >= 50 ? 'text-neon-orange' : 'text-neon-red'}`}>
            {winRate.toFixed(0)}%
          </div>
          <div className="text-[10px] text-gray-500">{wonTrades.length}W / {lostTrades.length}L</div>
        </div>
        <div className="glass-card p-3">
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Target className="w-3 h-3" /> Open Positions
          </div>
          <div className="text-xl font-bold text-neon-blue">{openTrades.length}</div>
        </div>
        <div className="glass-card p-3">
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <TrendingUp className="w-3 h-3" /> Premium Collected
          </div>
          <div className="text-xl font-bold text-neon-green">{formatCurrency(totalPremium)}</div>
        </div>
        <div className="glass-card p-3">
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Calendar className="w-3 h-3" /> Total Trades
          </div>
          <div className="text-xl font-bold text-white">{trades.length}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {[
          { key: 'all', label: `All (${trades.length})` },
          { key: 'open', label: `Open (${openTrades.length})` },
          { key: 'won', label: `Won (${wonTrades.length})` },
          { key: 'lost', label: `Lost (${lostTrades.length})` },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilterStatus(f.key)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              filterStatus === f.key
                ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30'
                : 'bg-dark-700 text-gray-400 border border-glass-border'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Trade List */}
      {filteredTrades.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <DollarSign className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No trades yet. Click "Log Trade" on any earnings stock to start tracking.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-glass-border">
                <th className="text-left px-4 py-2 text-xs text-gray-400 uppercase">Date</th>
                <th className="text-left px-4 py-2 text-xs text-gray-400 uppercase">Ticker</th>
                <th className="text-center px-4 py-2 text-xs text-gray-400 uppercase">Type</th>
                <th className="text-right px-4 py-2 text-xs text-gray-400 uppercase">Strike</th>
                <th className="text-right px-4 py-2 text-xs text-gray-400 uppercase">Premium</th>
                <th className="text-right px-4 py-2 text-xs text-gray-400 uppercase">Qty</th>
                <th className="text-center px-4 py-2 text-xs text-gray-400 uppercase">Status</th>
                <th className="text-right px-4 py-2 text-xs text-gray-400 uppercase">P&L</th>
                <th className="px-4 py-2 text-xs text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.sort((a, b) => new Date(b.date) - new Date(a.date)).map(trade => (
                <tr key={trade.id} className="border-b border-glass-border/50 table-row-hover">
                  <td className="px-4 py-2 text-xs text-gray-400">
                    {new Date(trade.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-4 py-2">
                    <span className="font-bold text-white">{trade.ticker}</span>
                    <span className="text-xs text-gray-500 ml-1">@ {formatCurrency(trade.stockPrice)}</span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      trade.tradeType === 'call'
                        ? 'bg-neon-red/15 text-neon-red'
                        : 'bg-neon-green/15 text-neon-green'
                    }`}>
                      SELL {trade.tradeType.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-white font-medium">{formatCurrency(trade.strike)}</td>
                  <td className="px-4 py-2 text-right text-neon-green">{formatCurrency(trade.premium)}</td>
                  <td className="px-4 py-2 text-right text-gray-300">{trade.contracts}</td>
                  <td className="px-4 py-2 text-center">
                    {trade.status === 'open' ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-neon-blue/15 text-neon-blue border border-neon-blue/30 font-semibold">
                        OPEN
                      </span>
                    ) : trade.status === 'won' ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-neon-green/15 text-neon-green border border-neon-green/30 font-semibold">
                        WON
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-neon-red/15 text-neon-red border border-neon-red/30 font-semibold">
                        LOST
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {trade.pnl !== null ? (
                      <span className={`font-bold ${trade.pnl >= 0 ? 'text-neon-green' : 'text-neon-red'}`}>
                        {formatCurrency(trade.pnl)}
                      </span>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      {trade.status === 'open' && (
                        <button
                          onClick={() => setClosingTrade(trade)}
                          className="p-1 rounded hover:bg-neon-green/10 text-neon-green"
                          title="Close position"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteTrade(trade.id)}
                        className="p-1 rounded hover:bg-neon-red/10 text-gray-500 hover:text-neon-red"
                        title="Delete trade"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
