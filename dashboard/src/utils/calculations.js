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

/**
 * Strategy Recommendation Engine
 *
 * Analyzes historical moves, IV crush, directional bias, and move consistency
 * to recommend the optimal options strategy for each earnings play.
 *
 * Professional firms use these rules:
 * - Sell both sides (strangle/condor) only when direction is unpredictable
 * - Sell one leg when stock has strong directional bias after earnings
 * - Use defined-risk (spreads/condors) when win rate < 80% or crush < 1.3
 * - Skip entirely when IV is underpriced (crush < 0.9) or win rate < 55%
 */
export function getStrategyRecommendation(stock) {
  const { historicalMoves, impliedMove, price } = stock;
  if (!historicalMoves || historicalMoves.length < 4 || !impliedMove) {
    return {
      strategy: 'skip',
      strategyName: 'Skip — Insufficient Data',
      legs: [],
      reason: 'Not enough historical data to make a reliable recommendation.',
      confidence: 0,
      riskLevel: 'unknown',
    };
  }

  const crushRatio = calcIVCrushRatio(impliedMove, historicalMoves);
  const winRate = calcHistoricalWinRate(impliedMove, historicalMoves);
  const bias = calcDirectionalBias(historicalMoves, 8);
  const avgMove = calcAvgMove(historicalMoves);
  const maxMove = calcMaxMove(historicalMoves);
  const stdDev = calcStdDev(historicalMoves);
  const zones = calcSafeZone(price, impliedMove, historicalMoves);

  // Directional analysis (last 8 quarters)
  const recent = historicalMoves.slice(0, Math.min(8, historicalMoves.length));
  const downMoves = recent.filter(m => m.direction === 'down');
  const upMoves = recent.filter(m => m.direction === 'up');
  const downPct = downMoves.length / recent.length;
  const upPct = upMoves.length / recent.length;

  // Magnitude analysis
  const avgDownMag = downMoves.length > 0
    ? downMoves.reduce((s, m) => s + Math.abs(m.actual), 0) / downMoves.length : 0;
  const avgUpMag = upMoves.length > 0
    ? upMoves.reduce((s, m) => s + Math.abs(m.actual), 0) / upMoves.length : 0;

  // Consistency: low stdDev relative to avgMove = predictable
  const consistency = avgMove > 0 ? 1 - (stdDev / avgMove) : 0;

  // Move severity: how bad can it get?
  const moveSeverity = maxMove / (impliedMove || 1);

  // === SKIP CONDITIONS ===
  if (crushRatio < 0.85 && winRate < 55) {
    return {
      strategy: 'skip',
      strategyName: 'Skip — Too Risky',
      legs: [],
      reason: `IV crush ratio (${crushRatio.toFixed(2)}x) is too low and win rate (${winRate.toFixed(0)}%) is below threshold. The stock often moves MORE than implied — selling premium here is unprofitable.`,
      confidence: 0,
      riskLevel: 'extreme',
      crushRatio, winRate, bias: bias.bias, downPct, upPct,
    };
  }

  // === STRONG BEARISH BIAS (>=75% down moves) ===
  if (downPct >= 0.75) {
    const callStrike = zones.safe.high;
    if (crushRatio >= 1.3 && winRate >= 70) {
      return {
        strategy: 'naked_call',
        strategyName: 'Sell Naked Call',
        legs: [
          { type: 'Sell Call', strike: callStrike, zone: 'safe' },
        ],
        reason: `Stock drops ${(downPct * 100).toFixed(0)}% of the time after earnings (avg -${avgDownMag.toFixed(1)}%). Strong IV crush (${crushRatio.toFixed(2)}x) supports selling calls only. Skip the put side — the stock is a consistent decliner.`,
        confidence: Math.min(95, Math.round(winRate * 0.9 + crushRatio * 10)),
        riskLevel: 'moderate',
        crushRatio, winRate, bias: 'bearish', downPct, upPct, avgDownMag, avgUpMag,
      };
    }
    return {
      strategy: 'bear_call_spread',
      strategyName: 'Bear Call Spread',
      legs: [
        { type: 'Sell Call', strike: callStrike, zone: 'safe' },
        { type: 'Buy Call', strike: Math.round((callStrike * 1.03) * 100) / 100, zone: 'protection' },
      ],
      reason: `Stock drops ${(downPct * 100).toFixed(0)}% of the time after earnings. Use a call credit spread for defined risk. Avoid selling puts — this stock gets hammered.`,
      confidence: Math.min(90, Math.round(winRate * 0.85 + crushRatio * 8)),
      riskLevel: 'low',
      crushRatio, winRate, bias: 'bearish', downPct, upPct, avgDownMag, avgUpMag,
    };
  }

  // === STRONG BULLISH BIAS (>=75% up moves) ===
  if (upPct >= 0.75) {
    const putStrike = zones.safe.low;
    if (crushRatio >= 1.3 && winRate >= 70) {
      return {
        strategy: 'naked_put',
        strategyName: 'Sell Naked Put',
        legs: [
          { type: 'Sell Put', strike: putStrike, zone: 'safe' },
        ],
        reason: `Stock rises ${(upPct * 100).toFixed(0)}% of the time after earnings (avg +${avgUpMag.toFixed(1)}%). Strong IV crush (${crushRatio.toFixed(2)}x) supports selling puts only. The stock is a consistent riser after earnings.`,
        confidence: Math.min(95, Math.round(winRate * 0.9 + crushRatio * 10)),
        riskLevel: 'moderate',
        crushRatio, winRate, bias: 'bullish', downPct, upPct, avgDownMag, avgUpMag,
      };
    }
    return {
      strategy: 'bull_put_spread',
      strategyName: 'Bull Put Spread',
      legs: [
        { type: 'Sell Put', strike: putStrike, zone: 'safe' },
        { type: 'Buy Put', strike: Math.round((putStrike * 0.97) * 100) / 100, zone: 'protection' },
      ],
      reason: `Stock rises ${(upPct * 100).toFixed(0)}% of the time after earnings. Use a put credit spread for defined risk. Avoid selling calls — the stock tends to rally.`,
      confidence: Math.min(90, Math.round(winRate * 0.85 + crushRatio * 8)),
      riskLevel: 'low',
      crushRatio, winRate, bias: 'bullish', downPct, upPct, avgDownMag, avgUpMag,
    };
  }

  // === MODERATE BEARISH (60-74% down) ===
  if (downPct >= 0.6) {
    if (crushRatio >= 1.3) {
      // Skewed strangle: closer call, wider put
      return {
        strategy: 'skewed_strangle',
        strategyName: 'Skewed Strangle (Bearish Tilt)',
        legs: [
          { type: 'Sell Call', strike: zones.aggressive.high, zone: 'aggressive' },
          { type: 'Sell Put', strike: zones.conservative.low, zone: 'conservative' },
        ],
        reason: `Stock drops ${(downPct * 100).toFixed(0)}% of the time, but not consistently enough for one leg only. Sell a tighter call (aggressive zone) and wider put (conservative zone) to capture the bearish lean.`,
        confidence: Math.min(85, Math.round(winRate * 0.8 + crushRatio * 8)),
        riskLevel: 'moderate',
        crushRatio, winRate, bias: 'bearish', downPct, upPct, avgDownMag, avgUpMag,
      };
    }
    return {
      strategy: 'bear_call_spread',
      strategyName: 'Bear Call Spread',
      legs: [
        { type: 'Sell Call', strike: zones.safe.high, zone: 'safe' },
        { type: 'Buy Call', strike: Math.round((zones.safe.high * 1.03) * 100) / 100, zone: 'protection' },
      ],
      reason: `Moderate bearish pattern (${(downPct * 100).toFixed(0)}% down) with modest IV crush. Defined-risk call spread is the safest play.`,
      confidence: Math.min(80, Math.round(winRate * 0.75 + crushRatio * 6)),
      riskLevel: 'low',
      crushRatio, winRate, bias: 'bearish', downPct, upPct, avgDownMag, avgUpMag,
    };
  }

  // === MODERATE BULLISH (60-74% up) ===
  if (upPct >= 0.6) {
    if (crushRatio >= 1.3) {
      return {
        strategy: 'skewed_strangle',
        strategyName: 'Skewed Strangle (Bullish Tilt)',
        legs: [
          { type: 'Sell Put', strike: zones.aggressive.low, zone: 'aggressive' },
          { type: 'Sell Call', strike: zones.conservative.high, zone: 'conservative' },
        ],
        reason: `Stock rises ${(upPct * 100).toFixed(0)}% of the time. Sell a tighter put (aggressive zone) and wider call (conservative zone) to capture the bullish lean.`,
        confidence: Math.min(85, Math.round(winRate * 0.8 + crushRatio * 8)),
        riskLevel: 'moderate',
        crushRatio, winRate, bias: 'bullish', downPct, upPct, avgDownMag, avgUpMag,
      };
    }
    return {
      strategy: 'bull_put_spread',
      strategyName: 'Bull Put Spread',
      legs: [
        { type: 'Sell Put', strike: zones.safe.low, zone: 'safe' },
        { type: 'Buy Put', strike: Math.round((zones.safe.low * 0.97) * 100) / 100, zone: 'protection' },
      ],
      reason: `Moderate bullish pattern (${(upPct * 100).toFixed(0)}% up) with modest IV crush. Defined-risk put spread is the safest play.`,
      confidence: Math.min(80, Math.round(winRate * 0.75 + crushRatio * 6)),
      riskLevel: 'low',
      crushRatio, winRate, bias: 'bullish', downPct, upPct, avgDownMag, avgUpMag,
    };
  }

  // === NEUTRAL DIRECTION — sell both sides ===

  // Excellent setup: Short Strangle (undefined risk, max premium)
  if (crushRatio >= 1.5 && winRate >= 85 && consistency > 0.3) {
    return {
      strategy: 'short_strangle',
      strategyName: 'Short Strangle',
      legs: [
        { type: 'Sell Call', strike: zones.safe.high, zone: 'safe' },
        { type: 'Sell Put', strike: zones.safe.low, zone: 'safe' },
      ],
      reason: `Excellent IV crush (${crushRatio.toFixed(2)}x) with ${winRate.toFixed(0)}% win rate. IV is massively overpriced vs historical moves. Sell both sides for maximum premium collection.`,
      confidence: Math.min(95, Math.round(winRate * 0.9 + crushRatio * 8)),
      riskLevel: 'moderate',
      crushRatio, winRate, bias: 'neutral', downPct, upPct, avgDownMag, avgUpMag,
    };
  }

  // Good setup: Iron Condor (defined risk)
  if (crushRatio >= 1.2 && winRate >= 70) {
    return {
      strategy: 'iron_condor',
      strategyName: 'Iron Condor',
      legs: [
        { type: 'Sell Call', strike: zones.safe.high, zone: 'safe' },
        { type: 'Buy Call', strike: Math.round((zones.safe.high * 1.03) * 100) / 100, zone: 'protection' },
        { type: 'Sell Put', strike: zones.safe.low, zone: 'safe' },
        { type: 'Buy Put', strike: Math.round((zones.safe.low * 0.97) * 100) / 100, zone: 'protection' },
      ],
      reason: `Good IV crush (${crushRatio.toFixed(2)}x) with ${winRate.toFixed(0)}% win rate. Iron condor gives you defined risk on both sides. Buy wings 3% beyond your short strikes for protection.`,
      confidence: Math.min(90, Math.round(winRate * 0.85 + crushRatio * 7)),
      riskLevel: 'low',
      crushRatio, winRate, bias: 'neutral', downPct, upPct, avgDownMag, avgUpMag,
    };
  }

  // Fair setup: Wide Iron Condor
  if (crushRatio >= 1.0 && winRate >= 60) {
    return {
      strategy: 'wide_iron_condor',
      strategyName: 'Wide Iron Condor',
      legs: [
        { type: 'Sell Call', strike: zones.conservative.high, zone: 'conservative' },
        { type: 'Buy Call', strike: Math.round((zones.conservative.high * 1.03) * 100) / 100, zone: 'protection' },
        { type: 'Sell Put', strike: zones.conservative.low, zone: 'conservative' },
        { type: 'Buy Put', strike: Math.round((zones.conservative.low * 0.97) * 100) / 100, zone: 'protection' },
      ],
      reason: `Marginal setup — IV crush (${crushRatio.toFixed(2)}x) is modest. Use conservative (wide) strikes and defined risk. Less premium but higher win rate.`,
      confidence: Math.min(75, Math.round(winRate * 0.7 + crushRatio * 5)),
      riskLevel: 'low',
      crushRatio, winRate, bias: 'neutral', downPct, upPct, avgDownMag, avgUpMag,
    };
  }

  // Everything else: Skip
  return {
    strategy: 'skip',
    strategyName: 'Skip — Unfavorable Setup',
    legs: [],
    reason: `IV crush ratio (${crushRatio.toFixed(2)}x) and win rate (${winRate.toFixed(0)}%) are below profitable thresholds. The risk/reward is not in your favor. Wait for a better setup.`,
    confidence: 0,
    riskLevel: 'high',
    crushRatio, winRate, bias: bias.bias, downPct, upPct, avgDownMag, avgUpMag,
  };
}
