import { TrendingUp, TrendingDown, Target, ShieldCheck, AlertTriangle, DollarSign } from 'lucide-react';
import { calcIVCrushRatio, calcHistoricalWinRate, getTradeSignal } from '../utils/calculations';
import Tooltip from './Tooltip';

export default function KPICards({ earnings }) {
  const excellentTrades = earnings.filter(e => getTradeSignal(e.impliedMove, e.historicalMoves) === 'excellent').length;
  const goodTrades = earnings.filter(e => getTradeSignal(e.impliedMove, e.historicalMoves) === 'good').length;
  const riskyTrades = earnings.filter(e => getTradeSignal(e.impliedMove, e.historicalMoves) === 'risky').length;

  const avgCrushRatio = earnings.reduce((sum, e) => sum + calcIVCrushRatio(e.impliedMove, e.historicalMoves), 0) / (earnings.length || 1);
  const avgWinRate = earnings.reduce((sum, e) => sum + calcHistoricalWinRate(e.impliedMove, e.historicalMoves), 0) / (earnings.length || 1);

  const highestIV = earnings.reduce((max, e) => e.impliedMove > max.impliedMove ? e : max, earnings[0] || { ticker: '-', impliedMove: 0 });

  const cards = [
    {
      label: 'Excellent',
      value: excellentTrades,
      subtitle: 'High IV crush + win rate',
      icon: Target,
      color: 'neon-green',
      glow: 'glow-green',
      tip: 'Stocks with IV Crush Ratio > 1.2x AND Win Rate > 75%. These are the best candidates for selling premium.',
    },
    {
      label: 'Good',
      value: goodTrades,
      subtitle: 'Favorable risk/reward',
      icon: TrendingUp,
      color: 'neon-blue',
      glow: 'glow-blue',
      tip: 'Stocks with IV Crush > 1.0x AND Win Rate > 60%. Decent selling opportunities.',
    },
    {
      label: 'Win Rate',
      value: `${avgWinRate.toFixed(0)}%`,
      subtitle: 'At implied strikes',
      icon: ShieldCheck,
      color: avgWinRate >= 75 ? 'neon-green' : 'neon-orange',
      glow: avgWinRate >= 75 ? 'glow-green' : '',
      tip: 'Average historical win rate across all stocks. 75%+ is ideal.',
    },
    {
      label: 'IV Crush',
      value: `${avgCrushRatio.toFixed(2)}x`,
      subtitle: avgCrushRatio > 1 ? 'IV overpriced' : 'Fairly priced',
      icon: DollarSign,
      color: avgCrushRatio > 1.2 ? 'neon-green' : 'neon-orange',
      glow: avgCrushRatio > 1.2 ? 'glow-green' : '',
      tip: 'Implied Move / Avg Historical Move. Above 1.0 = options overpriced. Above 1.2 = strong sell signal.',
    },
    {
      label: 'Highest IV',
      value: highestIV?.ticker || '-',
      subtitle: `${highestIV?.impliedMove || 0}% implied`,
      icon: AlertTriangle,
      color: 'neon-red',
      glow: 'glow-red',
      tip: 'Stock with the largest expected move. High implied moves = expensive options.',
    },
    {
      label: 'Risky',
      value: riskyTrades,
      subtitle: 'IV underpriced',
      icon: TrendingDown,
      color: 'neon-red',
      glow: 'glow-red',
      tip: 'Stocks where IV Crush < 0.8x — actual move typically BIGGER than implied. Avoid selling.',
    },
  ];

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-1">
      {cards.map((card) => (
        <Tooltip key={card.label} text={card.tip} position="bottom">
          <div className={`glass-card p-2.5 w-full ${card.glow} cursor-help`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-gray-400 uppercase tracking-wider">{card.label}</span>
              <card.icon className={`w-3 h-3 text-${card.color}`} />
            </div>
            <div className={`text-lg font-bold text-${card.color}`}>{card.value}</div>
            <p className="text-[11px] text-gray-500 mt-0.5">{card.subtitle}</p>
          </div>
        </Tooltip>
      ))}
    </div>
  );
}
