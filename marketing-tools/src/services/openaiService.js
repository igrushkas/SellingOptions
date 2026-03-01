const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o';
const TEMPERATURE = 0.7;
const MAX_TOKENS = 4000;

/**
 * Calls the OpenAI chat completions API and returns the full response content.
 * @param {string} apiKey - OpenAI API key provided by the user.
 * @param {string} systemPrompt - The system-level instruction.
 * @param {string} userMessage - The user's message.
 * @returns {Promise<string>} The assistant's reply text.
 */
export async function runOpenAI(apiKey, systemPrompt, userMessage) {
  if (!apiKey) throw new Error('OpenAI API key is required.');

  const response = await fetch(OPENAI_API_URL, {
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
    throw new Error(`OpenAI API error (${response.status}): ${message}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

/**
 * Streams the OpenAI chat completions response, invoking onChunk for each
 * piece of content as it arrives.
 * @param {string} apiKey - OpenAI API key provided by the user.
 * @param {string} systemPrompt - The system-level instruction.
 * @param {string} userMessage - The user's message.
 * @param {(chunk: string) => void} onChunk - Callback invoked with each text delta.
 * @returns {Promise<string>} The fully assembled response text.
 */
export async function runOpenAIStreaming(apiKey, systemPrompt, userMessage, onChunk) {
  if (!apiKey) throw new Error('OpenAI API key is required.');
  if (typeof onChunk !== 'function') throw new Error('onChunk callback is required for streaming.');

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody?.error?.message || response.statusText;
    throw new Error(`OpenAI API error (${response.status}): ${message}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    // Keep the last (potentially incomplete) line in the buffer.
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;

      const payload = trimmed.slice(6);
      if (payload === '[DONE]') continue;

      try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          fullContent += delta;
          onChunk(delta);
        }
      } catch {
        // Skip malformed JSON chunks.
      }
    }
  }

  return fullContent;
}
