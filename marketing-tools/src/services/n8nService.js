/**
 * Triggers an n8n workflow by POSTing a JSON payload to its webhook URL.
 * @param {string} webhookUrl - The full n8n webhook URL.
 * @param {object} payload - The JSON payload to send.
 * @returns {Promise<object>} The parsed JSON response from the webhook.
 */
export async function triggerWebhook(webhookUrl, payload) {
  if (!webhookUrl) throw new Error('Webhook URL is required.');

  let url;
  try {
    url = new URL(webhookUrl);
  } catch {
    throw new Error('Invalid webhook URL format.');
  }

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload ?? {}),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(
      `n8n webhook error (${response.status}): ${errorText || response.statusText}`
    );
  }

  // Some webhooks return empty 200 responses.
  const text = await response.text();
  if (!text) return { success: true };

  try {
    return JSON.parse(text);
  } catch {
    return { success: true, body: text };
  }
}

/**
 * Sends a lightweight test ping to an n8n webhook to verify connectivity.
 * @param {string} webhookUrl - The full n8n webhook URL.
 * @returns {Promise<object>} The webhook response or a success indicator.
 */
export async function testWebhook(webhookUrl) {
  return triggerWebhook(webhookUrl, { test: true, timestamp: new Date().toISOString() });
}
