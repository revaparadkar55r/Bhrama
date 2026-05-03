const express = require('express');
const path    = require('path');
const app     = express();

app.use(express.json());
app.use(express.static(path.join(__dirname)));

async function callGroq(key, system, messages) {
  const body = {
    model: 'llama-3.3-70b-versatile',
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    ],
    max_tokens: 4096,
    temperature: 0.7,
  };

  const r    = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body:    JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) return { ok: false, status: r.status, error: data.error?.message || 'Groq API error' };
  const text = data.choices?.[0]?.message?.content ?? '';
  return { ok: true, text };
}

app.post('/api/ai', async (req, res) => {
  const { system, messages, apiKey } = req.body;
  const key = apiKey || process.env.GROQ_API_KEY || '';
  if (!key) return res.status(401).json({ error: 'No API key. Click ⚙ Settings in the app.' });

  const result = await callGroq(key, system, messages);
  if (!result.ok) return res.status(result.status || 500).json({ error: result.error });
  res.json({ content: [{ text: result.text }] });
});

app.post('/api/test-key', async (req, res) => {
  const { apiKey } = req.body;
  const key = apiKey || process.env.GROQ_API_KEY || '';
  if (!key) return res.status(400).json({ ok: false, error: 'No key provided' });

  const result = await callGroq(key, null, [{ role: 'user', content: 'hi' }]);
  if (result.ok) return res.json({ ok: true });
  res.json({ ok: false, error: result.error });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`\n  Brahma  →  http://localhost:${PORT}\n`));
