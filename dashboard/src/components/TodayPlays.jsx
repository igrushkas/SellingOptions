import { Sun, Moon, Clock, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import { calcIVCrushRatio, calcHistoricalWinRate, getTradeSignal, formatCurrency, calcSafeZone } from '../utils/calculations';

const signalBadge = {
  excellent: 'bg-neon-green/15 text-neon-green border-neon-green/30',
  good: 'bg-neon-blue/15 text-neon-blue border-neon-blue/30',
  neutral: 'bg-neon-yellow/15 text-neon-yellow border-neon-yellow/30',
  risky: 'bg-neon-red/15 text-neon-red border-neon-red/30',
};

function PlayCard({ stock, onSelect, onAddTrade }) {
  const signal = getTradeSignal(stock.impliedMove, stock.historicalMoves);
  const winRate = calcHistoricalWinRate(stock.impliedMove, stock.historicalMoves);
  const crushRatio = calcIVCrushRatio(stock.impliedMove, stock.historicalMoves);
  const zones = calcSafeZone(stock.price, stock.impliedMove, stock.historicalMoves);

  return (
    <div
      className="glass-card p-4 cursor-pointer hover:border-neon-blue/30 transition-all"
      onClick={() => onSelect(stock)}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-white">{stock.ticker}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold uppercase ${signalBadge[signal]}`}>
            {signal}
          </span>
        </div>
        <span className="text-sm font-semibold text-white">{formatCurrency(stock.price)}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
        <div>
          <span className="text-gray-500">Implied</span>
          <div className="text-neon-orange font-bold">±{stock.impliedMove}%</div>
        </div>
        <div>
          <span className="text-gray-500">Win Rate</span>
          <div className={`font-bold ${winRate >= 75 ? 'text-neon-green' : 'text-neon-orange'}`}>{winRate.toFixed(0)}%</div>
        </div>
        <div>
          <span className="text-gray-500">IV Crush</span>
          <div className={`font-bold ${crushRatio >= 1.2 ? 'text-neon-green' : 'text-gray-300'}`}>{crushRatio.toFixed(2)}x</div>
        </div>
      </div>

      {/* Quick strike zones */}
      <div className="bg-dark-700/50 rounded-lg p-2 text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-500">Sell Call Above:</span>
          <span className="text-neon-green font-semibold">{formatCurrency(zones.safe.high)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Sell Put Below:</span>
          <span className="text-neon-green font-semibold">{formatCurrency(zones.safe.low)}</span>
        </div>
      </div>

      {/* Add trade button */}
      <button
        onClick={(e) => { e.stopPropagation(); onAddTrade(stock); }}
        className="w-full mt-3 py-1.5 rounded-lg bg-neon-purple/20 text-neon-purple text-xs font-semibold border border-neon-purple/30 hover:bg-neon-purple/30 transition-all"
      >
        + Log Trade
      </button>
    </div>
  );
}

export default function TodayPlays({ earnings, onSelectStock, onAddTrade }) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const hour = now.getHours();

  // Tonight's AMC earnings (sell options during market hours today, IV crush tomorrow AM)
  const tonightAMC = earnings.filter(e => e.timing === 'AMC');
  // Tomorrow morning BMO earnings (sell options today before close, IV crush at open)
  const tomorrowBMO = earnings.filter(e => e.timing === 'BMO');

  // Sort by signal quality — best setups first
  const signalOrder = { excellent: 0, good: 1, neutral: 2, risky: 3 };
  const sortBySignal = (a, b) => {
    const sa = getTradeSignal(a.impliedMove, a.historicalMoves);
    const sb = getTradeSignal(b.impliedMove, b.historicalMoves);
    return signalOrder[sa] - signalOrder[sb];
  };

  tonightAMC.sort(sortBySignal);
  tomorrowBMO.sort(sortBySignal);

  return (
    <div className="space-y-6">
      {/* Tonight's Plays */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Moon className="w-5 h-5 text-neon-purple" />
          <h2 className="text-lg font-bold text-white">Tonight's Earnings (AMC)</h2>
          <span className="text-xs text-gray-500">
            — Sell options NOW, close tomorrow morning
          </span>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-neon-purple/15 text-neon-purple border border-neon-purple/30">
            {tonightAMC.length} stocks
          </span>
        </div>
        {tonightAMC.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tonightAMC.map(stock => (
              <PlayCard key={stock.id} stock={stock} onSelect={onSelectStock} onAddTrade={onAddTrade} />
            ))}
          </div>
        ) : (
          <div className="glass-card p-6 text-center text-gray-500 text-sm">
            No AMC earnings with weekly options today
          </div>
        )}
      </div>

      {/* Tomorrow Morning Plays */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sun className="w-5 h-5 text-neon-orange" />
          <h2 className="text-lg font-bold text-white">Tomorrow Morning (BMO)</h2>
          <span className="text-xs text-gray-500">
            — Sell options before today's close, close at tomorrow's open
          </span>
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-neon-orange/15 text-neon-orange border border-neon-orange/30">
            {tomorrowBMO.length} stocks
          </span>
        </div>
        {tomorrowBMO.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tomorrowBMO.map(stock => (
              <PlayCard key={stock.id} stock={stock} onSelect={onSelectStock} onAddTrade={onAddTrade} />
            ))}
          </div>
        ) : (
          <div className="glass-card p-6 text-center text-gray-500 text-sm">
            No BMO earnings with weekly options tomorrow
          </div>
        )}
      </div>

      {/* Daily Workflow Reminder */}
      <div className="glass-card p-4 border-l-2 border-l-neon-blue">
        <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
          <Clock className="w-4 h-4 text-neon-blue" />
          Daily Workflow
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="flex items-start gap-2">
            <span className="bg-neon-blue/20 text-neon-blue rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold">1</span>
            <div>
              <span className="text-white font-semibold">2-3 PM ET</span>
              <p className="text-gray-400">Review tonight's AMC + tomorrow's BMO earnings. Pick best IV crush setups.</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="bg-neon-blue/20 text-neon-blue rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold">2</span>
            <div>
              <span className="text-white font-semibold">3-3:45 PM ET</span>
              <p className="text-gray-400">Sell naked calls above safe high, naked puts below safe low. Log trades here.</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="bg-neon-blue/20 text-neon-blue rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold">3</span>
            <div>
              <span className="text-white font-semibold">9:30-10 AM ET (Next Day)</span>
              <p className="text-gray-400">Check results. Close positions within first 30 min for IV crush profit.</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="bg-neon-blue/20 text-neon-blue rounded-full w-5 h-5 flex items-center justify-center shrink-0 text-[10px] font-bold">4</span>
            <div>
              <span className="text-white font-semibold">10 AM ET</span>
              <p className="text-gray-400">Mark trades as won/lost. Review P&L. Rinse and repeat.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
