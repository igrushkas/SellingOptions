import { useState } from 'react';
import { Brain, Send, Loader2, Sparkles, AlertTriangle } from 'lucide-react';
import {
  predictNextMove,
  calcSafeZone,
  formatCurrency,
  calcNewsSentiment,
  calcAvgMove,
  calcMaxMove,
  calcMedianMove,
  calcStdDev,
  calcDirectionalBias,
} from '../utils/calculations';

function generateLocalAnalysis(stock) {
  const prediction = predictNextMove(stock.historicalMoves, stock.impliedMove);
  const zones = calcSafeZone(stock.price, stock.impliedMove, stock.historicalMoves);
  const sentiment = calcNewsSentiment(stock.news);
  const avgMove = calcAvgMove(stock.historicalMoves);
  const maxMove = calcMaxMove(stock.historicalMoves);
  const medianMove = calcMedianMove(stock.historicalMoves);
  const stdDev = calcStdDev(stock.historicalMoves);
  const bias = calcDirectionalBias(stock.historicalMoves);

  const sentimentWord = sentiment > 0.3 ? 'positive' : sentiment < -0.3 ? 'negative' : 'mixed';

  let analysis = `## ${stock.ticker} Earnings Analysis\n\n`;

  // Trade signal
  const signalEmoji = { excellent: 'STRONG SELL (options)', good: 'SELL (options)', neutral: 'CAUTION', risky: 'AVOID' };
  analysis += `**Trade Signal: ${signalEmoji[prediction.signal]}**\n\n`;

  // Key metrics
  analysis += `### Key Metrics\n`;
  analysis += `- **Implied Move:** ±${stock.impliedMove}% (${formatCurrency(stock.price * stock.impliedMove / 100)})\n`;
  analysis += `- **Avg Historical Move:** ±${avgMove.toFixed(1)}% (${formatCurrency(stock.price * avgMove / 100)})\n`;
  analysis += `- **Median Move:** ±${medianMove.toFixed(1)}%\n`;
  analysis += `- **Max Historical Move:** ±${maxMove.toFixed(1)}%\n`;
  analysis += `- **IV Crush Ratio:** ${prediction.crushRatio}x ${prediction.crushRatio >= 1.2 ? '(IV is OVERPRICED - favorable for sellers)' : prediction.crushRatio >= 1.0 ? '(slightly overpriced)' : '(underpriced - DANGER)'}\n`;
  analysis += `- **Historical Win Rate:** ${prediction.winRate}% at implied move strikes\n\n`;

  // Directional bias
  analysis += `### Directional Bias\n`;
  analysis += `Over the last 8 earnings, ${stock.ticker} moved UP ${bias.bullish} times (avg +${bias.avgUpSize}%) and DOWN ${bias.bearish} times (avg -${bias.avgDownSize}%). `;
  analysis += `Bias: **${bias.bias.toUpperCase()}**.\n\n`;

  // News impact
  analysis += `### News Impact\n`;
  analysis += `Current news sentiment is **${sentimentWord}**. `;
  stock.news.forEach(n => {
    analysis += `${n.sentiment === 'positive' ? '+' : '-'} ${n.headline}. `;
  });
  analysis += '\n\n';

  // Recommended trade
  analysis += `### Recommended Trade\n`;
  if (prediction.signal === 'excellent' || prediction.signal === 'good') {
    analysis += `**Sell Naked Calls** above **${formatCurrency(zones.safe.high)}** (±${zones.safe.distance}% from current price)\n`;
    analysis += `**Sell Naked Puts** below **${formatCurrency(zones.safe.low)}** (±${zones.safe.distance}% from current price)\n\n`;
    analysis += `This gives you a **${zones.safe.winRate.toFixed(0)}% historical win rate** based on the last 20 earnings.\n\n`;
    analysis += `For a more conservative approach (beyond max historical move):\n`;
    analysis += `- Calls above **${formatCurrency(zones.conservative.high)}**\n`;
    analysis += `- Puts below **${formatCurrency(zones.conservative.low)}**\n`;
    analysis += `- Win rate: **~${zones.conservative.winRate}%**\n\n`;
  } else if (prediction.signal === 'neutral') {
    analysis += `This is a marginal setup. If you trade, use **conservative** strike zones:\n`;
    analysis += `- Calls above **${formatCurrency(zones.conservative.high)}**\n`;
    analysis += `- Puts below **${formatCurrency(zones.conservative.low)}**\n`;
    analysis += `- The premium will be lower, but your win rate should be ~${zones.conservative.winRate}%.\n\n`;
  } else {
    analysis += `**AVOID this trade.** The implied move is underpriced relative to historical moves. `;
    analysis += `The stock has exceeded the implied move ${100 - prediction.winRate}% of the time. `;
    analysis += `Risk of significant loss is too high.\n\n`;
  }

  // Risk warning
  analysis += `### Risk Management\n`;
  analysis += `- **Max Loss Scenario:** If ${stock.ticker} moves ${maxMove.toFixed(1)}% (worst historical), `;
  analysis += `naked calls/puts at the safe zone could lose ~${formatCurrency(stock.price * (maxMove - zones.safe.distance) / 100)} per share.\n`;
  analysis += `- **Position Sizing:** Never risk more than 2-3% of your portfolio on a single earnings play.\n`;
  analysis += `- **Exit Plan:** If the stock moves beyond your strike before earnings, close the position for a small loss rather than holding.\n`;
  analysis += `- **Timing:** ${stock.timing === 'BMO' ? 'Open positions the day BEFORE earnings. Close or let expire the day of.' : 'Open positions during market hours on earnings day. The IV crush happens at the next market open.'}\n`;

  return analysis;
}

