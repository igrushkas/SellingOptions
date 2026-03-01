import { Sun, Moon, ArrowDown, ArrowUp } from 'lucide-react';
import { calcIVCrushRatio, calcHistoricalWinRate, getTradeSignal, formatCurrency, calcSafeZone, getStrategyRecommendation } from '../utils/calculations';
import Tooltip from './Tooltip';

const signalBadge = {
  excellent: 'bg-neon-green/15 text-neon-green border-neon-green/30',
  good: 'bg-neon-blue/15 text-neon-blue border-neon-blue/30',
  neutral: 'bg-neon-yellow/15 text-neon-yellow border-neon-yellow/30',
  risky: 'bg-neon-red/15 text-neon-red border-neon-red/30',
};

const signalTip = {
  excellent: 'IV Crush > 1.2x and Win Rate > 75%. The market is significantly overpricing this earnings move — high probability selling opportunity.',
  good: 'IV Crush > 1.0x and Win Rate > 60%. Options are moderately overpriced — decent setup for premium sellers.',
  neutral: 'IV Crush near 1.0x. The market is pricing the move about right — proceed with caution.',
  risky: 'IV Crush < 0.8x or Win Rate < 50%. The stock often moves MORE than implied — dangerous for sellers.',
};

const strategyColors = {
  short_strangle: { bg: 'bg-neon-green/10', text: 'text-neon-green', border: 'border-neon-green/30', icon: '⇄' },
  iron_condor: { bg: 'bg-neon-blue/10', text: 'text-neon-blue', border: 'border-neon-blue/30', icon: '◇' },
  wide_iron_condor: { bg: 'bg-neon-blue/10', text: 'text-neon-blue', border: 'border-neon-blue/30', icon: '◇' },
  ultra_wide_condor: { bg: 'bg-gray-600/30', text: 'text-gray-400', border: 'border-gray-500', icon: '◇' },
  naked_call: { bg: 'bg-neon-red/10', text: 'text-neon-red', border: 'border-neon-red/30', icon: '↓' },
  naked_put: { bg: 'bg-neon-green/10', text: 'text-neon-green', border: 'border-neon-green/30', icon: '↑' },
  bear_call_spread: { bg: 'bg-neon-red/10', text: 'text-neon-red', border: 'border-neon-red/30', icon: '↓' },
  bull_put_spread: { bg: 'bg-neon-green/10', text: 'text-neon-green', border: 'border-neon-green/30', icon: '↑' },
  skewed_strangle: { bg: 'bg-neon-purple/10', text: 'text-neon-purple', border: 'border-neon-purple/30', icon: '⇄' },
  jade_lizard: { bg: 'bg-neon-green/10', text: 'text-neon-green', border: 'border-neon-green/30', icon: '🦎' },
  twisted_sister: { bg: 'bg-neon-red/10', text: 'text-neon-red', border: 'border-neon-red/30', icon: '🌀' },
  skip: { bg: 'bg-gray-700/50', text: 'text-gray-500', border: 'border-gray-600', icon: '✕' },
};

// Format a leg for display: "Sell 1 Call" or "Buy 1 Put"
function formatLeg(leg) {
  if (leg.instrument) return `${leg.type} ${leg.qty || 1} ${leg.instrument}`;
  // Legacy format: "Sell Call" etc
  return leg.type;
}

function BiasIndicator({ downPct, upPct }) {
  if (!downPct && !upPct) return null;
  const down = Math.round(downPct * 100);
  const up = Math.round(upPct * 100);

  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <span className="text-neon-red flex items-center gap-0.5">
        <ArrowDown className="w-2.5 h-2.5" />{down}%
      </span>
      <div className="w-12 h-1.5 bg-dark-600 rounded-full overflow-hidden flex">
        <div className="bg-neon-red/70 h-full" style={{ width: `${down}%` }} />
        <div className="bg-neon-green/70 h-full" style={{ width: `${up}%` }} />
      </div>
      <span className="text-neon-green flex items-center gap-0.5">
        {up}%<ArrowUp className="w-2.5 h-2.5" />
      </span>
    </div>
  );
}

