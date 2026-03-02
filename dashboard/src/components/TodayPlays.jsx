import { useState } from 'react';
import { Sun, Moon, ArrowDown, ArrowUp, ChevronDown, ChevronUp } from 'lucide-react';
import { calcIVCrushRatio, calcHistoricalWinRate, getTradeSignal, formatCurrency, calcSafeZone, getStrategyRecommendation } from '../utils/calculations';
import Tooltip from './Tooltip';
import StrategyDiagram from './StrategyDiagram';

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

function formatLeg(leg) {
  if (leg.instrument) return `${leg.type} ${leg.qty || 1} ${leg.instrument}`;
  return leg.type;
}

function BiasIndicator({ downPct, upPct }) {
  if (!downPct && !upPct) return null;
  const down = Math.round(downPct * 100);
  const up = Math.round(upPct * 100);

  return (
    <div className="flex items-center gap-1.5 text-xs">
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
      className="glass-card p-7 cursor-pointer hover:border-neon-blue/30 transition-all"
      onClick={() => onSelect(stock)}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-white">{stock.ticker}</span>
          <Tooltip text={signalTip[signal]} position="right">
            <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold uppercase cursor-help ${signalBadge[signal]}`}>
              {signal}
            </span>
          </Tooltip>
        </div>
        <span className="text-sm font-semibold text-white">{formatCurrency(stock.price)}</span>
      </div>

      {stock.company && stock.company !== stock.ticker && (
        <p className="text-xs text-gray-400 mb-4 truncate">{stock.company}</p>
      )}

      <div className="grid grid-cols-3 gap-4 text-xs mb-4">
        <Tooltip text="Expected stock move based on options pricing. The market is pricing in this % move after earnings." position="bottom">
          <div>
            <div className="flex items-center gap-1">
              <span className="text-gray-500 cursor-help border-b border-dotted border-gray-600">Implied</span>
              {stock.ivSource === 'orats' && <span className="text-[11px] text-neon-purple font-bold">ORATS</span>}
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
      <Tooltip text={
        <div>
          <StrategyDiagram strategy={rec.strategy} />
          <p className="mt-1.5 pt-1.5 border-t border-white/10 text-xs text-gray-300 leading-relaxed">{rec.reason}</p>
        </div>
      } position="bottom" wide>
        <div className={`rounded-xl p-4 mb-4 border ${strat.bg} ${strat.border} cursor-help`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold ${strat.text} uppercase`}>
              {strat.icon} {rec.strategyName}
            </span>
            {rec.confidence > 0 && (
              <span className={`text-xs font-semibold ${strat.text}`}>
                {rec.confidence}% conf
              </span>
            )}
          </div>

          {rec.downPct != null && rec.strategy !== 'skip' && (
            <div className="mb-1.5">
              <BiasIndicator downPct={rec.downPct} upPct={rec.upPct} />
            </div>
          )}

          {rec.legs.length > 0 && (
            <div className="space-y-0.5">
              {rec.legs.map((leg, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className={leg.type === 'Sell' || leg.type.startsWith('Sell') ? 'text-neon-orange font-semibold' : 'text-neon-blue font-medium'}>
                    {formatLeg(leg)}
                  </span>
                  <span className="text-white font-semibold">{formatCurrency(leg.strike)}</span>
                </div>
              ))}
            </div>
          )}

          {rec.sizing && (
            <div className="mt-1.5 pt-1.5 border-t border-white/5 flex justify-between text-[11px]">
              <span className="text-gray-500">Size: <span className="text-white font-semibold">{rec.sizing.accountPct}% of account</span></span>
              <span className="text-gray-500">Exit: <span className="text-neon-green font-semibold">50% profit</span></span>
            </div>
          )}
        </div>
      </Tooltip>

      {/* Add trade button */}
      <button
        onClick={(e) => { e.stopPropagation(); onAddTrade(stock); }}
        className="w-full mt-2 py-2.5 rounded-xl bg-neon-purple/20 text-neon-purple text-xs font-semibold border border-neon-purple/30 hover:bg-neon-purple/30 transition-all"
      >
        + Log Trade
      </button>
    </div>
  );
}

