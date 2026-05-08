const { audits } = require('../../audits-data.js');

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

  const { messages, auditKey } = body;
  const audit = audits[auditKey];
  if (!audit) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown audit' }) };
  }

  const auditData = audit.data
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const systemPrompt = `You are a helpful assistant that answers questions about Leonard Hyman's government performance audits. The user has selected one specific audit to discuss. Use only the audit knowledge below to answer questions. If something isn't covered in this audit, say so. Be concise and accurate.

Audit: ${audit.name}

${auditData}

Guidelines:
- Only answer about this specific audit
- Include general background (e.g., San José is in California) if needed
- Do not add external information not in the audit
- Be conversational and helpful`;

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
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages,
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
