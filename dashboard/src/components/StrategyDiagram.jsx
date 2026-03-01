/**
 * SVG P&L diagrams for options strategies.
 * Shows the characteristic payoff shape on hover.
 */

// P&L line points for each strategy in a 240x100 viewBox.
// y=15 = max profit, y=50 = breakeven, y=85 = max loss
const ZERO_Y = 50;

const SHAPES = {
  short_strangle: {
    label: 'Short Strangle',
    desc: 'Sell put + sell call. Profit if stock stays between strikes.',
    // Unlimited loss both sides, flat max profit center
    points: [[0, 100], [75, 15], [165, 15], [240, 100]],
  },
  iron_condor: {
    label: 'Iron Condor',
    desc: 'Credit spread both sides. Capped profit and capped loss.',
    // Limited loss both sides (flat), flat max profit center
    points: [[0, 85], [40, 85], [75, 15], [165, 15], [200, 85], [240, 85]],
  },
  wide_iron_condor: {
    label: 'Wide Iron Condor',
    desc: 'Wider strikes, less premium, higher win rate.',
    points: [[0, 80], [30, 80], [70, 20], [170, 20], [210, 80], [240, 80]],
  },
  ultra_wide_condor: {
    label: 'Ultra Wide Condor',
    desc: 'Very wide strikes for maximum safety, minimal premium.',
    points: [[0, 75], [20, 75], [65, 25], [175, 25], [220, 75], [240, 75]],
  },
  naked_call: {
    label: 'Naked Call',
    desc: 'Sell call only. Bearish bias, unlimited upside risk.',
    // Flat profit left, unlimited loss right
    points: [[0, 15], [140, 15], [240, 95]],
  },
  naked_put: {
    label: 'Naked Put',
    desc: 'Sell put only. Bullish bias, large downside risk.',
    // Unlimited loss left, flat profit right
    points: [[0, 95], [100, 15], [240, 15]],
  },
  bear_call_spread: {
    label: 'Bear Call Spread',
    desc: 'Sell lower call, buy higher call. Bearish, capped risk.',
    // Flat profit left, slope down, flat loss right
    points: [[0, 20], [100, 20], [170, 80], [240, 80]],
  },
  bull_put_spread: {
    label: 'Bull Put Spread',
    desc: 'Sell higher put, buy lower put. Bullish, capped risk.',
    // Flat loss left, slope up, flat profit right
    points: [[0, 80], [70, 80], [140, 20], [240, 20]],
  },
  skewed_strangle: {
    label: 'Skewed Strangle',
    desc: 'Asymmetric strangle favoring the dominant direction.',
    // Asymmetric: steeper on weak side, gentler on strong side
    points: [[0, 95], [55, 15], [175, 15], [240, 80]],
  },
  jade_lizard: {
    label: 'Jade Lizard',
    desc: 'Sell put + bear call spread. Upside risk is capped.',
    // Uncapped loss left (naked put), flat profit center, capped loss right
    points: [[0, 95], [70, 15], [155, 15], [195, 70], [240, 70]],
  },
  twisted_sister: {
    label: 'Twisted Sister',
    desc: 'Sell call + bull put spread. Downside risk is capped.',
    // Capped loss left, flat profit center, uncapped loss right
    points: [[0, 70], [45, 70], [85, 15], [170, 15], [240, 95]],
  },
  skip: {
    label: 'Skip / No Trade',
    desc: 'Insufficient edge. Stay out of this one.',
    // Flat at zero — no P&L
    points: [[0, 50], [240, 50]],
  },
};

function buildPath(points) {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
}

// Build a clipped fill area between the P&L line and the zero line
function buildFillAbove(points) {
  // Area above zero line (profit) — clip to y <= ZERO_Y
  const clipped = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    if (y1 <= ZERO_Y) clipped.push([x1, y1]);
    if ((y1 < ZERO_Y && y2 > ZERO_Y) || (y1 > ZERO_Y && y2 < ZERO_Y)) {
      // Crosses zero line — find intersection
      const t = (ZERO_Y - y1) / (y2 - y1);
      const ix = x1 + t * (x2 - x1);
      clipped.push([ix, ZERO_Y]);
    }
  }
  const last = points[points.length - 1];
  if (last[1] <= ZERO_Y) clipped.push(last);

  if (clipped.length < 2) return '';
  // Close the shape along the zero line
  const path = clipped.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  return `${path} L${clipped[clipped.length - 1][0]},${ZERO_Y} L${clipped[0][0]},${ZERO_Y} Z`;
}

function buildFillBelow(points) {
  const clipped = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    if (y1 >= ZERO_Y) clipped.push([x1, y1]);
    if ((y1 < ZERO_Y && y2 > ZERO_Y) || (y1 > ZERO_Y && y2 < ZERO_Y)) {
      const t = (ZERO_Y - y1) / (y2 - y1);
      const ix = x1 + t * (x2 - x1);
      clipped.push([ix, ZERO_Y]);
    }
  }
  const last = points[points.length - 1];
  if (last[1] >= ZERO_Y) clipped.push(last);

  if (clipped.length < 2) return '';
  const path = clipped.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  return `${path} L${clipped[clipped.length - 1][0]},${ZERO_Y} L${clipped[0][0]},${ZERO_Y} Z`;
}

export default function StrategyDiagram({ strategy, showLabel = true }) {
  const config = SHAPES[strategy];
  if (!config || strategy === 'skip') return null;

  const { points, label, desc } = config;
  const profitPath = buildFillAbove(points);
  const lossPath = buildFillBelow(points);
  const linePath = buildPath(points);

  return (
    <div className="w-full">
      {showLabel && (
        <div className="text-xs font-bold text-white mb-1">{label}</div>
      )}
      <svg viewBox="0 0 240 100" className="w-full h-auto" style={{ maxHeight: 80 }}>
        {/* Profit fill (green) */}
        {profitPath && <path d={profitPath} fill="rgba(0,255,136,0.15)" />}
        {/* Loss fill (red) */}
        {lossPath && <path d={lossPath} fill="rgba(255,51,102,0.15)" />}
        {/* Zero line */}
        <line x1="0" y1={ZERO_Y} x2="240" y2={ZERO_Y} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 3" />
        {/* P&L line */}
        <polyline
          points={points.map(p => p.join(',')).join(' ')}
          fill="none"
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Labels */}
        <text x="5" y={ZERO_Y - 4} fill="rgba(0,255,136,0.6)" fontSize="8" fontFamily="sans-serif">Profit</text>
        <text x="5" y={ZERO_Y + 11} fill="rgba(255,51,102,0.6)" fontSize="8" fontFamily="sans-serif">Loss</text>
        <text x="100" y="98" fill="rgba(255,255,255,0.3)" fontSize="7" textAnchor="middle" fontFamily="sans-serif">Stock Price →</text>
      </svg>
      {showLabel && (
        <div className="text-[11px] text-gray-400 mt-0.5">{desc}</div>
      )}
    </div>
  );
}

// Export shape data for external use
export { SHAPES };
