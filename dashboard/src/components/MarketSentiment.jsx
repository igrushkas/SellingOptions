import { useState } from 'react';
import { Brain, TrendingUp, TrendingDown, Minus, RefreshCw, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

function renderMarkdown(text) {
  if (!text) return null;

  return text.split('\n').map((line, i) => {
    // Headers
    if (line.startsWith('### ')) return <h4 key={i} className="text-sm font-bold text-white mt-4 mb-1">{line.slice(4)}</h4>;
    if (line.startsWith('## ')) return <h3 key={i} className="text-base font-bold text-white mt-4 mb-2">{line.slice(3)}</h3>;
    if (line.startsWith('# ')) return <h2 key={i} className="text-lg font-bold text-white mt-4 mb-2">{line.slice(2)}</h2>;

    // Bold text within lines
    const boldParsed = line.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

    // List items
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <li key={i} className="text-gray-300 text-xs ml-4 mb-1 list-disc"
          dangerouslySetInnerHTML={{ __html: boldParsed.slice(2) }} />
      );
    }

    // Numbered items
    if (/^\d+\.\s/.test(line)) {
      return (
        <li key={i} className="text-gray-300 text-xs ml-4 mb-1 list-decimal"
          dangerouslySetInnerHTML={{ __html: boldParsed.replace(/^\d+\.\s/, '') }} />
      );
    }

    // Empty lines
    if (line.trim() === '') return <div key={i} className="h-2" />;

    // Regular text
    return <p key={i} className="text-gray-300 text-xs mb-1" dangerouslySetInnerHTML={{ __html: boldParsed }} />;
  });
}

