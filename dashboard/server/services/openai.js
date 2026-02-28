/**
 * OpenAI / ChatGPT API integration for AI-powered trade analysis
 *
 * Provides:
 * - Earnings analysis and predictions
 * - News sentiment analysis
 * - Strike price recommendations
 * - Risk assessment
 */

export async function analyzeWithAI(stock, apiKey) {
  const prompt = buildAnalysisPrompt(stock);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert options trader specializing in selling premium around earnings events.
You analyze stocks for volatility crush opportunities — selling options before earnings when implied volatility is high,
then profiting when IV drops after the announcement. You focus on NAKED PUTS and NAKED CALLS.
Your analysis should be data-driven, concise, and actionable. Include specific strike prices and win rate estimates.
Format your response in markdown with clear sections.
IMPORTANT: Always include a disclaimer that this is not financial advice.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    throw new Error(`AI analysis failed: ${error.message}`);
  }
}

function buildAnalysisPrompt(stock) {
  const moves = stock.historicalMoves
    .map(m => `${m.quarter}: ${m.direction === 'up' ? '+' : '-'}${m.actual}%`)
    .join(', ');

  const news = stock.news
    .map(n => `[${n.sentiment}] ${n.headline}`)
    .join('\n');

  return `Analyze ${stock.ticker} (${stock.company}) for an earnings options selling opportunity:

**Current Price:** $${stock.price}
**Earnings Date:** ${stock.date} (${stock.timing === 'BMO' ? 'Before Market Open' : 'After Market Close'})
**Implied Move:** ±${stock.impliedMove}%
**EPS Estimate:** $${stock.epsEstimate} (Prior: $${stock.epsPrior})
**Revenue Estimate:** ${stock.revenueEstimate}
**Consensus:** ${stock.consensusRating} (${stock.analystCount} analysts)
**Sector:** ${stock.sector}

**Historical Earnings Moves (last 20 quarters):**
${moves}

**Recent News:**
${news}

Please provide:
1. Trade signal (SELL options / CAUTION / AVOID)
2. IV crush ratio analysis (implied vs historical)
3. Recommended strike prices for naked calls and naked puts with distances
4. Win rate estimate based on historical data
5. Key risks and how news might impact the move
6. Position sizing recommendation
7. Specific exit strategy`;
}
