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
 * Strategy Recommendation Engine (v2)
 *
 * Based on research from Predicting Alpha, Tastytrade, ORATS, Option Alpha,
 * and professional options desk approaches. Key principles:
 *
 * Gate 1: Should I trade? (tail risk, IV crush, win rate checks)
 * Gate 2: One leg or two? (directional bias from last 8 quarters)
 * Gate 3: Defined or undefined risk? (consistency, price, crush strength)
 * Gate 4: Which specific strategy? (full matrix)
 *
 * Advanced strategies: Jade Lizard, Twisted Sister for moderate bias + very high IV
 * Position sizing: 1-5% of account based on signal quality (Kelly Criterion)
 * Exit rules: 50% profit target, 2x credit stop loss (per Tastytrade research)
 */
export function getStrategyRecommendation(stock) {
  const { historicalMoves, impliedMove, price } = stock;
  if (!historicalMoves || historicalMoves.length < 2 || !impliedMove) {
    return {
      strategy: 'skip',
      strategyName: 'Skip — Insufficient Data',
      legs: [],
      reason: !historicalMoves || historicalMoves.length < 2
        ? `Only ${historicalMoves?.length || 0} quarter(s) of earnings history available. Need at least 2 for a recommendation.`
        : 'No implied move data available from options pricing.',
      confidence: 0,
      riskLevel: 'unknown',
      sizing: null, exitRules: null,
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

  // Move severity: how bad can it get? (tail risk check)
  const moveSeverity = maxMove / (impliedMove || 1);

  // High price forces defined risk (iron condor/spreads over naked)
  const forceDefinedRisk = price > 200 || consistency < 0.3;

  // Shared fields for all results
  const shared = { crushRatio, winRate, downPct, upPct, avgDownMag, avgUpMag };

  // Helper: position sizing based on Kelly Criterion (quarter Kelly)
  const calcSizing = (signal) => {
    // Kelly % = W - [(1-W)/R], where R = avg win / avg loss, assume R ~ crushRatio
    const w = winRate / 100;
    const r = Math.max(crushRatio, 0.5);
    const fullKelly = Math.max(0, w - (1 - w) / r);
    const quarterKelly = fullKelly * 0.25;

    const pctMap = { excellent: 5, good: 3.5, fair: 2, marginal: 1 };
    const maxPct = pctMap[signal] || 2;
    return {
      accountPct: Math.min(maxPct, Math.round(quarterKelly * 100 * 10) / 10),
      signal,
      kellyFull: Math.round(fullKelly * 100),
    };
  };

  // Helper: exit rules
  const exitRules = {
    profitTarget: '50% of max credit',
    stopLoss: '2x credit received',
    timeExit: 'Close by 10:00 AM ET morning after earnings',
    management: 'If realized move < implied: let IV crush play out, close for profit. If realized ~ implied: close at open. If realized >> implied: close immediately.',
  };

  // === GATE 1: SKIP CONDITIONS (only skip the truly hopeless) ===

  // Tail risk: max move > 2.5x implied AND low win rate (rare outliers with high WR are OK)
  if (moveSeverity > 2.5 && winRate < 65) {
    return {
      strategy: 'skip',
      strategyName: 'Skip — Extreme Tail Risk',
      legs: [],
      reason: `Max historical move (${maxMove.toFixed(1)}%) is ${moveSeverity.toFixed(1)}x the current implied move (${impliedMove}%) and win rate is only ${winRate.toFixed(0)}%. This stock has a history of extreme earnings reactions. Too dangerous.`,
      confidence: 0,
      riskLevel: 'extreme',
      bias: bias.bias, ...shared,
      sizing: null, exitRules: null,
    };
  }

  // Only skip when BOTH IV crush is terrible AND win rate is terrible
  if (crushRatio < 0.8 && winRate < 50) {
    return {
      strategy: 'skip',
      strategyName: 'Skip — IV Underpriced',
      legs: [],
      reason: `IV crush ratio (${crushRatio.toFixed(2)}x) is very low and win rate (${winRate.toFixed(0)}%) is below 50%. The stock regularly moves MORE than implied — selling premium here is a losing proposition.`,
      confidence: 0,
      riskLevel: 'extreme',
      bias: bias.bias, ...shared,
      sizing: null, exitRules: null,
    };
  }

  // === GATE 2+3+4: STRATEGY SELECTION ===

  // === STRONG BEARISH BIAS (>=75% down moves) ===
  if (downPct >= 0.75) {
    const callStrike = zones.safe.high;
    const wingStrike = Math.round((callStrike * 1.03) * 100) / 100;

    // Twisted Sister: naked call + bull put spread (zero downside risk)
    if (crushRatio >= 1.5 && winRate >= 80 && !forceDefinedRisk) {
      return {
        strategy: 'twisted_sister',
        strategyName: 'Twisted Sister',
        legs: [
          { type: 'Sell', qty: 1, instrument: 'Call', strike: callStrike, zone: 'safe' },
          { type: 'Sell', qty: 1, instrument: 'Put', strike: zones.safe.low, zone: 'safe' },
          { type: 'Buy', qty: 1, instrument: 'Put', strike: Math.round((zones.safe.low * 0.97) * 100) / 100, zone: 'protection' },
        ],
        reason: `Stock drops ${(downPct * 100).toFixed(0)}% of the time (avg -${avgDownMag.toFixed(1)}%). Very high IV crush (${crushRatio.toFixed(2)}x). Twisted Sister = naked call + bull put spread. If total credit > put spread width, you have ZERO downside risk. Collect premium on both sides with protection below.`,
        confidence: Math.min(95, Math.round(winRate * 0.9 + crushRatio * 8)),
        riskLevel: 'moderate',
        bias: 'bearish', ...shared,
        sizing: calcSizing('excellent'), exitRules,
      };
    }

    // Naked call (high crush, manageable price)
    if (crushRatio >= 1.3 && winRate >= 70 && !forceDefinedRisk) {
      return {
        strategy: 'naked_call',
        strategyName: 'Sell Naked Call',
        legs: [
          { type: 'Sell', qty: 1, instrument: 'Call', strike: callStrike, zone: 'safe' },
        ],
        reason: `Stock drops ${(downPct * 100).toFixed(0)}% of the time after earnings (avg -${avgDownMag.toFixed(1)}%). Strong IV crush (${crushRatio.toFixed(2)}x). Sell calls only — skip the put side, this stock gets hammered after earnings.`,
        confidence: Math.min(95, Math.round(winRate * 0.9 + crushRatio * 10)),
        riskLevel: 'moderate',
        bias: 'bearish', ...shared,
        sizing: calcSizing('good'), exitRules,
      };
    }

    // Bear call spread (defined risk)
    return {
      strategy: 'bear_call_spread',
      strategyName: 'Bear Call Spread',
      legs: [
        { type: 'Sell', qty: 1, instrument: 'Call', strike: callStrike, zone: 'safe' },
        { type: 'Buy', qty: 1, instrument: 'Call', strike: wingStrike, zone: 'protection' },
      ],
      reason: `Stock drops ${(downPct * 100).toFixed(0)}% of the time after earnings. ${forceDefinedRisk && price > 200 ? `Stock is priced at $${price.toFixed(0)} — defined risk required. ` : ''}Call credit spread for defined risk. Avoid selling puts — this stock gets hammered.`,
      confidence: Math.min(90, Math.round(winRate * 0.85 + crushRatio * 8)),
      riskLevel: 'low',
      bias: 'bearish', ...shared,
      sizing: calcSizing('good'), exitRules,
    };
  }

  // === STRONG BULLISH BIAS (>=75% up moves) ===
  if (upPct >= 0.75) {
    const putStrike = zones.safe.low;
    const wingStrike = Math.round((putStrike * 0.97) * 100) / 100;

    // Jade Lizard: naked put + bear call spread (zero upside risk)
    if (crushRatio >= 1.5 && winRate >= 80 && !forceDefinedRisk) {
      return {
        strategy: 'jade_lizard',
        strategyName: 'Jade Lizard',
        legs: [
          { type: 'Sell', qty: 1, instrument: 'Put', strike: putStrike, zone: 'safe' },
          { type: 'Sell', qty: 1, instrument: 'Call', strike: zones.safe.high, zone: 'safe' },
          { type: 'Buy', qty: 1, instrument: 'Call', strike: Math.round((zones.safe.high * 1.03) * 100) / 100, zone: 'protection' },
        ],
        reason: `Stock rises ${(upPct * 100).toFixed(0)}% of the time (avg +${avgUpMag.toFixed(1)}%). Very high IV crush (${crushRatio.toFixed(2)}x). Jade Lizard = naked put + bear call spread. If total credit > call spread width, you have ZERO upside risk. Collect premium on both sides with protection above.`,
        confidence: Math.min(95, Math.round(winRate * 0.9 + crushRatio * 8)),
        riskLevel: 'moderate',
        bias: 'bullish', ...shared,
        sizing: calcSizing('excellent'), exitRules,
      };
    }

    // Naked put
    if (crushRatio >= 1.3 && winRate >= 70 && !forceDefinedRisk) {
      return {
        strategy: 'naked_put',
        strategyName: 'Sell Naked Put',
        legs: [
          { type: 'Sell', qty: 1, instrument: 'Put', strike: putStrike, zone: 'safe' },
        ],
        reason: `Stock rises ${(upPct * 100).toFixed(0)}% of the time after earnings (avg +${avgUpMag.toFixed(1)}%). Strong IV crush (${crushRatio.toFixed(2)}x). Sell puts only — the stock is a consistent riser after earnings.`,
        confidence: Math.min(95, Math.round(winRate * 0.9 + crushRatio * 10)),
        riskLevel: 'moderate',
        bias: 'bullish', ...shared,
        sizing: calcSizing('good'), exitRules,
      };
    }

    // Bull put spread (defined risk)
    return {
      strategy: 'bull_put_spread',
      strategyName: 'Bull Put Spread',
      legs: [
        { type: 'Sell', qty: 1, instrument: 'Put', strike: putStrike, zone: 'safe' },
        { type: 'Buy', qty: 1, instrument: 'Put', strike: wingStrike, zone: 'protection' },
      ],
      reason: `Stock rises ${(upPct * 100).toFixed(0)}% of the time after earnings. ${forceDefinedRisk && price > 200 ? `Stock is priced at $${price.toFixed(0)} — defined risk required. ` : ''}Put credit spread for defined risk. Avoid selling calls — the stock tends to rally.`,
      confidence: Math.min(90, Math.round(winRate * 0.85 + crushRatio * 8)),
      riskLevel: 'low',
      bias: 'bullish', ...shared,
      sizing: calcSizing('good'), exitRules,
    };
  }

  // === MODERATE BEARISH (60-74% down) ===
  if (downPct >= 0.6) {
    // Twisted Sister for very high IV + moderate bearish
    if (crushRatio >= 1.5 && winRate >= 80 && !forceDefinedRisk) {
      return {
        strategy: 'twisted_sister',
        strategyName: 'Twisted Sister',
        legs: [
          { type: 'Sell', qty: 1, instrument: 'Call', strike: zones.safe.high, zone: 'safe' },
          { type: 'Sell', qty: 1, instrument: 'Put', strike: zones.conservative.low, zone: 'conservative' },
          { type: 'Buy', qty: 1, instrument: 'Put', strike: Math.round((zones.conservative.low * 0.97) * 100) / 100, zone: 'protection' },
        ],
        reason: `Stock drops ${(downPct * 100).toFixed(0)}% of the time with very high IV crush (${crushRatio.toFixed(2)}x). Twisted Sister: naked call (bearish lean) + protective put spread. If credit > put spread width, zero downside risk.`,
        confidence: Math.min(90, Math.round(winRate * 0.85 + crushRatio * 8)),
        riskLevel: 'moderate',
        bias: 'bearish', ...shared,
        sizing: calcSizing('good'), exitRules,
      };
    }

    // Skewed strangle: closer call, wider put
    if (crushRatio >= 1.3 && !forceDefinedRisk) {
      return {
        strategy: 'skewed_strangle',
        strategyName: 'Skewed Strangle (Bearish Tilt)',
        legs: [
          { type: 'Sell', qty: 1, instrument: 'Call', strike: zones.aggressive.high, zone: 'aggressive' },
          { type: 'Sell', qty: 1, instrument: 'Put', strike: zones.conservative.low, zone: 'conservative' },
        ],
        reason: `Stock drops ${(downPct * 100).toFixed(0)}% of the time, but not consistently enough for one leg only. Sell a tighter call (aggressive zone) and wider put (conservative zone) to capture the bearish lean.`,
        confidence: Math.min(85, Math.round(winRate * 0.8 + crushRatio * 8)),
        riskLevel: 'moderate',
        bias: 'bearish', ...shared,
        sizing: calcSizing('fair'), exitRules,
      };
    }

    return {
      strategy: 'bear_call_spread',
      strategyName: 'Bear Call Spread',
      legs: [
        { type: 'Sell', qty: 1, instrument: 'Call', strike: zones.safe.high, zone: 'safe' },
        { type: 'Buy', qty: 1, instrument: 'Call', strike: Math.round((zones.safe.high * 1.03) * 100) / 100, zone: 'protection' },
      ],
      reason: `Moderate bearish pattern (${(downPct * 100).toFixed(0)}% down) with ${crushRatio < 1.3 ? 'modest' : 'good'} IV crush. Defined-risk call spread is the safest play.`,
      confidence: Math.min(80, Math.round(winRate * 0.75 + crushRatio * 6)),
      riskLevel: 'low',
      bias: 'bearish', ...shared,
      sizing: calcSizing('fair'), exitRules,
    };
  }

  // === MODERATE BULLISH (60-74% up) ===
  if (upPct >= 0.6) {
    // Jade Lizard for very high IV + moderate bullish
    if (crushRatio >= 1.5 && winRate >= 80 && !forceDefinedRisk) {
      return {
        strategy: 'jade_lizard',
        strategyName: 'Jade Lizard',
        legs: [
          { type: 'Sell', qty: 1, instrument: 'Put', strike: zones.safe.low, zone: 'safe' },
          { type: 'Sell', qty: 1, instrument: 'Call', strike: zones.conservative.high, zone: 'conservative' },
          { type: 'Buy', qty: 1, instrument: 'Call', strike: Math.round((zones.conservative.high * 1.03) * 100) / 100, zone: 'protection' },
        ],
        reason: `Stock rises ${(upPct * 100).toFixed(0)}% of the time with very high IV crush (${crushRatio.toFixed(2)}x). Jade Lizard: naked put (bullish lean) + protective call spread. If credit > call spread width, zero upside risk.`,
        confidence: Math.min(90, Math.round(winRate * 0.85 + crushRatio * 8)),
        riskLevel: 'moderate',
        bias: 'bullish', ...shared,
        sizing: calcSizing('good'), exitRules,
      };
    }

    // Skewed strangle
    if (crushRatio >= 1.3 && !forceDefinedRisk) {
      return {
        strategy: 'skewed_strangle',
        strategyName: 'Skewed Strangle (Bullish Tilt)',
        legs: [
          { type: 'Sell', qty: 1, instrument: 'Put', strike: zones.aggressive.low, zone: 'aggressive' },
          { type: 'Sell', qty: 1, instrument: 'Call', strike: zones.conservative.high, zone: 'conservative' },
        ],
        reason: `Stock rises ${(upPct * 100).toFixed(0)}% of the time. Sell a tighter put (aggressive zone) and wider call (conservative zone) to capture the bullish lean.`,
        confidence: Math.min(85, Math.round(winRate * 0.8 + crushRatio * 8)),
        riskLevel: 'moderate',
        bias: 'bullish', ...shared,
        sizing: calcSizing('fair'), exitRules,
      };
    }

    return {
      strategy: 'bull_put_spread',
      strategyName: 'Bull Put Spread',
      legs: [
        { type: 'Sell', qty: 1, instrument: 'Put', strike: zones.safe.low, zone: 'safe' },
        { type: 'Buy', qty: 1, instrument: 'Put', strike: Math.round((zones.safe.low * 0.97) * 100) / 100, zone: 'protection' },
      ],
      reason: `Moderate bullish pattern (${(upPct * 100).toFixed(0)}% up) with ${crushRatio < 1.3 ? 'modest' : 'good'} IV crush. Defined-risk put spread is the safest play.`,
      confidence: Math.min(80, Math.round(winRate * 0.75 + crushRatio * 6)),
      riskLevel: 'low',
      bias: 'bullish', ...shared,
      sizing: calcSizing('fair'), exitRules,
    };
  }

  // === NEUTRAL DIRECTION — sell both sides ===

  // Excellent setup: Short Strangle (max premium, undefined risk)
  if (crushRatio >= 1.5 && winRate >= 85 && consistency > 0.3 && !forceDefinedRisk) {
    return {
      strategy: 'short_strangle',
      strategyName: 'Short Strangle',
      legs: [
        { type: 'Sell', qty: 1, instrument: 'Call', strike: zones.safe.high, zone: 'safe' },
        { type: 'Sell', qty: 1, instrument: 'Put', strike: zones.safe.low, zone: 'safe' },
      ],
      reason: `Excellent IV crush (${crushRatio.toFixed(2)}x) with ${winRate.toFixed(0)}% win rate. IV is massively overpriced vs historical moves. Sell both sides at 16-delta for maximum premium. Expected win rate with management: 79-84%.`,
      confidence: Math.min(95, Math.round(winRate * 0.9 + crushRatio * 8)),
      riskLevel: 'moderate',
      bias: 'neutral', ...shared,
      sizing: calcSizing('excellent'), exitRules,
    };
  }

  // Good setup: Iron Condor (defined risk)
  if (crushRatio >= 1.2 && winRate >= 70) {
    return {
      strategy: 'iron_condor',
      strategyName: 'Iron Condor',
      legs: [
        { type: 'Sell', qty: 1, instrument: 'Call', strike: zones.safe.high, zone: 'safe' },
        { type: 'Buy', qty: 1, instrument: 'Call', strike: Math.round((zones.safe.high * 1.03) * 100) / 100, zone: 'protection' },
        { type: 'Sell', qty: 1, instrument: 'Put', strike: zones.safe.low, zone: 'safe' },
        { type: 'Buy', qty: 1, instrument: 'Put', strike: Math.round((zones.safe.low * 0.97) * 100) / 100, zone: 'protection' },
      ],
      reason: `Good IV crush (${crushRatio.toFixed(2)}x) with ${winRate.toFixed(0)}% win rate. ${forceDefinedRisk ? (price > 200 ? `$${price.toFixed(0)} stock — iron condor for capital efficiency. ` : 'Inconsistent moves — defined risk required. ') : ''}Buy wings 3% beyond short strikes for protection. Expected win rate: 70-78%.`,
      confidence: Math.min(90, Math.round(winRate * 0.85 + crushRatio * 7)),
      riskLevel: 'low',
      bias: 'neutral', ...shared,
      sizing: calcSizing('good'), exitRules,
    };
  }

  // Fair setup: Wide Iron Condor
  if (crushRatio >= 1.0 && winRate >= 55) {
    return {
      strategy: 'wide_iron_condor',
      strategyName: 'Wide Iron Condor',
      legs: [
        { type: 'Sell', qty: 1, instrument: 'Call', strike: zones.conservative.high, zone: 'conservative' },
        { type: 'Buy', qty: 1, instrument: 'Call', strike: Math.round((zones.conservative.high * 1.03) * 100) / 100, zone: 'protection' },
        { type: 'Sell', qty: 1, instrument: 'Put', strike: zones.conservative.low, zone: 'conservative' },
        { type: 'Buy', qty: 1, instrument: 'Put', strike: Math.round((zones.conservative.low * 0.97) * 100) / 100, zone: 'protection' },
      ],
      reason: `Modest setup — IV crush (${crushRatio.toFixed(2)}x). Use conservative (wide) strikes beyond max historical move. Less premium but higher win rate. Close at 50% profit.`,
      confidence: Math.min(75, Math.round(winRate * 0.7 + crushRatio * 5)),
      riskLevel: 'low',
      bias: 'neutral', ...shared,
      sizing: calcSizing('marginal'), exitRules,
    };
  }

  // Marginal setup: Ultra-Wide Iron Condor (still tradeable, just be very conservative)
  if (winRate >= 45 || crushRatio >= 0.8) {
    // Even marginal stocks can be played with ultra-wide strikes
    const ultraWideHigh = Math.round((price * (1 + maxMove * 1.2 / 100)) * 100) / 100;
    const ultraWideLow = Math.round((price * (1 - maxMove * 1.2 / 100)) * 100) / 100;
    return {
      strategy: 'ultra_wide_condor',
      strategyName: 'Ultra-Wide Iron Condor',
      legs: [
        { type: 'Sell', qty: 1, instrument: 'Call', strike: ultraWideHigh, zone: 'beyond-max' },
        { type: 'Buy', qty: 1, instrument: 'Call', strike: Math.round((ultraWideHigh * 1.03) * 100) / 100, zone: 'protection' },
        { type: 'Sell', qty: 1, instrument: 'Put', strike: ultraWideLow, zone: 'beyond-max' },
        { type: 'Buy', qty: 1, instrument: 'Put', strike: Math.round((ultraWideLow * 0.97) * 100) / 100, zone: 'protection' },
      ],
      reason: `Marginal setup (crush ${crushRatio.toFixed(2)}x, win rate ${winRate.toFixed(0)}%). Strikes placed 20% beyond the max historical move ($${maxMove.toFixed(1)}%). Very small premium but high probability of profit. Small position size recommended.`,
      confidence: Math.min(60, Math.round(winRate * 0.6 + crushRatio * 4)),
      riskLevel: 'low',
      bias: 'neutral', ...shared,
      sizing: calcSizing('marginal'), exitRules,
    };
  }

  // Only truly hopeless setups get skipped
  return {
    strategy: 'skip',
    strategyName: 'Skip — No Edge',
    legs: [],
    reason: `Win rate (${winRate.toFixed(0)}%) is below 45% and IV crush (${crushRatio.toFixed(2)}x) is below 0.8. There is no statistical edge here — the stock's actual moves consistently exceed what options price in.`,
    confidence: 0,
    riskLevel: 'high',
    bias: bias.bias, ...shared,
    sizing: null, exitRules: null,
  };
}
