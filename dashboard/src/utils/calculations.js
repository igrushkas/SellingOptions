/**
 * Core calculations for options selling strategy
 * Focused on maximizing probability of profit (POP) on earnings plays
 */

/**
 * Calculate average absolute move from historical earnings data
 */
export function calcAvgMove(historicalMoves) {
  if (!historicalMoves || historicalMoves.length === 0) return 0;
  const absValues = historicalMoves.map(m => Math.abs(m.actual));
  return absValues.reduce((sum, v) => sum + v, 0) / absValues.length;
}

/**
 * Calculate standard deviation of historical moves
 */
export function calcStdDev(historicalMoves) {
  if (!historicalMoves || historicalMoves.length < 2) return 0;
  const absValues = historicalMoves.map(m => Math.abs(m.actual));
  const avg = absValues.reduce((sum, v) => sum + v, 0) / absValues.length;
  const squaredDiffs = absValues.map(v => Math.pow(v - avg, 2));
  return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / (absValues.length - 1));
}

/**
 * Calculate median absolute move
 */
export function calcMedianMove(historicalMoves) {
  if (!historicalMoves || historicalMoves.length === 0) return 0;
  const sorted = historicalMoves.map(m => Math.abs(m.actual)).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculate the max move in the last N quarters
 */
export function calcMaxMove(historicalMoves, lastN = 20) {
  const moves = historicalMoves.slice(0, lastN);
  return Math.max(...moves.map(m => Math.abs(m.actual)));
}

/**
 * IV Crush Ratio - how much implied move exceeds actual historical average
 * > 1.0 means IV is overpriced (good for selling)
 * < 1.0 means IV is underpriced (dangerous for selling)
 */
export function calcIVCrushRatio(impliedMove, historicalMoves) {
  const avgMove = calcAvgMove(historicalMoves);
  if (avgMove === 0) return 0;
  return impliedMove / avgMove;
}

/**
 * Calculate win rate - % of times stock moved LESS than current implied move
 */
export function calcHistoricalWinRate(impliedMove, historicalMoves) {
  if (!historicalMoves || historicalMoves.length === 0) return 0;
  const wins = historicalMoves.filter(m => Math.abs(m.actual) < impliedMove).length;
  return (wins / historicalMoves.length) * 100;
}

/**
 * Calculate safe strike zones for selling naked options
 * Returns recommended strike prices based on historical data
 */
export function calcSafeZone(price, impliedMove, historicalMoves, confidence = 0.85) {
  const avgMove = calcAvgMove(historicalMoves);
  const stdDev = calcStdDev(historicalMoves);
  const maxMove = calcMaxMove(historicalMoves);
  const medianMove = calcMedianMove(historicalMoves);

  // Safe zone = average move + (confidence factor * stdDev)
  // Higher confidence = wider range = safer but less premium
  const confidenceMultiplier = confidence >= 0.90 ? 2.0 : confidence >= 0.85 ? 1.5 : 1.0;
  const safeDistance = avgMove + (confidenceMultiplier * stdDev);

  // Conservative zone uses max historical move
  const conservativeDistance = maxMove * 1.1; // 10% beyond worst case

  const safeHigh = price * (1 + safeDistance / 100);
  const safeLow = price * (1 - safeDistance / 100);

  const conservativeHigh = price * (1 + conservativeDistance / 100);
  const conservativeLow = price * (1 - conservativeDistance / 100);

  // Aggressive zone uses median (tighter range, more premium, higher risk)
  const aggressiveDistance = medianMove * 1.2;
  const aggressiveHigh = price * (1 + aggressiveDistance / 100);
  const aggressiveLow = price * (1 - aggressiveDistance / 100);

  return {
    safe: {
      high: Math.round(safeHigh * 100) / 100,
      low: Math.round(safeLow * 100) / 100,
      distance: Math.round(safeDistance * 100) / 100,
      winRate: calcHistoricalWinRate(safeDistance, historicalMoves),
    },
    conservative: {
      high: Math.round(conservativeHigh * 100) / 100,
      low: Math.round(conservativeLow * 100) / 100,
      distance: Math.round(conservativeDistance * 100) / 100,
      winRate: 95, // Beyond max historical move
    },
    aggressive: {
      high: Math.round(aggressiveHigh * 100) / 100,
      low: Math.round(aggressiveLow * 100) / 100,
      distance: Math.round(aggressiveDistance * 100) / 100,
      winRate: calcHistoricalWinRate(aggressiveDistance, historicalMoves),
    },
  };
}

/**
 * Calculate expected premium for a strike price
 */
export function estimatePremium(price, strike, impliedMove, daysToExpiry = 1) {
  const distance = Math.abs(strike - price) / price * 100;
  const impliedVol = impliedMove / 100;
  // Simplified Black-Scholes approximation for near-term OTM options
  const timeDecay = Math.sqrt(daysToExpiry / 365);
  const premium = price * impliedVol * timeDecay * Math.exp(-0.5 * Math.pow(distance / impliedMove, 2));
  return Math.round(premium * 100) / 100;
}

/**
 * Determine trade signal quality
 * Returns: 'excellent', 'good', 'neutral', 'risky'
 */
export function getTradeSignal(impliedMove, historicalMoves) {
  const crushRatio = calcIVCrushRatio(impliedMove, historicalMoves);
  const winRate = calcHistoricalWinRate(impliedMove, historicalMoves);

  if (crushRatio >= 1.5 && winRate >= 85) return 'excellent';
  if (crushRatio >= 1.2 && winRate >= 75) return 'good';
  if (crushRatio >= 1.0 && winRate >= 60) return 'neutral';
  return 'risky';
}

/**
 * Calculate directional bias from recent earnings
 */
export function calcDirectionalBias(historicalMoves, lookback = 8) {
  const recent = historicalMoves.slice(0, lookback);
  const upMoves = recent.filter(m => m.direction === 'up').length;
  const downMoves = recent.filter(m => m.direction === 'down').length;
  const avgUpSize = recent.filter(m => m.direction === 'up').reduce((s, m) => s + m.actual, 0) / (upMoves || 1);
  const avgDownSize = recent.filter(m => m.direction === 'down').reduce((s, m) => s + Math.abs(m.actual), 0) / (downMoves || 1);

  return {
    bullish: upMoves,
    bearish: downMoves,
    bias: upMoves > downMoves ? 'bullish' : upMoves < downMoves ? 'bearish' : 'neutral',
    avgUpSize: Math.round(avgUpSize * 100) / 100,
    avgDownSize: Math.round(avgDownSize * 100) / 100,
  };
}

/**
 * Generate prediction for next earnings move
 */
export function predictNextMove(historicalMoves, impliedMove) {
  const avg = calcAvgMove(historicalMoves);
  const median = calcMedianMove(historicalMoves);
  const stdDev = calcStdDev(historicalMoves);
  const bias = calcDirectionalBias(historicalMoves);
  const crushRatio = calcIVCrushRatio(impliedMove, historicalMoves);
  const winRate = calcHistoricalWinRate(impliedMove, historicalMoves);

  // Weighted prediction: give more weight to recent quarters
  const weights = historicalMoves.slice(0, 8).map((_, i) => Math.pow(0.85, i));
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  const weightedAvg = historicalMoves.slice(0, 8).reduce((s, m, i) => s + Math.abs(m.actual) * weights[i], 0) / totalWeight;

  return {
    predictedRange: Math.round(weightedAvg * 100) / 100,
    avgMove: Math.round(avg * 100) / 100,
    medianMove: Math.round(median * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100,
    impliedMove,
    crushRatio: Math.round(crushRatio * 100) / 100,
    winRate: Math.round(winRate * 10) / 10,
    bias: bias.bias,
    signal: getTradeSignal(impliedMove, historicalMoves),
  };
}

/**
 * Format currency
 */
export function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
}

/**
 * Format percentage
 */
export function formatPercent(value, decimals = 1) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

/**
 * News sentiment score
 * Returns -1 to 1
 */
export function calcNewsSentiment(news) {
  if (!news || news.length === 0) return 0;
  const scores = news.map(n => n.sentiment === 'positive' ? 1 : n.sentiment === 'negative' ? -1 : 0);
  return scores.reduce((s, v) => s + v, 0) / scores.length;
}
