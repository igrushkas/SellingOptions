import { useState } from 'react';
import { Brain, TrendingUp, TrendingDown, Minus, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, BarChart3, Activity } from 'lucide-react';

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
  const [showAnalysis, setShowAnalysis] = useState(false);
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
    if (change > 1) return { icon: TrendingUp, label: 'Bullish', color: 'text-neon-green', bg: 'bg-neon-green/15', border: 'border-neon-green/30' };
    if (change < -1) return { icon: TrendingDown, label: 'Bearish', color: 'text-neon-red', bg: 'bg-neon-red/15', border: 'border-neon-red/30' };
    return { icon: Minus, label: 'Neutral', color: 'text-neon-yellow', bg: 'bg-neon-yellow/15', border: 'border-neon-yellow/30' };
  };

  const mood = data ? getMarketMood() : null;

  // Calculate beat rate from recent earnings
  const beatRate = data?.recentEarnings?.length > 0
    ? Math.round((data.recentEarnings.filter(e => e.beat).length / data.recentEarnings.length) * 100)
    : null;

  // VIX level interpretation
  const getVixLevel = () => {
    if (!data?.market?.vix) return null;
    const v = data.market.vix.current;
    if (v >= 25) return { label: 'High Fear', color: 'text-neon-red' };
    if (v >= 18) return { label: 'Elevated', color: 'text-neon-yellow' };
    return { label: 'Low / Calm', color: 'text-neon-green' };
  };

  const vixLevel = data ? getVixLevel() : null;

  // 6 KPI boxes for the market report
  const kpiBoxes = data ? [
    {
      label: 'S&P 500',
      ticker: 'SPY',
      value: data.market?.spy ? `$${data.market.spy.currentPrice}` : '—',
      change: data.market?.spy ? data.market.spy.periodChange : null,
      sub: '5-day change',
      icon: BarChart3,
    },
    {
      label: 'Nasdaq 100',
      ticker: 'QQQ',
      value: data.market?.qqq ? `$${data.market.qqq.currentPrice}` : '—',
      change: data.market?.qqq ? data.market.qqq.periodChange : null,
      sub: '5-day change',
      icon: BarChart3,
    },
    {
      label: 'VIX',
      ticker: 'Fear Index',
      value: data.market?.vix ? `${data.market.vix.current}` : '—',
      change: null,
      sub: vixLevel?.label || '—',
      subColor: vixLevel?.color || 'text-gray-400',
      icon: Activity,
    },
    {
      label: 'Market Mood',
      ticker: '5-Day Trend',
      value: mood?.label || '—',
      valueColor: mood?.color || 'text-gray-400',
      change: null,
      sub: mood ? `SPY ${data.market.spy.periodChange >= 0 ? '+' : ''}${data.market.spy.periodChange}%` : '—',
      icon: mood?.icon || Minus,
    },
    {
      label: 'Earnings Beat Rate',
      ticker: 'Last 5 Days',
      value: beatRate != null ? `${beatRate}%` : '—',
      valueColor: beatRate >= 60 ? 'text-neon-green' : beatRate >= 40 ? 'text-neon-yellow' : 'text-neon-red',
      change: null,
      sub: data.recentEarnings ? `${data.recentEarnings.filter(e => e.beat).length}/${data.recentEarnings.length} beat` : '—',
      icon: TrendingUp,
    },
    {
      label: 'Premium Selling',
      ticker: 'Conditions',
      value: mood?.label === 'Bearish' ? 'Cautious' : (data.market?.vix?.current >= 20 ? 'Favorable' : 'Normal'),
      valueColor: data.market?.vix?.current >= 20 ? 'text-neon-green' : data.market?.vix?.current >= 15 ? 'text-neon-yellow' : 'text-gray-300',
      change: null,
      sub: data.market?.vix?.current >= 20 ? 'High VIX = rich premiums' : 'Standard premium levels',
      icon: Brain,
    },
  ] : [];

  return (
    <div className="mb-6">
      {/* Header bar — compact */}
      <div className="flex items-center gap-3 mb-4 px-4 py-2.5 rounded-lg bg-dark-700 border border-glass-border">
        <Brain className="w-4 h-4 text-neon-blue" />
        <h2 className="text-sm font-bold text-white">Daily Market Report</h2>

        {mood && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${mood.bg} ${mood.color} border ${mood.border}`}>
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
              className="px-3 py-1 rounded-lg bg-neon-blue/15 text-neon-blue text-xs font-semibold border border-neon-blue/30 hover:bg-neon-blue/25 transition-all"
            >
              Generate Report
            </button>
          )}
          {data && (
            <button
              onClick={() => fetchSentiment(true)}
              disabled={loading}
              className="p-1.5 rounded-lg hover:bg-dark-600 text-gray-400 hover:text-white transition-all disabled:opacity-50"
              title="Refresh analysis"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
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

      {/* 6 KPI Boxes — always visible when data is loaded */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          {kpiBoxes.map((box) => (
            <div key={box.label} className="glass-card p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">{box.label}</span>
                <box.icon className="w-3.5 h-3.5 text-gray-500" />
              </div>
              <div className={`text-lg font-bold ${box.valueColor || 'text-white'}`}>
                {box.value}
              </div>
              {box.change != null ? (
                <div className={`text-xs font-semibold ${box.change >= 0 ? 'text-neon-green' : 'text-neon-red'}`}>
                  {box.change >= 0 ? '+' : ''}{box.change}%
                  <span className="text-gray-500 font-normal ml-1">{box.sub}</span>
                </div>
              ) : (
                <div className={`text-xs ${box.subColor || 'text-gray-500'}`}>{box.sub}</div>
              )}
              <div className="text-[9px] text-gray-600 mt-0.5">{box.ticker}</div>
            </div>
          ))}
        </div>
      )}

      {/* Recent Earnings Chips — compact row */}
      {data?.recentEarnings?.length > 0 && (
        <div className="flex items-center gap-2 mb-4 px-1">
          <span className="text-[10px] text-gray-500 shrink-0">Recent:</span>
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

      {/* AI Analysis — hidden by default, toggle to show */}
      {data && (
        <div>
          <button
            onClick={() => setShowAnalysis(!showAnalysis)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-dark-700/50 border border-glass-border text-xs text-gray-400 hover:text-white hover:border-neon-blue/20 transition-all w-full"
          >
            <Brain className="w-3.5 h-3.5 text-neon-blue" />
            <span className="font-semibold">AI Market Analysis</span>
            <span className="text-gray-600 ml-1">— ChatGPT deep dive on current conditions</span>
            <span className="ml-auto">
              {showAnalysis ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
          </button>

          {showAnalysis && (
            <div className="glass-card p-5 mt-2 border-l-2 border-l-neon-blue">
              <div className="prose prose-invert max-w-none">
                {renderMarkdown(data.analysis)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
