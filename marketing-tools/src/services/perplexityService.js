const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const MODEL = 'sonar-pro';
const TEMPERATURE = 0.7;
const MAX_TOKENS = 4000;

/**
 * Calls the Perplexity chat completions API (OpenAI-compatible format)
 * and returns the full response content.
 * @param {string} apiKey - Perplexity API key provided by the user.
 * @param {string} systemPrompt - The system-level instruction.
 * @param {string} userMessage - The user's message.
 * @returns {Promise<string>} The assistant's reply text.
 */
export async function runPerplexity(apiKey, systemPrompt, userMessage) {
  if (!apiKey) throw new Error('Perplexity API key is required.');

  const response = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody?.error?.message || response.statusText;
    throw new Error(`Perplexity API error (${response.status}): ${message}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}