export default function TodayPlays({ amcEarnings = [], bmoEarnings = [], amcLabel, bmoLabel, onSelectStock, onAddTrade, dimPlays = false }) {
  const [showBMO, setShowBMO] = useState(true);
  const [showAMC, setShowAMC] = useState(true);

  const signalOrder = { excellent: 0, good: 1, neutral: 2, risky: 3 };
  const sortBySignalThenPrice = (a, b) => {
    const sa = getTradeSignal(a.impliedMove, a.historicalMoves);
    const sb = getTradeSignal(b.impliedMove, b.historicalMoves);
    const orderDiff = signalOrder[sa] - signalOrder[sb];
    if (orderDiff !== 0) return orderDiff;
    return (a.price || 0) - (b.price || 0);
  };

  const tomorrowBMO = [...bmoEarnings].sort(sortBySignalThenPrice);
  const tonightAMC = [...amcEarnings].sort(sortBySignalThenPrice);

  return (
    <div className="space-y-8">
      {/* AMC Container — Tonight's evening trades first */}
      <div className={`rounded-2xl bg-dark-800/40 border border-neon-purple/10 p-8 transition-opacity ${dimPlays ? 'opacity-40 pointer-events-none' : ''}`}>
        <button
          onClick={() => setShowAMC(!showAMC)}
          className="w-full flex items-center gap-3 px-5 py-3 rounded-xl bg-neon-purple/10 border border-neon-purple/20 hover:bg-neon-purple/15 transition-colors"
        >
          <Moon className="w-5 h-5 text-neon-purple" />
          <h2 className="text-base font-bold text-neon-purple">{amcLabel || "Tonight's Earnings (AMC)"}</h2>
          <span className="text-xs text-gray-400 hidden md:inline">
            — Sell options NOW, close next trading morning
          </span>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs px-2.5 py-1 rounded-full bg-neon-purple/20 text-neon-purple border border-neon-purple/30 font-semibold">
              {tonightAMC.length}
            </span>
            {showAMC ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </button>
        {showAMC && (
          tonightAMC.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mt-6">
              {tonightAMC.map(stock => (
                <PlayCard key={stock.id} stock={stock} onSelect={onSelectStock} onAddTrade={onAddTrade} />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500 text-sm mt-4">
              No AMC earnings above $5 — {amcLabel || 'tonight'}
            </div>
          )
        )}
      </div>

      {/* BMO Container — Next trading day morning */}
      <div className={`rounded-2xl bg-dark-750/60 border border-neon-orange/10 p-8 transition-opacity ${dimPlays ? 'opacity-40 pointer-events-none' : ''}`}>
        <button
          onClick={() => setShowBMO(!showBMO)}
          className="w-full flex items-center gap-3 px-5 py-3 rounded-xl bg-neon-orange/10 border border-neon-orange/20 hover:bg-neon-orange/15 transition-colors"
        >
          <Sun className="w-5 h-5 text-neon-orange" />
          <h2 className="text-base font-bold text-neon-orange">{bmoLabel || "Next Trading Day Morning (BMO)"}</h2>
          <span className="text-xs text-gray-400 hidden md:inline">
            — Sell options before close, IV crush at open
          </span>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs px-2.5 py-1 rounded-full bg-neon-orange/20 text-neon-orange border border-neon-orange/30 font-semibold">
              {tomorrowBMO.length}
            </span>
            {showBMO ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </button>
        {showBMO && (
          tomorrowBMO.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mt-6">
              {tomorrowBMO.map(stock => (
                <PlayCard key={stock.id} stock={stock} onSelect={onSelectStock} onAddTrade={onAddTrade} />
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500 text-sm mt-4">
              No BMO earnings above $5 — {bmoLabel || 'next trading day'}
            </div>
          )
        )}
      </div>
    </div>
  );
}
