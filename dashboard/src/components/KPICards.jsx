import { TrendingUp, TrendingDown, Target, ShieldCheck, AlertTriangle, DollarSign } from 'lucide-react';
import { calcIVCrushRatio, calcHistoricalWinRate, getTradeSignal } from '../utils/calculations';

export default function KPICards({ earnings }) {
  // Calculate aggregate KPIs
  const excellentTrades = earnings.filter(e => getTradeSignal(e.impliedMove, e.historicalMoves) === 'excellent').length;
  const goodTrades = earnings.filter(e => getTradeSignal(e.impliedMove, e.historicalMoves) === 'good').length;
  const riskyTrades = earnings.filter(e => getTradeSignal(e.impliedMove, e.historicalMoves) === 'risky').length;

  const avgCrushRatio = earnings.reduce((sum, e) => sum + calcIVCrushRatio(e.impliedMove, e.historicalMoves), 0) / (earnings.length || 1);
  const avgWinRate = earnings.reduce((sum, e) => sum + calcHistoricalWinRate(e.impliedMove, e.historicalMoves), 0) / (earnings.length || 1);

  const highestIV = earnings.reduce((max, e) => e.impliedMove > max.impliedMove ? e : max, earnings[0] || { ticker: '-', impliedMove: 0 });

  const cards = [
    {
      label: 'Excellent Setups',
      value: excellentTrades,
      subtitle: 'High IV crush + win rate',
      icon: Target,
      color: 'neon-green',
      glow: 'glow-green',
    },
    {
      label: 'Good Setups',
      value: goodTrades,
      subtitle: 'Favorable risk/reward',
      icon: TrendingUp,
      color: 'neon-blue',
      glow: 'glow-blue',
    },
    {
      label: 'Avg Win Rate',
      value: `${avgWinRate.toFixed(0)}%`,
      subtitle: 'At implied move strikes',
      icon: ShieldCheck,
      color: avgWinRate >= 75 ? 'neon-green' : 'neon-orange',
      glow: avgWinRate >= 75 ? 'glow-green' : '',
    },
    {
      label: 'Avg IV Crush Ratio',
      value: `${avgCrushRatio.toFixed(2)}x`,
      subtitle: avgCrushRatio > 1 ? 'IV is overpriced — sell!' : 'IV fairly priced',
      icon: DollarSign,
      color: avgCrushRatio > 1.2 ? 'neon-green' : 'neon-orange',
      glow: avgCrushRatio > 1.2 ? 'glow-green' : '',
    },
    {
      label: 'Highest IV Stock',
      value: highestIV?.ticker || '-',
      subtitle: `${highestIV?.impliedMove || 0}% implied move`,
      icon: AlertTriangle,
      color: 'neon-red',
      glow: 'glow-red',
    },
    {
      label: 'Risky Setups',
      value: riskyTrades,
      subtitle: 'IV underpriced — avoid',
      icon: TrendingDown,
      color: 'neon-red',
      glow: 'glow-red',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-6">
      {cards.map((card) => (
        <div key={card.label} className={`glass-card p-4 ${card.glow}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 uppercase tracking-wider">{card.label}</span>
            <card.icon className={`w-4 h-4 text-${card.color}`} />
          </div>
          <div className={`text-2xl font-bold text-${card.color}`}>{card.value}</div>
          <p className="text-xs text-gray-500 mt-1">{card.subtitle}</p>
        </div>
      ))}
    </div>
  );
}
