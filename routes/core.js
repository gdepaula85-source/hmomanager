module.exports = function registerCoreRoutes(ctx) {
  const { app, supabaseAdmin, aiLimiter } = ctx;

  const ALLOWED_ANTHROPIC_MODELS = new Set([
    'claude-sonnet-4-20250514',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
  ]);

  app.post('/api/ai/messages', aiLimiter, async (req, res) => {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Supabase service role not configured on server' });
    }
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'Anthropic API not configured on server' });
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      return res.status(401).json({ error: 'Missing Authorization bearer token' });
    }

    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const body = req.body || {};
    const model = body.model;
    if (!model || !ALLOWED_ANTHROPIC_MODELS.has(model)) {
      return res.status(400).json({ error: 'Unsupported or missing model' });
    }
    const maxRaw = Number(body.max_tokens);
    const max_tokens = Math.min(Math.max(Number.isFinite(maxRaw) ? maxRaw : 700, 1), 8192);
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return res.status(400).json({ error: 'messages must be a non-empty array' });
    }

    const anthropicUrl =
      process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages';

    try {
      const r = await fetch(anthropicUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens,
          messages: body.messages,
        }),
      });
      const data = await r.json().catch(() => ({}));
      res.status(r.status).json(data);
    } catch (e) {
      console.error('Anthropic proxy error:', e);
      res.status(502).json({ error: 'Upstream AI request failed' });
    }
  });

  app.post('/api/ai/public-chat', aiLimiter, async (req, res) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'Anthropic API not configured on server' });
    }

    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages.slice(-8) : [];
    if (!messages.length) {
      return res.status(400).json({ error: 'messages must be a non-empty array' });
    }

    const publicKnowledge = String(body.system || '').slice(0, 12000);
    const model = process.env.PUBLIC_CHAT_MODEL || 'claude-3-5-haiku-20241022';
    const maxRaw = Number(body.max_tokens);
    const max_tokens = Math.min(Math.max(Number.isFinite(maxRaw) ? maxRaw : 350, 1), 1000);

    try {
      const r = await fetch(process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens,
          system: publicKnowledge,
          messages,
        }),
      });
      const data = await r.json().catch(() => ({}));
      res.status(r.status).json(data);
    } catch (e) {
      console.error('Public AI chat proxy error:', e);
      res.status(502).json({ error: 'Upstream AI request failed' });
    }
  });

  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'success', message: 'Backend is running correctly.' });
  });
};
