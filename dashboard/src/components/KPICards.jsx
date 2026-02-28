import { TrendingUp, TrendingDown, Target, ShieldCheck, AlertTriangle, DollarSign } from 'lucide-react';
import { calcIVCrushRatio, calcHistoricalWinRate, getTradeSignal } from '../utils/calculations';
import Tooltip from './Tooltip';

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
      tip: 'Stocks with IV Crush Ratio > 1.2x AND Win Rate > 75%. These are the best candidates for selling premium — the market is significantly overpricing the expected move.',
    },
    {
      label: 'Good Setups',
      value: goodTrades,
      subtitle: 'Favorable risk/reward',
      icon: TrendingUp,
      color: 'neon-blue',
      glow: 'glow-blue',
      tip: 'Stocks with IV Crush > 1.0x AND Win Rate > 60%. Decent selling opportunities with favorable odds, but not as strong as excellent setups.',
    },
    {
      label: 'Avg Win Rate',
      value: `${avgWinRate.toFixed(0)}%`,
      subtitle: 'At implied move strikes',
      icon: ShieldCheck,
      color: avgWinRate >= 75 ? 'neon-green' : 'neon-orange',
      glow: avgWinRate >= 75 ? 'glow-green' : '',
      tip: 'Average historical win rate across all stocks. This is how often selling at the implied move distance would have been profitable historically. 75%+ is ideal.',
    },
    {
      label: 'Avg IV Crush Ratio',
      value: `${avgCrushRatio.toFixed(2)}x`,
      subtitle: avgCrushRatio > 1 ? 'IV is overpriced — sell!' : 'IV fairly priced',
      icon: DollarSign,
      color: avgCrushRatio > 1.2 ? 'neon-green' : 'neon-orange',
      glow: avgCrushRatio > 1.2 ? 'glow-green' : '',
      tip: 'Implied Move / Avg Historical Move across all stocks. Above 1.0 means options are overpriced on average. Above 1.2 is a strong signal to sell premium.',
    },
    {
      label: 'Highest IV Stock',
      value: highestIV?.ticker || '-',
      subtitle: `${highestIV?.impliedMove || 0}% implied move`,
      icon: AlertTriangle,
      color: 'neon-red',
      glow: 'glow-red',
      tip: 'The stock with the largest expected move. High implied moves mean expensive options — which can be great for sellers IF the IV crush ratio is also high.',
    },
    {
      label: 'Risky Setups',
      value: riskyTrades,
      subtitle: 'IV underpriced — avoid',
      icon: TrendingDown,
      color: 'neon-red',
      glow: 'glow-red',
      tip: 'Stocks where IV Crush < 0.8x — the actual move is typically BIGGER than what options price in. Selling premium on these is dangerous. Avoid.',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-6">
      {cards.map((card) => (
        <Tooltip key={card.label} text={card.tip} position="bottom">
          <div className={`glass-card p-4 ${card.glow} cursor-help`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 uppercase tracking-wider">{card.label}</span>
              <card.icon className={`w-4 h-4 text-${card.color}`} />
            </div>
            <div className={`text-2xl font-bold text-${card.color}`}>{card.value}</div>
            <p className="text-xs text-gray-500 mt-1">{card.subtitle}</p>
          </div>
        </Tooltip>
      ))}
    </div>
  );
}
