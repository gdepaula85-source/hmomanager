if (require.main === module) {
  require('dotenv').config();
}
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const supabaseUrl = process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

const corsOrigin = process.env.CORS_ORIGIN;
const corsOptions =
  corsOrigin && corsOrigin !== '*'
    ? { origin: corsOrigin.split(',').map((s) => s.trim()), credentials: true }
    : {};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AI_RATE_LIMIT_MAX || 80),
  standardHeaders: true,
  legacyHeaders: false,
});

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

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'Backend is running correctly.' });
});

// Configuration injection for the frontend (no secrets)
app.get('/config.js', (req, res) => {
  res.type('.js');
  res.send(`
    window.ENV = {
      SUPA_URL: "${process.env.SUPABASE_URL || ''}",
      SUPA_KEY: "${process.env.SUPABASE_ANON_KEY || ''}",
      WORKER_URL: "${process.env.WORKER_URL || ''}"
    };
  `);
});

app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for any frontend routes that are not API routes
app.get(/^(.*)$/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`PID ${process.pid} — leave this terminal open; press Ctrl+C to stop.`);
  });
  server.on('error', (err) => {
    console.error('Failed to listen on port', PORT, err.message);
    process.exit(1);
  });
}