export default function MarketSentiment() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('openai_key') || '');
  const [showKeyInput, setShowKeyInput] = useState(false);

  const fetchSentiment = async (force = false) => {
    if (!apiKey) {
      setShowKeyInput(true);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({ apiKey });
      if (force) params.set('refresh', 'true');
      const res = await fetch(`/api/market-sentiment?${params}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || err.error || `HTTP ${res.status}`);
      }
      const result = await res.json();
      setData(result);
      setExpanded(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('openai_key', apiKey.trim());
      setShowKeyInput(false);
      fetchSentiment();
    }
  };

  // Market direction indicator
  const getMarketMood = () => {
    if (!data?.market?.spy) return null;
    const change = data.market.spy.periodChange;
    if (change > 1) return { icon: TrendingUp, label: 'Bullish', color: 'text-neon-green', bg: 'bg-neon-green/15' };
    if (change < -1) return { icon: TrendingDown, label: 'Bearish', color: 'text-neon-red', bg: 'bg-neon-red/15' };
    return { icon: Minus, label: 'Neutral', color: 'text-neon-yellow', bg: 'bg-neon-yellow/15' };
  };

  const mood = data ? getMarketMood() : null;

  return (
    <div className="mb-6">
      {/* Header bar */}
      <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-lg bg-dark-700 border border-glass-border">
        <Brain className="w-5 h-5 text-neon-blue" />
        <h2 className="text-lg font-bold text-white">Market Sentiment</h2>
        <span className="text-xs text-gray-400">— AI-powered market context for earnings plays</span>

        {mood && (
          <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-semibold ${mood.bg} ${mood.color} border border-current/20`}>
            <mood.icon className="w-3 h-3 inline mr-1" />
            {mood.label}
          </span>
        )}

        {data && (
          <span className="text-[9px] text-gray-500 ml-1">
            Updated {new Date(data.generatedAt).toLocaleTimeString()}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {!data && !loading && (
            <button
              onClick={() => fetchSentiment()}
              className="px-3 py-1.5 rounded-lg bg-neon-blue/15 text-neon-blue text-xs font-semibold border border-neon-blue/30 hover:bg-neon-blue/25 transition-all"
            >
              Generate Report
            </button>
          )}
          {data && (
            <>
              <button
                onClick={() => fetchSentiment(true)}
                disabled={loading}
                className="p-1.5 rounded-lg hover:bg-dark-600 text-gray-400 hover:text-white transition-all disabled:opacity-50"
                title="Refresh analysis"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-1.5 rounded-lg hover:bg-dark-600 text-gray-400 hover:text-white transition-all"
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* API Key Input */}
      {showKeyInput && (
        <div className="glass-card p-4 mb-4">
          <p className="text-xs text-gray-400 mb-2">Enter your OpenAI API key to enable market sentiment analysis:</p>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="flex-1 bg-dark-700 border border-glass-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-neon-blue/50 focus:outline-none"
              onKeyDown={(e) => e.key === 'Enter' && saveKey()}
            />
            <button
              onClick={saveKey}
              className="px-4 py-2 rounded-lg bg-neon-blue/20 text-neon-blue text-xs font-semibold border border-neon-blue/30 hover:bg-neon-blue/30 transition-all"
            >
              Save & Analyze
            </button>
          </div>
          <p className="text-[10px] text-gray-500 mt-1.5">Key stored locally in your browser. Never sent to our server.</p>
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="glass-card p-8 text-center">
          <RefreshCw className="w-6 h-6 text-neon-blue animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">Analyzing market conditions with ChatGPT...</p>
          <p className="text-xs text-gray-500 mt-1">Fetching SPY, QQQ, VIX + recent earnings data</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="glass-card p-4 mb-4 border-l-2 border-l-neon-red">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-neon-red" />
            <span className="text-xs text-neon-red font-semibold">Analysis failed</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">{error}</p>
        </div>
      )}

      {/* Content */}
      {data && expanded && (
        <div className="glass-card p-5 space-y-4">
          {/* Market Snapshot */}
          <div className="grid grid-cols-3 gap-4">
            {data.market.spy && (
              <div className="bg-dark-700/50 rounded-lg p-3">
                <div className="text-[10px] text-gray-500 mb-1">S&P 500 (SPY)</div>
                <div className="text-sm font-bold text-white">${data.market.spy.currentPrice}</div>
                <div className={`text-xs font-semibold ${data.market.spy.periodChange >= 0 ? 'text-neon-green' : 'text-neon-red'}`}>
                  {data.market.spy.periodChange >= 0 ? '+' : ''}{data.market.spy.periodChange}% (5d)
                </div>
              </div>
            )}
            {data.market.qqq && (
              <div className="bg-dark-700/50 rounded-lg p-3">
                <div className="text-[10px] text-gray-500 mb-1">Nasdaq 100 (QQQ)</div>
                <div className="text-sm font-bold text-white">${data.market.qqq.currentPrice}</div>
                <div className={`text-xs font-semibold ${data.market.qqq.periodChange >= 0 ? 'text-neon-green' : 'text-neon-red'}`}>
                  {data.market.qqq.periodChange >= 0 ? '+' : ''}{data.market.qqq.periodChange}% (5d)
                </div>
              </div>
            )}
            {data.market.vix && (
              <div className="bg-dark-700/50 rounded-lg p-3">
                <div className="text-[10px] text-gray-500 mb-1">VIX (Fear Index)</div>
                <div className="text-sm font-bold text-white">{data.market.vix.current}</div>
                <div className={`text-xs font-semibold ${
                  data.market.vix.direction === 'elevated' ? 'text-neon-red' :
                  data.market.vix.direction === 'moderate' ? 'text-neon-yellow' : 'text-neon-green'
                }`}>
                  {data.market.vix.direction}
                </div>
              </div>
            )}
          </div>

          {/* Recent Earnings Quick View */}
          {data.recentEarnings?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-400 mb-2">Recent Earnings (Last 5 Days)</h4>
              <div className="flex flex-wrap gap-1.5">
                {data.recentEarnings.slice(0, 12).map((e, i) => (
                  <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    e.beat ? 'bg-neon-green/10 text-neon-green' : 'bg-neon-red/10 text-neon-red'
                  }`}>
                    {e.ticker} {e.beat ? '↑' : '↓'}{e.surprisePct}%
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ChatGPT Analysis */}
          <div className="border-t border-glass-border pt-4">
            <h4 className="text-xs font-semibold text-neon-blue mb-3 flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5" />
              AI Market Analysis
            </h4>
            <div className="prose prose-invert max-w-none">
              {renderMarkdown(data.analysis)}
            </div>
          </div>
        </div>
      )}

      {/* Collapsed preview */}
      {data && !expanded && (
        <div
          className="glass-card p-3 cursor-pointer hover:border-neon-blue/20 transition-all"
          onClick={() => setExpanded(true)}
        >
          <p className="text-xs text-gray-400 truncate">
            {data.analysis?.split('\n').find(l => l.trim().length > 20)?.replace(/[#*]/g, '').trim() || 'Click to expand analysis...'}
          </p>
        </div>
      )}
    </div>
  );
}
