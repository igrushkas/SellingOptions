import { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, Shield, Target, AlertCircle, Newspaper, Activity, ArrowDown, ArrowUp, Crosshair, Info } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import StrategyDiagram from './StrategyDiagram';
import {
  calcSafeZone,
  predictNextMove,
  formatCurrency,
  calcNewsSentiment,
  calcAvgMove,
  calcMaxMove,
  calcMedianMove,
  getStrategyRecommendation,
} from '../utils/calculations';

// ── Historical Chart ──
function HistoricalMovesChart({ historicalMoves, impliedMove }) {
  const chartData = [...historicalMoves].reverse().map(m => ({
    quarter: m.quarter.replace('Q', '').replace(' ', "'"),
    move: m.direction === 'up' ? m.actual : -m.actual,
    fill: m.direction === 'up' ? '#00ff88' : '#ff3366',
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 15, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="quarter" tick={{ fill: '#94a3b8', fontSize: 9 }} angle={-45} textAnchor="end" height={50} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
        <Tooltip
          contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
          labelStyle={{ color: '#fff' }}
          formatter={(value) => [`${value.toFixed(1)}%`, 'Move']}
        />
        <ReferenceLine y={impliedMove} stroke="#ff8800" strokeDasharray="5 5" label={{ value: `+${impliedMove}%`, fill: '#ff8800', fontSize: 10, position: 'right' }} />
        <ReferenceLine y={-impliedMove} stroke="#ff8800" strokeDasharray="5 5" label={{ value: `-${impliedMove}%`, fill: '#ff8800', fontSize: 10, position: 'right' }} />
        <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
        <Bar dataKey="move" radius={[3, 3, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={index} fill={entry.fill} fillOpacity={0.8} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Safe Zone Visual ──
function SafeZoneVisual({ stock }) {
  const zones = calcSafeZone(stock.price, stock.impliedMove, stock.historicalMoves);
  const zoneConfigs = [
    { label: 'Aggressive', zone: zones.aggressive, color: 'neon-red', bgColor: 'bg-neon-red/10', borderColor: 'border-neon-red/30' },
    { label: 'Recommended', zone: zones.safe, color: 'neon-green', bgColor: 'bg-neon-green/10', borderColor: 'border-neon-green/30' },
    { label: 'Conservative', zone: zones.conservative, color: 'neon-blue', bgColor: 'bg-neon-blue/10', borderColor: 'border-neon-blue/30' },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Target className="w-3.5 h-3.5 text-neon-green" />
        <h4 className="text-xs font-semibold text-white">Strike Zone Calculator</h4>
      </div>
      {/* Visual Price Bar */}
      <div className="relative h-10 rounded-lg bg-dark-700 overflow-hidden mb-2">
        <div className="absolute h-full bg-neon-blue/10 border-x border-neon-blue/30"
          style={{ left: `${Math.max(0, 50 - zones.conservative.distance * 2.5)}%`, right: `${Math.max(0, 50 - zones.conservative.distance * 2.5)}%` }} />
        <div className="absolute h-full bg-neon-green/15 border-x border-neon-green/40"
          style={{ left: `${Math.max(0, 50 - zones.safe.distance * 2.5)}%`, right: `${Math.max(0, 50 - zones.safe.distance * 2.5)}%` }} />
        <div className="absolute h-full bg-neon-orange/20 border-x border-neon-orange/50"
          style={{ left: `${Math.max(0, 50 - stock.impliedMove * 2.5)}%`, right: `${Math.max(0, 50 - stock.impliedMove * 2.5)}%` }} />
        <div className="absolute left-1/2 h-full w-0.5 bg-white/50" />
        <div className="absolute left-1/2 top-1 -translate-x-1/2 text-[10px] font-bold text-white bg-dark-600 px-1.5 py-0.5 rounded">
          {formatCurrency(stock.price)}
        </div>
      </div>
      {/* Zone Cards */}
      <div className="grid grid-cols-3 gap-2">
        {zoneConfigs.map(({ label, zone, color, bgColor, borderColor }) => (
          <div key={label} className={`${bgColor} border ${borderColor} rounded-lg p-2`}>
            <div className="flex items-center gap-1 mb-1">
              <Shield className={`w-3 h-3 text-${color}`} />
              <span className={`text-[10px] font-bold text-${color} uppercase`}>{label}</span>
            </div>
            <div className="space-y-0.5 text-[10px]">
              <div className="flex justify-between"><span className="text-gray-400">Call:</span><span className="text-white font-semibold">{formatCurrency(zone.high)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Put:</span><span className="text-white font-semibold">{formatCurrency(zone.low)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Win:</span><span className={`font-bold text-${color}`}>{zone.winRate.toFixed(0)}%</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Prediction Card ──
function PredictionCard({ stock }) {
  const prediction = predictNextMove(stock.historicalMoves, stock.impliedMove);
  const signalColors = { excellent: 'text-neon-green', good: 'text-neon-blue', neutral: 'text-neon-yellow', risky: 'text-neon-red' };

  return (
    <div>
      <h4 className="text-xs font-semibold text-white mb-2 flex items-center gap-1.5">
        <AlertCircle className="w-3.5 h-3.5 text-neon-purple" />
        Move Prediction
      </h4>
      <div className="grid grid-cols-3 gap-2">
        <div><span className="text-[10px] text-gray-400">Predicted</span><div className="text-sm font-bold text-white">±{prediction.predictedRange}%</div></div>
        <div><span className="text-[10px] text-gray-400">Implied</span><div className="text-sm font-bold text-neon-orange">±{prediction.impliedMove}%</div></div>
        <div><span className="text-[10px] text-gray-400">Crush</span><div className={`text-sm font-bold ${prediction.crushRatio >= 1.2 ? 'text-neon-green' : 'text-gray-300'}`}>{prediction.crushRatio}x</div></div>
        <div><span className="text-[10px] text-gray-400">Win Rate</span><div className={`text-sm font-bold ${prediction.winRate >= 75 ? 'text-neon-green' : 'text-neon-orange'}`}>{prediction.winRate}%</div></div>
        <div><span className="text-[10px] text-gray-400">Bias</span><div className={`text-sm font-bold ${prediction.bias === 'bullish' ? 'text-neon-green' : prediction.bias === 'bearish' ? 'text-neon-red' : 'text-gray-300'}`}>{prediction.bias.charAt(0).toUpperCase() + prediction.bias.slice(1)}</div></div>
        <div><span className="text-[10px] text-gray-400">Signal</span><div className={`text-sm font-bold uppercase ${signalColors[prediction.signal]}`}>{prediction.signal}</div></div>
      </div>
    </div>
  );
}

// ── News Panel ──
function NewsPanel({ stock }) {
  const sentiment = calcNewsSentiment(stock.news);
  const sentimentLabel = sentiment > 0.3 ? 'Bullish' : sentiment < -0.3 ? 'Bearish' : 'Mixed';
  const sentimentColor = sentiment > 0.3 ? 'text-neon-green' : sentiment < -0.3 ? 'text-neon-red' : 'text-neon-yellow';

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
          <Newspaper className="w-3.5 h-3.5 text-neon-blue" />
          News
        </h4>
        <span className={`text-[10px] font-bold ${sentimentColor}`}>{sentimentLabel}</span>
      </div>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {stock.news.map((item, i) => (
          <div key={i} className="flex items-start gap-1.5 text-[10px]">
            <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${
              item.sentiment === 'positive' ? 'bg-neon-green' : item.sentiment === 'negative' ? 'bg-neon-red' : 'bg-gray-400'
            }`} />
            <span className="text-gray-300">{item.headline}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Stats Row (compact) ──
function StatsRow({ stock }) {
  const avgMove = calcAvgMove(stock.historicalMoves);
  const maxMove = calcMaxMove(stock.historicalMoves);
  const medianMove = calcMedianMove(stock.historicalMoves);

  const stats = [
    { label: 'Avg', value: `${avgMove.toFixed(1)}%` },
    { label: 'Median', value: `${medianMove.toFixed(1)}%` },
    { label: 'Max', value: `${maxMove.toFixed(1)}%` },
    { label: 'EPS Est', value: `$${stock.epsEstimate}` },
    { label: 'EPS Prior', value: `$${stock.epsPrior}` },
    { label: 'Rev Est', value: stock.revenueEstimate },
    { label: 'Rating', value: stock.consensusRating },
    { label: 'Analysts', value: stock.analystCount },
  ];

  return (
    <div className="grid grid-cols-4 md:grid-cols-8 gap-1.5">
      {stats.map(s => (
        <div key={s.label} className="bg-dark-700/50 rounded px-2 py-1.5 text-center">
          <div className="text-[9px] text-gray-500 uppercase">{s.label}</div>
          <div className="text-xs font-semibold text-white">{s.value}</div>
        </div>
      ))}
    </div>
  );
}

// ── ORATS Insights (compact) ──
function OratsInsights({ stock }) {
  if (!stock.ivCrushStats) return null;
  const stats = stock.ivCrushStats;

  return (
    <div className="glass-card p-3">
      <h4 className="text-xs font-semibold text-white mb-2 flex items-center gap-1.5">
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-neon-purple/20 text-neon-purple font-bold">ORATS</span>
        IV Crush Analytics
      </h4>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div><span className="text-[10px] text-gray-400">Analyzed</span><div className="font-bold text-white">{stats.totalEarnings}</div></div>
        <div><span className="text-[10px] text-gray-400">IV Overstated</span><div className={`font-bold ${stats.winRate >= 70 ? 'text-neon-green' : 'text-neon-orange'}`}>{stats.winRate}%</div></div>
        <div><span className="text-[10px] text-gray-400">Avg Crush</span><div className={`font-bold ${stats.avgCrushPct > 0 ? 'text-neon-green' : 'text-neon-red'}`}>{stats.avgCrushPct > 0 ? '+' : ''}{stats.avgCrushPct}%</div></div>
        <div><span className="text-[10px] text-gray-400">Avg Implied</span><div className="font-bold text-neon-orange">±{stats.avgImpliedMove}%</div></div>
        <div><span className="text-[10px] text-gray-400">Avg Actual</span><div className="font-bold text-white">±{stats.avgActualMove}%</div></div>
        {stock.historySource === 'orats' && (
          <div><span className="text-[10px] text-gray-400">Source</span><div className="text-[10px] text-neon-purple font-semibold">Actual moves</div></div>
        )}
      </div>
    </div>
  );
}

// ── Tastytrade Metrics (compact) ──
function TastytradeMetrics({ ticker }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/tastytrade/metrics?symbols=${encodeURIComponent(ticker)}`)
      .then(res => { if (!res.ok) throw new Error('Not configured'); return res.json(); })
      .then(data => { if (!cancelled && data.metrics?.[0]) setMetrics(data.metrics[0]); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ticker]);

  if (loading || !metrics) return null;

  const ivRank = metrics.twIvRank ?? metrics.tosIvRank ?? metrics.ivRank;
  const ivPct = metrics.ivPercentile;
  const ivRankNum = ivRank != null ? parseFloat(ivRank) : null;
  const ivPctNum = ivPct != null ? parseFloat(ivPct) : null;
  const ivColor = (val) => val == null ? 'text-gray-400' : val >= 50 ? 'text-neon-green' : val >= 30 ? 'text-neon-yellow' : 'text-neon-red';

  return (
    <div className="glass-card p-3">
      <h4 className="text-xs font-semibold text-white mb-2 flex items-center gap-1.5">
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-neon-blue/20 text-neon-blue font-bold">TASTY</span>
        <Activity className="w-3 h-3 text-neon-blue" />
        IV Metrics
      </h4>
      <div className="grid grid-cols-3 gap-2 text-xs">
        {ivRankNum != null && (
          <div><span className="text-[10px] text-gray-400">IV Rank</span><div className={`font-bold ${ivColor(ivRankNum)}`}>{ivRankNum.toFixed(1)}%</div></div>
        )}
        {ivPctNum != null && (
          <div><span className="text-[10px] text-gray-400">IV Pctl</span><div className={`font-bold ${ivColor(ivPctNum)}`}>{ivPctNum.toFixed(1)}%</div></div>
        )}
        {metrics.iv30Day && (
          <div><span className="text-[10px] text-gray-400">IV 30d</span><div className="font-bold text-white">{(parseFloat(metrics.iv30Day) * 100).toFixed(1)}%</div></div>
        )}
        {metrics.hv30Day && (
          <div><span className="text-[10px] text-gray-400">HV 30d</span><div className="font-bold text-gray-300">{(parseFloat(metrics.hv30Day) * 100).toFixed(1)}%</div></div>
        )}
        {metrics.ivHvDiff30Day && (
          <div><span className="text-[10px] text-gray-400">IV-HV</span><div className={`font-bold ${parseFloat(metrics.ivHvDiff30Day) > 0 ? 'text-neon-green' : 'text-neon-red'}`}>{parseFloat(metrics.ivHvDiff30Day) > 0 ? '+' : ''}{(parseFloat(metrics.ivHvDiff30Day) * 100).toFixed(1)}%</div></div>
        )}
        {metrics.liquidityRating != null && (
          <div><span className="text-[10px] text-gray-400">Liquidity</span><div className={`font-bold ${metrics.liquidityRating >= 3 ? 'text-neon-green' : 'text-neon-red'}`}>{metrics.liquidityRating}/5</div></div>
        )}
        {metrics.beta && (
          <div><span className="text-[10px] text-gray-400">Beta</span><div className="font-bold text-white">{parseFloat(metrics.beta).toFixed(2)}</div></div>
        )}
      </div>
    </div>
  );
}

// ── Risk Colors ──
const riskColors = {
  low: { bg: 'bg-neon-green/10', text: 'text-neon-green', border: 'border-neon-green/30', label: 'Low Risk' },
  moderate: { bg: 'bg-neon-yellow/10', text: 'text-neon-yellow', border: 'border-neon-yellow/30', label: 'Moderate' },
  high: { bg: 'bg-neon-red/10', text: 'text-neon-red', border: 'border-neon-red/30', label: 'High Risk' },
  extreme: { bg: 'bg-neon-red/10', text: 'text-neon-red', border: 'border-neon-red/30', label: 'Extreme' },
  unknown: { bg: 'bg-gray-700/50', text: 'text-gray-400', border: 'border-gray-600', label: 'Unknown' },
};

// ── Strategy Trade Card ──
function StrategyTradeCard({ stock }) {
  const rec = getStrategyRecommendation(stock);
  const risk = riskColors[rec.riskLevel] || riskColors.unknown;
  const isSkip = rec.strategy === 'skip';

  return (
    <div className="glass-card p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
          <Crosshair className="w-3.5 h-3.5 text-neon-purple" />
          Strategy
        </h4>
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${risk.bg} ${risk.text} border ${risk.border}`}>
            {risk.label}
          </span>
          {rec.confidence > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-neon-purple/10 text-neon-purple border border-neon-purple/30">
              {rec.confidence}%
            </span>
          )}
        </div>
      </div>

      <div className={`text-base font-bold mb-2 ${isSkip ? 'text-gray-500' : 'text-white'}`}>
        {rec.strategyName}
      </div>

      {/* P&L Diagram */}
      {!isSkip && (
        <div className="mb-2 bg-dark-700/30 rounded-lg p-2">
          <StrategyDiagram strategy={rec.strategy} showLabel={false} />
        </div>
      )}

      {/* Leg Details */}
      {rec.legs.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {rec.legs.map((leg, i) => {
            const isSell = leg.type === 'Sell' || leg.type.startsWith('Sell');
            const instrument = leg.instrument || leg.type.replace('Sell ', '').replace('Buy ', '');
            return (
              <div key={i} className={`flex items-center justify-between p-2 rounded-lg text-xs ${
                isSell ? 'bg-neon-orange/10 border border-neon-orange/20' : 'bg-dark-700/50 border border-glass-border'
              }`}>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${
                    isSell ? 'bg-neon-orange/20 text-neon-orange' : 'bg-gray-700 text-gray-400'
                  }`}>{isSell ? 'SELL' : 'BUY'}</span>
                  <span className="text-white font-semibold">{leg.qty || 1} {instrument}</span>
                </div>
                <span className="font-bold text-white">@ {formatCurrency(leg.strike)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-glass-border">
        <div className="text-center">
          <div className="text-[9px] text-gray-500">IV Crush</div>
          <div className={`text-xs font-bold ${rec.crushRatio >= 1.2 ? 'text-neon-green' : 'text-gray-300'}`}>{rec.crushRatio?.toFixed(2) || '—'}x</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] text-gray-500">Win Rate</div>
          <div className={`text-xs font-bold ${rec.winRate >= 75 ? 'text-neon-green' : 'text-neon-orange'}`}>{rec.winRate?.toFixed(0) || '—'}%</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] text-gray-500">Bias</div>
          <div className={`text-xs font-bold ${rec.bias === 'bullish' ? 'text-neon-green' : rec.bias === 'bearish' ? 'text-neon-red' : 'text-gray-300'}`}>
            {rec.bias ? rec.bias.charAt(0).toUpperCase() + rec.bias.slice(1) : '—'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Reasoning + Bias Card ──
function ReasoningCard({ stock }) {
  const rec = getStrategyRecommendation(stock);
  const isSkip = rec.strategy === 'skip';

  return (
    <div className="glass-card p-3">
      <h4 className="text-xs font-semibold text-white mb-2">Why This Strategy</h4>

      {/* Directional Bias */}
      {rec.downPct != null && !isSkip && (
        <div className="mb-2">
          <span className="text-[9px] text-gray-500 uppercase block mb-1">Directional Bias (8Q)</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-neon-red font-semibold flex items-center gap-0.5">
              <ArrowDown className="w-2.5 h-2.5" />{Math.round(rec.downPct * 100)}%
            </span>
            <div className="flex-1 h-2 bg-dark-600 rounded-full overflow-hidden flex">
              <div className="bg-neon-red/70 h-full" style={{ width: `${rec.downPct * 100}%` }} />
              <div className="bg-neon-green/70 h-full" style={{ width: `${rec.upPct * 100}%` }} />
            </div>
            <span className="text-[10px] text-neon-green font-semibold flex items-center gap-0.5">
              {Math.round(rec.upPct * 100)}%<ArrowUp className="w-2.5 h-2.5" />
            </span>
          </div>
          {rec.avgDownMag > 0 && rec.avgUpMag > 0 && (
            <div className="flex justify-between mt-0.5 text-[9px] text-gray-500">
              <span>Avg: -{rec.avgDownMag.toFixed(1)}%</span>
              <span>Avg: +{rec.avgUpMag.toFixed(1)}%</span>
            </div>
          )}
        </div>
      )}

      {/* Reasoning */}
      <div className="bg-dark-700/30 rounded-lg p-2">
        <p className="text-[10px] text-gray-300 leading-relaxed">{rec.reason}</p>
      </div>
    </div>
  );
}

// ── Sizing + Exit Card ──
function SizingCard({ stock }) {
  const rec = getStrategyRecommendation(stock);

  if (!rec.sizing || !rec.exitRules) return null;

  return (
    <div className="glass-card p-3">
      <h4 className="text-xs font-semibold text-white mb-2">Position & Exit</h4>

      <div className="space-y-2">
        {/* Sizing */}
        <div className="bg-dark-700/30 rounded-lg p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-gray-500 uppercase">Position Size</span>
            <span className="text-sm font-bold text-neon-purple">{rec.sizing.accountPct}%</span>
          </div>
          <div className="text-[9px] text-gray-500">Kelly: {rec.sizing.kellyFull}% (using quarter)</div>
        </div>

        {/* Exit Rules */}
        <div className="bg-dark-700/30 rounded-lg p-2 space-y-1">
          <span className="text-[9px] text-gray-500 uppercase block">Exit Rules</span>
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-400">Profit:</span>
            <span className="text-neon-green font-semibold">{rec.exitRules.profitTarget}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-400">Stop:</span>
            <span className="text-neon-red font-semibold">{rec.exitRules.stopLoss}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-400">Time:</span>
            <span className="text-white font-semibold">10 AM ET next day</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Stock Detail Page ──
export default function StockDetail({ stock, onClose, onAddTrade }) {
  return (
    <div className="space-y-3">
      {/* Back Button */}
      <button
        onClick={onClose}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-1"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      {/* Header — compact */}
      <div className="glass-card p-4 glow-blue">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-blue to-neon-purple flex items-center justify-center text-white font-bold text-sm">
              {stock.ticker.slice(0, 2)}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{stock.ticker} <span className="text-gray-400 text-sm font-normal">— {stock.company}</span></h3>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-white font-semibold">{formatCurrency(stock.price)}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neon-orange/15 text-neon-orange border border-neon-orange/30">
                  ±{stock.impliedMove}% Expected
                </span>
                {stock.ivSource && stock.ivSource !== 'none' && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                    stock.ivSource === 'orats' ? 'bg-neon-purple/15 text-neon-purple border border-neon-purple/30' :
                    stock.ivSource === 'alpha_vantage' ? 'bg-neon-green/15 text-neon-green border border-neon-green/30' :
                    'bg-gray-700 text-gray-400'
                  }`}>
                    {stock.ivSource === 'orats' ? 'ORATS' : stock.ivSource === 'alpha_vantage' ? 'Alpha Vantage' : stock.ivSource}
                  </span>
                )}
                <span className="text-[10px] text-gray-500">{stock.timing === 'BMO' ? 'BMO' : 'AMC'}</span>
              </div>
            </div>
          </div>
          {onAddTrade && (
            <button
              onClick={() => onAddTrade(stock)}
              className="px-4 py-2 rounded-lg bg-neon-purple/20 text-neon-purple text-xs font-semibold border border-neon-purple/30 hover:bg-neon-purple/30 transition-all"
            >
              + Log Trade
            </button>
          )}
        </div>
        <StatsRow stock={stock} />
      </div>

      {/* Row 1: Strategy | Reasoning | Sizing — 3 cards in a row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <StrategyTradeCard stock={stock} />
        <ReasoningCard stock={stock} />
        <SizingCard stock={stock} />
      </div>

      {/* Row 2: Tastytrade | ORATS | Prediction+News — 3 cards in a row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <TastytradeMetrics ticker={stock.ticker} />
        <OratsInsights stock={stock} />
        <div className="glass-card p-3">
          <PredictionCard stock={stock} />
        </div>
      </div>

      {/* Row 3: Chart + Safe Zones side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="glass-card p-3">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-xs font-semibold text-white">Historical Earnings Moves</h4>
            {stock.historySource === 'orats' && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-neon-purple/15 text-neon-purple font-bold">ORATS</span>
            )}
          </div>
          <p className="text-[9px] text-gray-500 mb-1">
            Orange dashed = implied move (±{stock.impliedMove}%). Bars outside = loss.
          </p>
          <HistoricalMovesChart historicalMoves={stock.historicalMoves} impliedMove={stock.impliedMove} />
        </div>
        <div className="glass-card p-3">
          <SafeZoneVisual stock={stock} />
        </div>
      </div>

      {/* Row 4: News */}
      {stock.news?.length > 0 && (
        <div className="glass-card p-3">
          <NewsPanel stock={stock} />
        </div>
      )}
    </div>
  );
}