function PlayCard({ stock, onSelect, onAddTrade }) {
  const signal = getTradeSignal(stock.impliedMove, stock.historicalMoves);
  const winRate = calcHistoricalWinRate(stock.impliedMove, stock.historicalMoves);
  const crushRatio = calcIVCrushRatio(stock.impliedMove, stock.historicalMoves);
  const rec = getStrategyRecommendation(stock);
  const strat = strategyColors[rec.strategy] || strategyColors.skip;

  return (
    <div
      className="glass-card p-5 cursor-pointer hover:border-neon-blue/30 transition-all"
      onClick={() => onSelect(stock)}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-white">{stock.ticker}</span>
          <Tooltip text={signalTip[signal]} position="right">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold uppercase cursor-help ${signalBadge[signal]}`}>
              {signal}
            </span>
          </Tooltip>
        </div>
        <span className="text-sm font-semibold text-white">{formatCurrency(stock.price)}</span>
      </div>

      {stock.company && stock.company !== stock.ticker && (
        <p className="text-xs text-gray-400 mb-3 truncate">{stock.company}</p>
      )}

      <div className="grid grid-cols-3 gap-3 text-xs mb-3">
        <Tooltip text="Expected stock move based on options pricing. The market is pricing in this % move after earnings." position="bottom">
          <div>
            <div className="flex items-center gap-1">
              <span className="text-gray-500 cursor-help border-b border-dotted border-gray-600">Implied</span>
              {stock.ivSource === 'orats' && <span className="text-[8px] text-neon-purple font-bold">ORATS</span>}
            </div>
            <div className="text-neon-orange font-bold">±{stock.impliedMove}%</div>
          </div>
        </Tooltip>
        <Tooltip text="How often the actual earnings move was LESS than the implied move. Higher = more profitable for premium sellers." position="bottom">
          <div>
            <span className="text-gray-500 cursor-help border-b border-dotted border-gray-600">Win Rate</span>
            <div className={`font-bold ${winRate >= 75 ? 'text-neon-green' : 'text-neon-orange'}`}>{winRate.toFixed(0)}%</div>
          </div>
        </Tooltip>
        <Tooltip text="Implied Move / Avg Historical Move. Above 1.0 = IV is overpriced vs reality. Above 1.2 = excellent selling opportunity." position="bottom">
          <div>
            <span className="text-gray-500 cursor-help border-b border-dotted border-gray-600">IV Crush</span>
            <div className={`font-bold ${crushRatio >= 1.2 ? 'text-neon-green' : 'text-gray-300'}`}>{crushRatio.toFixed(2)}x</div>
          </div>
        </Tooltip>
      </div>

      {/* Strategy Recommendation */}
      <Tooltip text={rec.reason} position="bottom">
        <div className={`rounded-lg p-3 mb-3 border ${strat.bg} ${strat.border} cursor-help`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-xs font-bold ${strat.text} uppercase`}>
              {strat.icon} {rec.strategyName}
            </span>
            {rec.confidence > 0 && (
              <span className={`text-[10px] font-semibold ${strat.text}`}>
                {rec.confidence}% conf
              </span>
            )}
          </div>

          {/* Directional bias bar */}
          {rec.downPct != null && rec.strategy !== 'skip' && (
            <div className="mb-1.5">
              <BiasIndicator downPct={rec.downPct} upPct={rec.upPct} />
            </div>
          )}

          {/* Leg details */}
          {rec.legs.length > 0 && (
            <div className="space-y-0.5">
              {rec.legs.map((leg, i) => (
                <div key={i} className="flex justify-between text-[10px]">
                  <span className={leg.type === 'Sell' || leg.type.startsWith('Sell') ? 'text-neon-orange font-semibold' : 'text-gray-500'}>
                    {formatLeg(leg)}
                  </span>
                  <span className="text-white font-semibold">{formatCurrency(leg.strike)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Position sizing + exit */}
          {rec.sizing && (
            <div className="mt-1.5 pt-1.5 border-t border-white/5 flex justify-between text-[9px]">
              <span className="text-gray-500">Size: <span className="text-white font-semibold">{rec.sizing.accountPct}% of account</span></span>
              <span className="text-gray-500">Exit: <span className="text-neon-green font-semibold">50% profit</span></span>
            </div>
          )}
        </div>
      </Tooltip>

      {/* Add trade button */}
      <button
        onClick={(e) => { e.stopPropagation(); onAddTrade(stock); }}
        className="w-full mt-1 py-2 rounded-lg bg-neon-purple/20 text-neon-purple text-xs font-semibold border border-neon-purple/30 hover:bg-neon-purple/30 transition-all"
      >
        + Log Trade
      </button>
    </div>
  );
}

export default function TodayPlays({ amcEarnings = [], bmoEarnings = [], amcLabel, bmoLabel, onSelectStock, onAddTrade }) {
  const signalOrder = { excellent: 0, good: 1, neutral: 2, risky: 3 };
  const sortBySignal = (a, b) => {
    const sa = getTradeSignal(a.impliedMove, a.historicalMoves);
    const sb = getTradeSignal(b.impliedMove, b.historicalMoves);
    return signalOrder[sa] - signalOrder[sb];
  };

  const tonightAMC = [...amcEarnings].sort(sortBySignal);
  const tomorrowBMO = [...bmoEarnings].sort(sortBySignal);

  return (
    <div className="space-y-8">
      {/* BMO Plays — morning first */}
      <div>
        <div className="flex items-center gap-3 mb-5 px-4 py-3 rounded-lg bg-neon-orange/10 border border-neon-orange/20">
          <Sun className="w-5 h-5 text-neon-orange" />
          <h2 className="text-lg font-bold text-neon-orange">{bmoLabel || "Next Trading Day Morning (BMO)"}</h2>
          <span className="text-xs text-gray-400">
            — Sell options before close, IV crush at open
          </span>
          <span className="ml-auto text-xs px-2.5 py-1 rounded-full bg-neon-orange/20 text-neon-orange border border-neon-orange/30 font-semibold">
            {tomorrowBMO.length} stocks
          </span>
        </div>
        {tomorrowBMO.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {tomorrowBMO.map(stock => (
              <PlayCard key={stock.id} stock={stock} onSelect={onSelectStock} onAddTrade={onAddTrade} />
            ))}
          </div>
        ) : (
          <div className="glass-card p-8 text-center text-gray-500 text-sm">
            No BMO earnings above $5 — {bmoLabel || 'next trading day'}
          </div>
        )}
      </div>

      {/* AMC Plays — evening second */}
      <div>
        <div className="flex items-center gap-3 mb-5 px-4 py-3 rounded-lg bg-neon-purple/10 border border-neon-purple/20">
          <Moon className="w-5 h-5 text-neon-purple" />
          <h2 className="text-lg font-bold text-neon-purple">{amcLabel || "Tonight's Earnings (AMC)"}</h2>
          <span className="text-xs text-gray-400">
            — Sell options NOW, close next trading morning
          </span>
          <span className="ml-auto text-xs px-2.5 py-1 rounded-full bg-neon-purple/20 text-neon-purple border border-neon-purple/30 font-semibold">
            {tonightAMC.length} stocks
          </span>
        </div>
        {tonightAMC.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {tonightAMC.map(stock => (
              <PlayCard key={stock.id} stock={stock} onSelect={onSelectStock} onAddTrade={onAddTrade} />
            ))}
          </div>
        ) : (
          <div className="glass-card p-8 text-center text-gray-500 text-sm">
            No AMC earnings above $5 — {amcLabel || 'tonight'}
          </div>
        )}
      </div>

    </div>
  );
}