export default function AIAnalysisPanel({ stock }) {
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiInput, setShowApiInput] = useState(false);
  const [useLocal, setUseLocal] = useState(true);

  const runLocalAnalysis = () => {
    setLoading(true);
    // Simulate a short delay to feel more "AI-like"
    setTimeout(() => {
      const result = generateLocalAnalysis(stock);
      setAnalysis(result);
      setLoading(false);
    }, 800);
  };

  const runAIAnalysis = async () => {
    if (!apiKey) {
      setShowApiInput(true);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock,
          apiKey,
        }),
      });
      const data = await response.json();
      setAnalysis(data.analysis);
    } catch {
      // Fallback to local analysis
      const result = generateLocalAnalysis(stock);
      setAnalysis(result);
    }
    setLoading(false);
  };

  // Simple markdown renderer
  const renderMarkdown = (text) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('## ')) {
        return <h2 key={i} className="text-xl font-bold text-white mt-2 mb-2 gradient-text">{line.replace('## ', '')}</h2>;
      }
      if (line.startsWith('### ')) {
        return <h3 key={i} className="text-sm font-bold text-neon-blue mt-4 mb-1 uppercase tracking-wider">{line.replace('### ', '')}</h3>;
      }
      if (line.startsWith('**Trade Signal:')) {
        const content = line.replace(/\*\*/g, '');
        const isGood = content.includes('SELL');
        return (
          <div key={i} className={`text-lg font-bold mb-3 ${isGood ? 'text-neon-green' : content.includes('AVOID') ? 'text-neon-red' : 'text-neon-yellow'}`}>
            {content}
          </div>
        );
      }
      if (line.startsWith('- ')) {
        const content = line.replace('- ', '');
        // Bold markers
        const parts = content.split(/(\*\*.*?\*\*)/g).map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={j} className="text-white">{part.replace(/\*\*/g, '')}</strong>;
          }
          return <span key={j}>{part}</span>;
        });
        return <li key={i} className="text-xs text-gray-300 ml-4 mb-1 list-disc">{parts}</li>;
      }
      if (line.trim() === '') return <div key={i} className="h-2" />;
      // Inline bold
      const parts = line.split(/(\*\*.*?\*\*)/g).map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={j} className="text-white">{part.replace(/\*\*/g, '')}</strong>;
        }
        return <span key={j}>{part}</span>;
      });
      return <p key={i} className="text-xs text-gray-300 mb-1">{parts}</p>;
    });
  };

  return (
    <div className="glass-card p-4 glow-purple">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-neon-purple" />
          <h3 className="text-sm font-bold text-white">AI Trade Analysis</h3>
          <Sparkles className="w-3 h-3 text-neon-purple" />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUseLocal(true)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              useLocal ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/30' : 'bg-dark-700 text-gray-400'
            }`}
          >
            Local Analysis
          </button>
          <button
            onClick={() => { setUseLocal(false); setShowApiInput(true); }}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              !useLocal ? 'bg-neon-blue/20 text-neon-blue border border-neon-blue/30' : 'bg-dark-700 text-gray-400'
            }`}
          >
            ChatGPT API
          </button>
        </div>
      </div>

      {/* API Key Input */}
      {showApiInput && !useLocal && (
        <div className="mb-4 flex items-center gap-2">
          <input
            type="password"
            placeholder="Enter OpenAI API key..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="flex-1 bg-dark-700 border border-glass-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-neon-blue"
          />
          <button
            onClick={runAIAnalysis}
            disabled={!apiKey || loading}
            className="px-4 py-2 bg-neon-blue rounded-lg text-white text-sm font-medium hover:bg-neon-blue/80 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Analyze
          </button>
        </div>
      )}

      {/* Analyze Button */}
      {!analysis && (
        <button
          onClick={useLocal ? runLocalAnalysis : runAIAnalysis}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-neon-purple to-neon-blue text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Analyzing {stock.ticker}...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Analyze {stock.ticker} for Options Selling
            </>
          )}
        </button>
      )}

      {/* Analysis Output */}
      {analysis && (
        <div className="mt-2">
          <div className="bg-dark-800 rounded-xl p-4 border border-glass-border max-h-[500px] overflow-y-auto">
            {renderMarkdown(analysis)}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={useLocal ? runLocalAnalysis : runAIAnalysis}
              className="px-4 py-2 bg-dark-700 rounded-lg text-sm text-gray-300 hover:text-white flex items-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Re-analyze
            </button>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <AlertTriangle className="w-3 h-3" />
              Not financial advice. Always do your own research.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
