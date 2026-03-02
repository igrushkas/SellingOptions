import { ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  calcAvgMove,
  calcIVCrushRatio,
  calcHistoricalWinRate,
  getTradeSignal,
  formatCurrency,
  calcDirectionalBias,
} from '../utils/calculations';

const signalColors = {
  excellent: { bg: 'bg-neon-green/15', text: 'text-neon-green', border: 'border-neon-green/30', label: 'EXCELLENT' },
  good: { bg: 'bg-neon-blue/15', text: 'text-neon-blue', border: 'border-neon-blue/30', label: 'GOOD' },
  neutral: { bg: 'bg-neon-yellow/15', text: 'text-neon-yellow', border: 'border-neon-yellow/30', label: 'NEUTRAL' },
  risky: { bg: 'bg-neon-red/15', text: 'text-neon-red', border: 'border-neon-red/30', label: 'RISKY' },
};

const signalOrder = { excellent: 0, good: 1, neutral: 2, risky: 3 };

export default function EarningsTable({ stocks, selectedStock, onSelectStock }) {
  if (!stocks || stocks.length === 0) {
    return (
      <div className="glass-card p-6 text-center text-gray-500">
        No earnings found for this date with weekly options.
      </div>
    );
  }

  // Sort: excellent first, then good, neutral, risky; within same signal → cheap first
  const sorted = [...stocks].sort((a, b) => {
    const sa = signalOrder[getTradeSignal(a.impliedMove, a.historicalMoves)] ?? 9;
    const sb = signalOrder[getTradeSignal(b.impliedMove, b.historicalMoves)] ?? 9;
    if (sa !== sb) return sa - sb;
    return (a.price || 0) - (b.price || 0);
  });

  return (
    <div className="glass-card overflow-hidden rounded-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-glass-border">
              <th className="text-left px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Company</th>
              <th className="text-right px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Price</th>
              <th className="text-right px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Implied Move</th>
              <th className="text-right px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Avg Move</th>
              <th className="text-right px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">IV Crush</th>
              <th className="text-right px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Win Rate</th>
              <th className="text-center px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Bias</th>
              <th className="text-center px-6 py-4 text-xs font-medium text-gray-400 uppercase tracking-wider">Signal</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((stock) => {
              const signal = getTradeSignal(stock.impliedMove, stock.historicalMoves);
              const signalStyle = signalColors[signal];
              const crushRatio = calcIVCrushRatio(stock.impliedMove, stock.historicalMoves);
              const winRate = calcHistoricalWinRate(stock.impliedMove, stock.historicalMoves);
              const avgMove = calcAvgMove(stock.historicalMoves);
              const bias = calcDirectionalBias(stock.historicalMoves);
              const isSelected = selectedStock?.id === stock.id;

              return (
                <tr
                  key={stock.id}
                  onClick={() => onSelectStock(stock)}
                  className={`table-row-hover cursor-pointer border-b border-glass-border/50 transition-all ${
                    isSelected ? 'bg-neon-blue/10 border-l-2 border-l-neon-blue' : ''
                  }`}
                >
                  <td className="px-6 py-4">
                    <div>
                      <span className="font-semibold text-white">{stock.ticker}</span>
                      <span className="text-gray-500 ml-2 text-xs">{stock.company}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">{stock.sector}</span>
                      <span className="text-xs text-gray-600">|</span>
                      <span className="text-xs text-gray-500">{stock.marketCap}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-white font-medium">
                    {formatCurrency(stock.price)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-neon-orange font-semibold">
                      ±{stock.impliedMove}%
                    </span>
                    <div className="flex items-center justify-end gap-1 text-xs text-gray-500">
                      <span>±{formatCurrency(stock.price * stock.impliedMove / 100)}</span>
                      {stock.ivSource === 'orats' && <span className="text-[11px] text-neon-purple font-bold">ORATS</span>}
                      {stock.ivSource === 'alpha_vantage' && <span className="text-[11px] text-neon-green font-bold">AV</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-gray-300">{avgMove.toFixed(1)}%</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={crushRatio >= 1.2 ? 'text-neon-green font-semibold' : crushRatio >= 1.0 ? 'text-gray-300' : 'text-neon-red'}>
                      {crushRatio.toFixed(2)}x
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={winRate >= 80 ? 'text-neon-green font-semibold' : winRate >= 65 ? 'text-neon-blue' : 'text-neon-red'}>
                      {winRate.toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {bias.bias === 'bullish' ? (
                      <span className="inline-flex items-center gap-1 text-neon-green text-xs">
                        <TrendingUp className="w-3 h-3" /> {bias.bullish}/{bias.bullish + bias.bearish}
                      </span>
                    ) : bias.bias === 'bearish' ? (
                      <span className="inline-flex items-center gap-1 text-neon-red text-xs">
                        <TrendingDown className="w-3 h-3" /> {bias.bearish}/{bias.bullish + bias.bearish}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-gray-400 text-xs">
                        <Minus className="w-3 h-3" /> Mixed
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${signalStyle.bg} ${signalStyle.text} ${signalStyle.border}`}>
                      {signalStyle.label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <ChevronRight className={`w-4 h-4 transition-colors ${isSelected ? 'text-neon-blue' : 'text-gray-600'}`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
