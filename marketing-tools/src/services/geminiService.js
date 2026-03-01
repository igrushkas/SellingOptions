const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com';
const MODEL = 'gemini-2.0-flash';

/**
 * Calls the Google Gemini generateContent API and returns the text response.
 * @param {string} apiKey - Google AI API key provided by the user.
 * @param {string} prompt - The prompt to send to Gemini.
 * @returns {Promise<string>} The generated text content.
 */
export async function runGemini(apiKey, prompt) {
  if (!apiKey) throw new Error('Gemini API key is required.');

  const url = `${GEMINI_BASE_URL}/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody?.error?.message || response.statusText;
    throw new Error(`Gemini API error (${response.status}): ${message}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (text === undefined || text === null) {
    throw new Error('Gemini returned an empty response. The prompt may have been blocked by safety filters.');
  }

  return text;
}

/**
 * Placeholder for Google Veo 3 video generation.
 * The Veo 3 API is not yet publicly available for direct REST calls.
 * @param {string} _apiKey - Google AI API key (unused for now).
 * @param {string} _prompt - The video generation prompt (unused for now).
 * @returns {Promise<string>} A message about current availability.
 */
export async function generateVideo(_apiKey, _prompt) {
  return (
    'Video generation via the Veo 3 API is not yet publicly available for direct REST access. ' +
    'Google currently offers Veo through Vertex AI and Google AI Studio. ' +
    'This placeholder will be updated once the public API endpoint is released.'
  );
}
