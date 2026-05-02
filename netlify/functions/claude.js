const { auditKnowledge } = require('../../audits-data.js');

// Normalize whitespace to reduce token count (OCR artifacts produce lots of extra spaces/blank lines)
const normalizedKnowledge = auditKnowledge
  .replace(/[ \t]+/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const SYSTEM_PROMPT = `You are a helpful assistant that answers questions about Leonard Hyman's government performance audits. Use only the provided audit knowledge below to answer questions. If something isn't covered in the audits, say so. Be concise and accurate.

Audit Knowledge:
${normalizedKnowledge}

Guidelines:
- Only answer about the audits listed
- Include general background (e.g., San José is in California) if needed
- Do not add external information not in the audits
- Be conversational and helpful`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: body.messages,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      statusCode: response.status,
      body: JSON.stringify({ error: data.error?.message || 'API error' }),
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: data.content[0].text }),
  };
};
