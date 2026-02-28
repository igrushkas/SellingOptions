import { X, TrendingUp, TrendingDown, Shield, Target, AlertCircle, Newspaper } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell, AreaChart, Area } from 'recharts';
import {
  calcSafeZone,
  predictNextMove,
  formatCurrency,
  formatPercent,
  calcNewsSentiment,
  calcAvgMove,
  calcMaxMove,
  calcMedianMove,
} from '../utils/calculations';

function HistoricalMovesChart({ historicalMoves, impliedMove }) {
  const chartData = [...historicalMoves].reverse().map(m => ({
    quarter: m.quarter.replace('Q', '').replace(' ', "'"),
    move: m.direction === 'up' ? m.actual : -m.actual,
    absMove: Math.abs(m.actual),
    fill: m.direction === 'up' ? '#00ff88' : '#ff3366',
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chartData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="quarter" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
        <Tooltip
          contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
          labelStyle={{ color: '#fff' }}
          formatter={(value) => [`${value.toFixed(1)}%`, 'Move']}
        />
        <ReferenceLine y={impliedMove} stroke="#ff8800" strokeDasharray="5 5" label={{ value: `+${impliedMove}%`, fill: '#ff8800', fontSize: 11, position: 'right' }} />
        <ReferenceLine y={-impliedMove} stroke="#ff8800" strokeDasharray="5 5" label={{ value: `-${impliedMove}%`, fill: '#ff8800', fontSize: 11, position: 'right' }} />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
        <Bar dataKey="move" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={index} fill={entry.fill} fillOpacity={0.8} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function SafeZoneVisual({ stock }) {
  const zones = calcSafeZone(stock.price, stock.impliedMove, stock.historicalMoves);

  const zoneConfigs = [
    {
      label: 'Aggressive',
      zone: zones.aggressive,
      color: 'neon-red',
      bgColor: 'bg-neon-red/10',
      borderColor: 'border-neon-red/30',
      desc: 'Tighter range, more premium, ~' + zones.aggressive.winRate.toFixed(0) + '% win rate',
    },
    {
      label: 'Recommended',
      zone: zones.safe,
      color: 'neon-green',
      bgColor: 'bg-neon-green/10',
      borderColor: 'border-neon-green/30',
      desc: 'Balanced risk/reward, ~' + zones.safe.winRate.toFixed(0) + '% win rate',
    },
    {
      label: 'Conservative',
      zone: zones.conservative,
      color: 'neon-blue',
      bgColor: 'bg-neon-blue/10',
      borderColor: 'border-neon-blue/30',
      desc: 'Beyond max historical move, ~' + zones.conservative.winRate.toFixed(0) + '% win rate',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Target className="w-4 h-4 text-neon-green" />
        <h4 className="text-sm font-semibold text-white">Strike Zone Calculator</h4>
        <span className="text-xs text-gray-500">— Sell outside these ranges</span>
      </div>

      {/* Visual Price Bar */}
      <div className="relative h-16 rounded-lg bg-dark-700 overflow-hidden">
        {/* Conservative zone */}
        <div
          className="absolute h-full bg-neon-blue/10 border-x border-neon-blue/30"
          style={{
            left: `${Math.max(0, 50 - zones.conservative.distance * 2.5)}%`,
            right: `${Math.max(0, 50 - zones.conservative.distance * 2.5)}%`,
          }}
        />
        {/* Safe zone */}
        <div
          className="absolute h-full bg-neon-green/15 border-x border-neon-green/40"
          style={{
            left: `${Math.max(0, 50 - zones.safe.distance * 2.5)}%`,
            right: `${Math.max(0, 50 - zones.safe.distance * 2.5)}%`,
          }}
        />
        {/* Implied move zone */}
        <div
          className="absolute h-full bg-neon-orange/20 border-x border-neon-orange/50"
          style={{
            left: `${Math.max(0, 50 - stock.impliedMove * 2.5)}%`,
            right: `${Math.max(0, 50 - stock.impliedMove * 2.5)}%`,
          }}
        />
        {/* Center price line */}
        <div className="absolute left-1/2 h-full w-0.5 bg-white/50" />
        <div className="absolute left-1/2 top-1 -translate-x-1/2 text-xs font-bold text-white bg-dark-600 px-2 py-0.5 rounded">
          {formatCurrency(stock.price)}
        </div>
      </div>

      {/* Zone Cards */}
      <div className="grid grid-cols-3 gap-3">
        {zoneConfigs.map(({ label, zone, color, bgColor, borderColor, desc }) => (
          <div key={label} className={`${bgColor} border ${borderColor} rounded-xl p-3`}>
            <div className="flex items-center gap-1 mb-2">
              <Shield className={`w-3.5 h-3.5 text-${color}`} />
              <span className={`text-xs font-bold text-${color} uppercase`}>{label}</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Sell Call Above:</span>
                <span className="text-white font-semibold">{formatCurrency(zone.high)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Sell Put Below:</span>
                <span className="text-white font-semibold">{formatCurrency(zone.low)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Distance:</span>
                <span className="text-white">±{zone.distance}%</span>
              </div>
              <div className="flex justify-between text-xs mt-1 pt-1 border-t border-white/5">
                <span className="text-gray-400">Win Rate:</span>
                <span className={`font-bold text-${color}`}>{zone.winRate.toFixed(0)}%</span>
              </div>
            </div>
            <p className="text-[10px] text-gray-500 mt-2">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PredictionCard({ stock }) {
  const prediction = predictNextMove(stock.historicalMoves, stock.impliedMove);
  const signalColors = {
    excellent: 'text-neon-green',
    good: 'text-neon-blue',
    neutral: 'text-neon-yellow',
    risky: 'text-neon-red',
  };

  return (
    <div className="glass-card p-4">
      <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-neon-purple" />
        Move Prediction
      </h4>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="text-xs text-gray-400">Predicted Range</span>
          <div className="text-lg font-bold text-white">±{prediction.predictedRange}%</div>
        </div>
        <div>
          <span className="text-xs text-gray-400">Implied Move</span>
          <div className="text-lg font-bold text-neon-orange">±{prediction.impliedMove}%</div>
        </div>
        <div>
          <span className="text-xs text-gray-400">IV Crush Ratio</span>
          <div className={`text-lg font-bold ${prediction.crushRatio >= 1.2 ? 'text-neon-green' : 'text-gray-300'}`}>
            {prediction.crushRatio}x
          </div>
        </div>
        <div>
          <span className="text-xs text-gray-400">Historical Win Rate</span>
          <div className={`text-lg font-bold ${prediction.winRate >= 75 ? 'text-neon-green' : 'text-neon-orange'}`}>
            {prediction.winRate}%
          </div>
        </div>
        <div>
          <span className="text-xs text-gray-400">Directional Bias</span>
          <div className={`text-lg font-bold ${prediction.bias === 'bullish' ? 'text-neon-green' : prediction.bias === 'bearish' ? 'text-neon-red' : 'text-gray-300'}`}>
            {prediction.bias.charAt(0).toUpperCase() + prediction.bias.slice(1)}
          </div>
        </div>
        <div>
          <span className="text-xs text-gray-400">Trade Signal</span>
          <div className={`text-lg font-bold uppercase ${signalColors[prediction.signal]}`}>
            {prediction.signal}
          </div>
        </div>
      </div>
    </div>
  );
}

function NewsPanel({ stock }) {
  const sentiment = calcNewsSentiment(stock.news);
  const sentimentLabel = sentiment > 0.3 ? 'Bullish' : sentiment < -0.3 ? 'Bearish' : 'Mixed';
  const sentimentColor = sentiment > 0.3 ? 'text-neon-green' : sentiment < -0.3 ? 'text-neon-red' : 'text-neon-yellow';

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-neon-blue" />
          News & Sentiment
        </h4>
        <span className={`text-xs font-bold ${sentimentColor}`}>{sentimentLabel}</span>
      </div>
      <div className="space-y-2">
        {stock.news.map((item, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${
              item.sentiment === 'positive' ? 'bg-neon-green' : item.sentiment === 'negative' ? 'bg-neon-red' : 'bg-gray-400'
            }`} />
            <span className="text-gray-300">{item.headline}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-glass-border">
        <div className="text-xs text-gray-400">
          <span className="font-semibold text-white">Impact on options selling: </span>
          {sentiment > 0.3
            ? 'Positive news may support the stock. Consider selling puts with confidence, but be cautious on call side.'
            : sentiment < -0.3
            ? 'Negative sentiment could pressure the stock. Wider call strikes recommended, tighter puts may work.'
            : 'Mixed signals suggest pricing in both scenarios. Standard distance from implied move should work.'}
        </div>
      </div>
    </div>
  );
}

function StatsRow({ stock }) {
  const avgMove = calcAvgMove(stock.historicalMoves);
  const maxMove = calcMaxMove(stock.historicalMoves);
  const medianMove = calcMedianMove(stock.historicalMoves);

  const stats = [
    { label: 'Avg Move (5yr)', value: `${avgMove.toFixed(1)}%` },
    { label: 'Median Move', value: `${medianMove.toFixed(1)}%` },
    { label: 'Max Move', value: `${maxMove.toFixed(1)}%` },
    { label: 'EPS Est', value: `$${stock.epsEstimate}` },
    { label: 'EPS Prior', value: `$${stock.epsPrior}` },
    { label: 'Rev Est', value: stock.revenueEstimate },
    { label: 'Rating', value: stock.consensusRating },
    { label: 'Analysts', value: stock.analystCount },
  ];

  return (
    <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
      {stats.map(s => (
        <div key={s.label} className="bg-dark-700/50 rounded-lg px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 uppercase">{s.label}</div>
          <div className="text-sm font-semibold text-white">{s.value}</div>
        </div>
      ))}
    </div>
  );
}

function OratsInsights({ stock }) {
  if (!stock.ivCrushStats) return null;

  const stats = stock.ivCrushStats;
  return (
    <div className="glass-card p-4 border-l-2 border-l-neon-purple">
      <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neon-purple/20 text-neon-purple font-bold">ORATS</span>
        IV Crush Analytics
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          <span className="text-xs text-gray-400">Earnings Analyzed</span>
          <div className="text-lg font-bold text-white">{stats.totalEarnings}</div>
        </div>
        <div>
          <span className="text-xs text-gray-400">IV Overstated</span>
          <div className={`text-lg font-bold ${stats.winRate >= 70 ? 'text-neon-green' : 'text-neon-orange'}`}>
            {stats.winRate}%
          </div>
          <div className="text-[10px] text-gray-500">{stats.timesImpliedOverstated}/{stats.totalEarnings} times</div>
        </div>
        <div>
          <span className="text-xs text-gray-400">Avg IV Crush</span>
          <div className={`text-lg font-bold ${stats.avgCrushPct > 0 ? 'text-neon-green' : 'text-neon-red'}`}>
            {stats.avgCrushPct > 0 ? '+' : ''}{stats.avgCrushPct}%
          </div>
        </div>
        <div>
          <span className="text-xs text-gray-400">Avg Implied Move</span>
          <div className="text-lg font-bold text-neon-orange">±{stats.avgImpliedMove}%</div>
        </div>
        <div>
          <span className="text-xs text-gray-400">Avg Actual Move</span>
          <div className="text-lg font-bold text-white">±{stats.avgActualMove}%</div>
        </div>
        {stock.historySource === 'orats' && (
          <div>
            <span className="text-xs text-gray-400">Data Source</span>
            <div className="text-xs text-neon-purple font-semibold mt-1">Actual stock price moves</div>
            <div className="text-[10px] text-gray-500">Not EPS surprise %</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StockDetail({ stock, onClose }) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="glass-card p-4 glow-blue">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center text-white font-bold text-lg">
              {stock.ticker.slice(0, 2)}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{stock.ticker} <span className="text-gray-400 text-sm font-normal">— {stock.company}</span></h3>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-white font-semibold">{formatCurrency(stock.price)}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-neon-orange/15 text-neon-orange border border-neon-orange/30">
                  ±{stock.impliedMove}% Expected
                </span>
                {stock.ivSource && stock.ivSource !== 'none' && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    stock.ivSource === 'orats' ? 'bg-neon-purple/15 text-neon-purple border border-neon-purple/30' :
                    stock.ivSource === 'alpha_vantage' ? 'bg-neon-green/15 text-neon-green border border-neon-green/30' :
                    'bg-gray-700 text-gray-400'
                  }`}>
                    {stock.ivSource === 'orats' ? 'ORATS' : stock.ivSource === 'alpha_vantage' ? 'Alpha Vantage' : stock.ivSource}
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  {stock.timing === 'BMO' ? 'Before Market Open' : 'After Market Close'}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-dark-600 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <StatsRow stock={stock} />
      </div>

      {/* ORATS IV Crush Analytics (only shows when ORATS data is available) */}
      <OratsInsights stock={stock} />

      {/* Charts */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-white">Historical Earnings Moves (5 Years)</h4>
          {stock.historySource === 'orats' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-neon-purple/15 text-neon-purple font-bold">
              Actual stock moves via ORATS
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Orange dashed lines = current implied move (±{stock.impliedMove}%). Bars outside = would have been a loss.
        </p>
        <HistoricalMovesChart historicalMoves={stock.historicalMoves} impliedMove={stock.impliedMove} />
      </div>

      {/* Safe Zone Calculator */}
      <div className="glass-card p-4">
        <SafeZoneVisual stock={stock} />
      </div>

      {/* Prediction + News */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PredictionCard stock={stock} />
        <NewsPanel stock={stock} />
      </div>
    </div>
  );
}
