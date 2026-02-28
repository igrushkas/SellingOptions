import { Sun, Moon, Clock } from 'lucide-react';
import { calcIVCrushRatio, calcHistoricalWinRate, getTradeSignal, formatCurrency, calcSafeZone } from '../utils/calculations';
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

function PlayCard({ stock, onSelect, onAddTrade }) {
  const signal = getTradeSignal(stock.impliedMove, stock.historicalMoves);
  const winRate = calcHistoricalWinRate(stock.impliedMove, stock.historicalMoves);
  const crushRatio = calcIVCrushRatio(stock.impliedMove, stock.historicalMoves);
  const zones = calcSafeZone(stock.price, stock.impliedMove, stock.historicalMoves);

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

      {/* Quick strike zones */}
      <div className="bg-dark-700/50 rounded-lg p-3 text-xs space-y-1.5">
        <Tooltip text="Sell a naked call at this strike or higher. Price must stay below this for your option to expire worthless (profit)." position="left">
          <div className="flex justify-between w-full">
            <span className="text-gray-500 cursor-help border-b border-dotted border-gray-600">Sell Call Above:</span>
            <span className="text-neon-green font-semibold">{formatCurrency(zones.safe.high)}</span>
          </div>
        </Tooltip>
        <Tooltip text="Sell a naked put at this strike or lower. Price must stay above this for your option to expire worthless (profit)." position="left">
          <div className="flex justify-between w-full">
            <span className="text-gray-500 cursor-help border-b border-dotted border-gray-600">Sell Put Below:</span>
            <span className="text-neon-green font-semibold">{formatCurrency(zones.safe.low)}</span>
          </div>
        </Tooltip>
      </div>

      {/* Add trade button */}
      <button
        onClick={(e) => { e.stopPropagation(); onAddTrade(stock); }}
        className="w-full mt-3 py-2 rounded-lg bg-neon-purple/20 text-neon-purple text-xs font-semibold border border-neon-purple/30 hover:bg-neon-purple/30 transition-all"
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
            No BMO earnings above $5 for next trading day
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
            No AMC earnings above $5 today
          </div>
        )}
      </div>

      {/* Daily Workflow Reminder */}
      <div className="mt-4">
        <div className="flex items-center gap-3 mb-5 px-4 py-3 rounded-lg bg-neon-blue/10 border border-neon-blue/20">
          <Clock className="w-5 h-5 text-neon-blue" />
          <h2 className="text-lg font-bold text-neon-blue">Daily Workflow</h2>
        </div>
        <div className="glass-card p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="flex items-start gap-2">
            <span className="bg-neon-blue/20 text-neon-blue rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold">1</span>
            <div>
              <span className="text-white font-semibold">9:30-10 AM ET</span>
              <p className="text-gray-400 mt-0.5">Check overnight results. Close positions within first 30 min for IV crush profit.</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="bg-neon-blue/20 text-neon-blue rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold">2</span>
            <div>
              <span className="text-white font-semibold">10 AM ET</span>
              <p className="text-gray-400 mt-0.5">Mark trades as won/lost. Review P&L. Rinse and repeat.</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="bg-neon-blue/20 text-neon-blue rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold">3</span>
            <div>
              <span className="text-white font-semibold">2-3 PM ET</span>
              <p className="text-gray-400 mt-0.5">Review tonight's AMC + next day's BMO earnings. Pick best IV crush setups.</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="bg-neon-blue/20 text-neon-blue rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold">4</span>
            <div>
              <span className="text-white font-semibold">3-3:45 PM ET</span>
              <p className="text-gray-400 mt-0.5">Sell naked calls above safe high, naked puts below safe low. Log trades here.</p>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
