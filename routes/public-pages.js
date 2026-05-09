module.exports = function registerPublicPageRoutes(ctx) {
  const { app, express, path, fs, crypto, supabaseAdmin, isSuperadminUser, rootDir } = ctx;

app.get('/config.js', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.type('.js');
  res.send(`
    window.ENV = {
      SUPA_URL: ${JSON.stringify(process.env.SUPABASE_URL || '')},
      SUPA_KEY: ${JSON.stringify(process.env.SUPABASE_ANON_KEY || '')},
      WORKER_URL: ${JSON.stringify(process.env.WORKER_URL || '')},
      BUILD_VERSION: ${JSON.stringify(BUILD_TS)}
    };
  `);
});

// ── Blog CMS ───────────────────────────────────────────────────────────────────
// DB-backed blog with draft / published states. Public routes render HTML at
// /blog/ and /blog/:slug (with or without .html suffix). Admin routes under
// /api/blog/* are guarded by superadmin-allowlist + JWT.

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function requireSuperadminFromAuthHeader(req, res) {
  if (!supabaseAdmin) {
    res.status(503).json({ error: 'Supabase service role not configured on server' });
    return null;
  }
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) { res.status(401).json({ error: 'Not authenticated' }); return null; }
  try {
    const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !caller) { res.status(401).json({ error: 'Invalid session' }); return null; }
    if (!(await isSuperadminUser(caller))) {
      res.status(403).json({ error: 'Superadmin access required' });
      return null;
    }
    return caller;
  } catch (e) {
    console.error('Auth check failed:', e);
    res.status(500).json({ error: 'Auth check failed' });
    return null;
  }
}

function renderBlogPostHtml(post) {
  const title       = escapeHtml(post.title || 'Untitled');
  const description = escapeHtml(post.excerpt || '');
  const slug        = escapeHtml(post.slug || '');
  const author      = escapeHtml(post.author || 'Gleydson');
  const category    = escapeHtml(post.category || 'Article');
  const minutes     = post.read_minutes ? `${parseInt(post.read_minutes,10)} min read` : '';
  const publishedAt = post.published_at ? new Date(post.published_at).toISOString().split('T')[0] : '';
  const publishedHuman = publishedAt ? new Date(post.published_at).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}) : '';
  const cover       = post.cover_image ? `<img src="${escapeHtml(post.cover_image)}" alt="${title}" style="width:100%;border-radius:14px;margin:0 0 24px">` : '';
  // body_html is trusted: only superadmin can set it.
  const body        = String(post.body_html || '');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} | LandlordApp.io Blog</title>
<meta name="description" content="${description}">
<link rel="canonical" href="https://landlordapp.io/blog/${slug}">
<meta property="og:type" content="article">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="https://landlordapp.io/blog/${slug}">
${publishedAt ? `<meta property="article:published_time" content="${publishedAt}">` : ''}
<meta property="article:author" content="${author}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/blog/_blog-base.css">
</head>
<body>
<nav class="nav">
  <div class="container-wide nav-inner">
    <a class="nav-brand" href="/"><span class="dot">🏠</span><span>LandlordApp<span style="color:var(--green)">.io</span></span></a>
    <div class="nav-links">
      <a href="/#features">Features</a>
      <a href="/#pricing">Pricing</a>
      <a href="/blog/">Blog</a>
      <a class="cta" href="/index.html">Open app →</a>
    </div>
  </div>
</nav>
<article class="post"><div class="container">
  <div class="post-meta">
    <span class="chip">${category}</span>
    ${publishedHuman ? `<span>Published ${publishedHuman}</span>` : ''}
    ${minutes ? `<span>·</span><span>${minutes}</span>` : ''}
    <span>·</span><span>By ${author}</span>
  </div>
  <h1>${title}</h1>
  ${description ? `<p class="lede">${description}</p>` : ''}
  ${cover}
  ${body}
  <div class="post-cta">
    <h3>Want this in one dashboard?</h3>
    <p>LandlordApp.io is free forever for up to 3 properties. No credit card, no trial clock.</p>
    <a class="btn" href="/index.html">Open the app</a>
  </div>
</div></article>
<footer class="ft"><div class="container-wide">
  <div class="ft-grid">
    <div class="ft-col">
      <div class="ft-brand"><span class="dot">🏠</span><span>LandlordApp.io</span></div>
      <p style="color:rgba(255,255,255,.55);font-size:.88rem;max-width:320px">Built for HMO &amp; R2R operators who mean business. Free forever for up to 3 properties.</p>
    </div>
    <div class="ft-col"><h4>Product</h4><ul>
      <li><a href="/#features">Features</a></li>
      <li><a href="/#pricing">Pricing</a></li>
      <li><a href="/index.html">Live demo</a></li>
    </ul></div>
    <div class="ft-col"><h4>Operators</h4><ul>
      <li><a href="/operators/hmo-landlords.html">HMO Landlords</a></li>
      <li><a href="/operators/r2r-operators.html">R2R Operators</a></li>
      <li><a href="/operators/letting-agents.html">Letting Agents</a></li>
      <li><a href="/operators/portfolio-managers.html">Portfolio Managers</a></li>
      <li><a href="/operators/service-accommodation.html">Service Accommodation</a></li>
    </ul></div>
    <div class="ft-col"><h4>Company</h4><ul>
      <li><a href="/">Home</a></li>
      <li><a href="/blog/">Blog</a></li>
      <li><a href="mailto:support@landlordapp.io">Support</a></li>
    </ul></div>
  </div>
  <div class="ft-bottom"><span>© LandlordApp.io — all rights reserved.</span><span>Built by operators, for operators.</span></div>
</div></footer>
</body>
</html>`;
}

function renderBlogIndexHtml(posts) {
  const cards = (posts || []).map(p => {
    const title = escapeHtml(p.title || 'Untitled');
    const slug  = escapeHtml(p.slug || '');
    const cat   = escapeHtml(p.category || 'Article');
    const exc   = escapeHtml(p.excerpt || '');
    const cover = p.cover_image ? `<img src="${escapeHtml(p.cover_image)}" alt="${title}" style="width:100%;height:160px;object-fit:cover;border-radius:10px 10px 0 0">` : `<div class="cover">📰</div>`;
    return `<a class="post-card" href="/blog/${slug}">
      ${cover}
      <div class="body">
        <span class="category">${cat}</span>
        <h3>${title}</h3>
        <p class="excerpt">${exc}</p>
      </div>
    </a>`;
  }).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Blog | LandlordApp.io</title>
<meta name="description" content="Posts about HMO licensing, R2R, Service Accommodation, and running a property portfolio without spreadsheets.">
<link rel="canonical" href="https://landlordapp.io/blog/">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/blog/_blog-base.css">
</head>
<body>
<nav class="nav"><div class="container-wide nav-inner">
  <a class="nav-brand" href="/"><span class="dot">🏠</span><span>LandlordApp<span style="color:var(--green)">.io</span></span></a>
  <div class="nav-links">
    <a href="/#features">Features</a>
    <a href="/#pricing">Pricing</a>
    <a href="/blog/">Blog</a>
    <a class="cta" href="/index.html">Open app →</a>
  </div>
</div></nav>
<section class="blog-hero"><div class="container">
  <div class="eyebrow">Blog</div>
  <h1>Notes from running a <em>property portfolio</em>.</h1>
  <p>HMO licensing, R2R deal-making, Service Accommodation and the operator's perspective on building software that doesn't get in the way.</p>
</div></section>
<section style="padding:60px 0"><div class="container">
  <div class="post-grid">
    ${cards || '<p style="color:var(--text-mid);text-align:center;padding:60px 0;grid-column:1/-1">No posts yet — check back soon.</p>'}
  </div>
</div></section>
<footer class="ft"><div class="container-wide">
  <div class="ft-grid">
    <div class="ft-col"><div class="ft-brand"><span class="dot">🏠</span><span>LandlordApp.io</span></div></div>
    <div class="ft-col"><h4>Product</h4><ul>
      <li><a href="/#features">Features</a></li>
      <li><a href="/#pricing">Pricing</a></li>
      <li><a href="/index.html">Live demo</a></li>
    </ul></div>
    <div class="ft-col"><h4>Operators</h4><ul>
      <li><a href="/operators/hmo-landlords.html">HMO Landlords</a></li>
      <li><a href="/operators/r2r-operators.html">R2R Operators</a></li>
      <li><a href="/operators/service-accommodation.html">Service Accommodation</a></li>
    </ul></div>
    <div class="ft-col"><h4>Company</h4><ul>
      <li><a href="/">Home</a></li>
      <li><a href="mailto:support@landlordapp.io">Support</a></li>
    </ul></div>
  </div>
  <div class="ft-bottom"><span>© LandlordApp.io</span></div>
</div></footer>
</body>
</html>`;
}

// Public — listing page (any user). RLS on blog_posts already filters to status='published'.
app.get(['/blog', '/blog/'], async (req, res) => {
  if (!supabaseAdmin) return res.status(503).send('Database not configured');
  try {
    const { data, error } = await supabaseAdmin
      .from('blog_posts')
      .select('slug,title,excerpt,cover_image,category,published_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false });
    if (error) { console.error('Blog list error:', error); return res.status(500).send('Database error'); }
    res.set('Cache-Control', 'public, max-age=60');
    res.type('html').send(renderBlogIndexHtml(data || []));
  } catch (e) {
    console.error('Blog list fatal:', e);
    res.status(500).send('Server error');
  }
});

// Public — single post by slug (with optional .html suffix for legacy URLs).
app.get(/^\/blog\/([\w-]+)(?:\.html)?$/, async (req, res, next) => {
  if (!supabaseAdmin) return next();
  const slug = (req.params[0] || '').trim();
  // Skip helper / template files so static middleware can serve them if needed.
  if (slug.startsWith('_') || slug === 'index') return next();
  try {
    const { data, error } = await supabaseAdmin
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();
    if (error) { console.error('Blog post error:', error); return res.status(500).send('Database error'); }
    if (!data) return res.status(404).type('html').send('<h1>Post not found</h1><p><a href="/blog/">Back to blog</a></p>');
    res.set('Cache-Control', 'public, max-age=60');
    res.type('html').send(renderBlogPostHtml(data));
  } catch (e) {
    console.error('Blog post fatal:', e);
    res.status(500).send('Server error');
  }
});

// Admin — list all posts (drafts + published).
app.get('/api/blog/posts', async (req, res) => {
  const caller = await requireSuperadminFromAuthHeader(req, res);
  if (!caller) return;
  const { data, error } = await supabaseAdmin
    .from('blog_posts')
    .select('id,slug,title,excerpt,status,published_at,updated_at,created_at,category,cover_image')
    .order('updated_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ posts: data || [] });
});

// Admin — get one by id.
app.get('/api/blog/posts/:id', async (req, res) => {
  const caller = await requireSuperadminFromAuthHeader(req, res);
  if (!caller) return;
  const { data, error } = await supabaseAdmin
    .from('blog_posts')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json({ post: data });
});

function _sanitiseSlug(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function _coerceTags(t) {
  if (Array.isArray(t)) return t.map(s => String(s).trim()).filter(Boolean);
  if (typeof t === 'string') return t.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

// Admin — create.
app.post('/api/blog/posts', async (req, res) => {
  const caller = await requireSuperadminFromAuthHeader(req, res);
  if (!caller) return;
  const b = req.body || {};
  const title = String(b.title || '').trim();
  if (!title) return res.status(400).json({ error: 'title is required' });
  const slug = _sanitiseSlug(b.slug || title);
  if (!slug) return res.status(400).json({ error: 'slug invalid' });
  const status = (b.status === 'published') ? 'published' : 'draft';
  const row = {
    slug,
    title,
    excerpt:      b.excerpt      != null ? String(b.excerpt) : null,
    body_html:    b.body_html    != null ? String(b.body_html) : null,
    cover_image:  b.cover_image  != null ? String(b.cover_image) : null,
    author:       b.author       != null ? String(b.author) : 'Gleydson',
    category:     b.category     != null ? String(b.category) : null,
    read_minutes: b.read_minutes != null ? parseInt(b.read_minutes, 10) || null : null,
    tags:         _coerceTags(b.tags),
    status,
    published_at: status === 'published' ? new Date().toISOString() : null
  };
  const { data, error } = await supabaseAdmin.from('blog_posts').insert([row]).select('*').maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ post: data });
});

// Admin — update.
app.put('/api/blog/posts/:id', async (req, res) => {
  const caller = await requireSuperadminFromAuthHeader(req, res);
  if (!caller) return;
  const b = req.body || {};
  const update = {};
  if (b.title       != null) update.title       = String(b.title);
  if (b.slug        != null) update.slug        = _sanitiseSlug(b.slug);
  if (b.excerpt     != null) update.excerpt     = String(b.excerpt);
  if (b.body_html   != null) update.body_html   = String(b.body_html);
  if (b.cover_image != null) update.cover_image = String(b.cover_image);
  if (b.author      != null) update.author      = String(b.author);
  if (b.category    != null) update.category    = String(b.category);
  if (b.read_minutes!= null) update.read_minutes= parseInt(b.read_minutes, 10) || null;
  if (b.tags        != null) update.tags        = _coerceTags(b.tags);
  if (b.status      != null) {
    update.status = (b.status === 'published') ? 'published' : 'draft';
    // If admin explicitly publishes for the first time, the trigger stamps published_at.
    if (update.status === 'draft' && b.unpublish === true) update.published_at = null;
  }
  const { data, error } = await supabaseAdmin
    .from('blog_posts')
    .update(update)
    .eq('id', req.params.id)
    .select('*')
    .maybeSingle();
  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json({ post: data });
});

// Admin — delete.
app.delete('/api/blog/posts/:id', async (req, res) => {
  const caller = await requireSuperadminFromAuthHeader(req, res);
  if (!caller) return;
  const { error } = await supabaseAdmin.from('blog_posts').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

// ── HTML cache-busting helper ─────────────────────────────────────────────────
// Reads an HTML file from public/, stamps ?v=BUILD_TS on all local JS/CSS asset
// references, and serves it with no-store headers so the browser never caches
// the shell page.
function _serveHtmlWithCacheBust(res, relPath) {
  var filePath = path.join(rootDir, 'public', relPath);
  if (!fs.existsSync(filePath)) return false;
  var html = fs.readFileSync(filePath, 'utf8');
  html = html.replace(
    /((?:src|href)=")(\/?(?:[^"]*\/)?)([^"]+\.(?:js|css))(\?[^"]*)?">/g,
    function(_, attr, dir, file, _qs) { return attr + dir + file + '?v=' + BUILD_TS + '">'; }
  );
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.type('html');
  res.send(html);
  return true;
}

// ── Clean URLs (no .html) ─────────────────────────────────────────────────────
// Marketing landing lives at "/" and "/landing"; the dashboard SPA lives at
// "/app" (and any /app/* deep link). Direct .html paths still work for back-compat.
// favicon.ico — no .ico file exists; redirect to the SVG so browsers stop
// polluting the network log with HTML-as-favicon misfires.
app.get('/favicon.ico', function(req, res){
  res.redirect(301, '/favicon.svg');
});

app.get(['/', '/landing'], function(req, res, next) {
  if (!_serveHtmlWithCacheBust(res, 'propmanager-landing.html')) return next();
});
app.get(/^\/app(?:\/.*)?$/, function(req, res, next) {
  if (!_serveHtmlWithCacheBust(res, 'index.html')) return next();
});

// ── Tenant remote signing ────────────────────────────────────────────────────
// Token-based, no login. The token IS the auth — short-lived, single-use.
// Issued by POST /api/tenants/:id/sign-token (called from the dashboard),
// verified by the public flow at /sign/:token (page) → POST /api/sign/:token.

const SIGN_TOKEN_TTL_DAYS = 7;
const _isUuid = function(s){ return typeof s === 'string' && /^[0-9a-f-]{36}$/i.test(s); };

// 1) Public sign page — clean URL with the token in the path.
app.get('/sign/:token', function(req, res, next){
  if (!_isUuid(req.params.token)) return res.status(404).send('Invalid signing link');
  if (!_serveHtmlWithCacheBust(res, 'sign.html')) return next();
});

// 2) Dashboard issues a token. Requires the request to come from the org that
//    owns the tenant — caller authenticates via the standard supabase JWT
//    forwarded in the Authorization header (same pattern as other dashboard APIs).
app.post('/api/tenants/:id/sign-token', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'Server misconfigured (no service key)' });
  const tenantId = req.params.id;
  const authHeader = req.headers.authorization || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return res.status(401).json({ error: 'Missing auth' });
  // Verify caller and resolve their org_id.
  const { data: userInfo, error: uErr } = await supabaseAdmin.auth.getUser(jwt);
  if (uErr || !userInfo || !userInfo.user) return res.status(401).json({ error: 'Invalid auth' });
  const userId = userInfo.user.id;
  // Look up which org this user belongs to (admin/member).
  const { data: orgRows } = await supabaseAdmin
    .from('org_members').select('org_id').eq('user_id', userId).limit(1);
  const orgId = orgRows && orgRows[0] && orgRows[0].org_id;
  if (!orgId) return res.status(403).json({ error: 'No org membership' });
  // Confirm tenant belongs to caller's org.
  const { data: tRow, error: tErr } = await supabaseAdmin
    .from('tenants').select('id, org_id, name').eq('id', tenantId).maybeSingle();
  if (tErr || !tRow) return res.status(404).json({ error: 'Tenant not found' });
  if (String(tRow.org_id) !== String(orgId)) return res.status(403).json({ error: 'Forbidden' });
  // Capture the contract type + landlord snapshot at token-issue time so the
  // rendered signed agreement always matches what the tenant actually saw.
  const ALLOWED_CONTRACT_TYPES = ['ast','room_letting','company_let','lodger','excluded_licence','renewal'];
  const reqType = (req.body && typeof req.body.contractType === 'string') ? req.body.contractType : 'ast';
  const contractType = ALLOWED_CONTRACT_TYPES.indexOf(reqType) >= 0 ? reqType : 'ast';
  // Optional agreement HTML snapshot — capped at 600KB to protect the row.
  const rawHtml = (req.body && typeof req.body.agreementHtml === 'string') ? req.body.agreementHtml : '';
  const agreementHtml = rawHtml.slice(0, 600 * 1024) || null;
  // Pull the org's app_config for landlord snapshot fields (companySignature etc.)
  const { data: orgRow } = await supabaseAdmin
    .from('organisations').select('app_config').eq('id', orgId).maybeSingle();
  const cfg = (orgRow && orgRow.app_config && orgRow.app_config.config) || {};
  const llSig   = typeof cfg.companySignature       === 'string' ? cfg.companySignature       : null;
  const llName  = typeof cfg.companySignatoryName   === 'string' ? cfg.companySignatoryName   : null;
  const llTitle = typeof cfg.companySignatoryTitle  === 'string' ? cfg.companySignatoryTitle  : null;
  // Generate token + expiry.
  const { randomUUID } = require('crypto');
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + SIGN_TOKEN_TTL_DAYS * 24 * 3600 * 1000).toISOString();
  // Try the full payload first. If the org's Supabase hasn't run the
  // tenants_add_signature.sql migration yet, the new columns won't exist —
  // PostgREST returns PGRST204 ("column not found in schema cache"). In that
  // case we retry with the minimum payload so the basic remote-signing flow
  // still works, and log the missing migration to the server console.
  const fullPayload = {
    signature_token: token,
    signature_token_expires_at: expiresAt,
    signed_agreement_type: contractType,
    signed_landlord_sig: llSig,
    signed_landlord_name: llName,
    signed_landlord_title: llTitle,
    signed_landlord_date: new Date().toISOString(),
    signed_agreement_html: agreementHtml
  };
  let upErr = null;
  let { error: e1 } = await supabaseAdmin.from('tenants').update(fullPayload).eq('id', tenantId);
  if (e1 && (e1.code === 'PGRST204' || e1.code === '42703' || /could not find|schema cache/i.test(String(e1.message || '')))) {
    console.warn('[sign-token] tenants_add_signature.sql migration not applied — falling back to minimal payload.', e1.message);
    const { error: e2 } = await supabaseAdmin
      .from('tenants')
      .update({ signature_token: token, signature_token_expires_at: expiresAt })
      .eq('id', tenantId);
    upErr = e2 || null;
  } else {
    upErr = e1 || null;
  }
  if (upErr) return res.status(500).json({ error: upErr.message });
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const url = proto + '://' + host + '/sign/' + token;
  res.json({ token, url, expiresAt, tenantName: tRow.name || '' });
});

// 3) Public token preview. No auth — token IS the auth.
//    Returns the bare minimum so the sign page can render without exposing PII.
app.get('/api/sign/:token', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'Server misconfigured' });
  if (!_isUuid(req.params.token)) return res.status(404).json({ error: 'Invalid token' });
  const { data: t, error } = await supabaseAdmin
    .from('tenants')
    .select('id, name, property_name, room_number, signature, signature_saved_at, signature_token_expires_at, signed_agreement_type, signed_agreement_html')
    .eq('signature_token', req.params.token)
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!t) return res.status(410).json({ error: 'Link not found or already used' });
  if (t.signature_token_expires_at && new Date(t.signature_token_expires_at) < new Date()) {
    return res.status(410).json({ error: 'Link expired' });
  }
  res.json({
    tenantName: t.name || '',
    property: t.property_name || '',
    room: t.room_number || null,
    alreadySigned: !!t.signature,
    signedAt: t.signature_saved_at || null,
    agreementType: t.signed_agreement_type || null,
    agreementHtml: t.signed_agreement_html || null
  });
});

// 4) Submit signature. Body: { dataUrl: 'data:image/png;base64,...', signerName?: string }.
//    On success: stores the signature + audit trail (IP, user-agent), clears the
//    token (single-use), records signed_at, and fires confirmation emails to
//    BOTH the tenant and the org owner — best-effort, non-blocking on the response.
app.post('/api/sign/:token', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'Server misconfigured' });
  if (!_isUuid(req.params.token)) return res.status(404).json({ error: 'Invalid token' });
  const { dataUrl, signerName } = req.body || {};
  if (typeof dataUrl !== 'string' || !/^data:image\/(png|jpeg);base64,/.test(dataUrl)) {
    return res.status(400).json({ error: 'Invalid signature data' });
  }
  // Cap raw size at ~2MB of base64 (= ~1.5MB binary) — guards the column.
  if (dataUrl.length > 2 * 1024 * 1024) return res.status(413).json({ error: 'Signature too large' });
  // Pull every field we'll need post-signing in a single query so we don't
  // round-trip again to build the confirmation emails.
  const { data: t, error: lookupErr } = await supabaseAdmin
    .from('tenants')
    .select('id, org_id, name, email, property_name, room_number, signature_token_expires_at, signed_agreement_type, signed_agreement_html, signed_landlord_sig, signed_landlord_name, signed_landlord_title, signed_landlord_date')
    .eq('signature_token', req.params.token)
    .maybeSingle();
  if (lookupErr) return res.status(500).json({ error: lookupErr.message });
  if (!t) return res.status(410).json({ error: 'Link not found or already used' });
  if (t.signature_token_expires_at && new Date(t.signature_token_expires_at) < new Date()) {
    return res.status(410).json({ error: 'Link expired' });
  }
  const cleanName = (typeof signerName === 'string' ? signerName : '').trim().slice(0, 200);
  // Audit trail capture. x-forwarded-for is set by Hostinger's reverse proxy.
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const signedIp = (fwd || req.ip || '').slice(0, 64);
  const signedUA = String(req.headers['user-agent'] || '').slice(0, 500);
  const signedAt = new Date().toISOString();

  // Try the full payload first; on PGRST204 / 42703 (migration not run) fall back
  // to the legacy minimal columns so basic remote-signing still works.
  const fullUpdate = {
    signature: dataUrl,
    signature_saved_at: signedAt,
    signature_signer_name: cleanName || null,
    signed_ip: signedIp || null,
    signed_user_agent: signedUA || null,
    signature_token: null,
    signature_token_expires_at: null
  };
  let upErr = null;
  let { error: e1 } = await supabaseAdmin.from('tenants').update(fullUpdate).eq('id', t.id);
  if (e1 && (e1.code === 'PGRST204' || e1.code === '42703' || /could not find|schema cache/i.test(String(e1.message || '')))) {
    console.warn('[sign POST] migration not fully applied — retrying with minimal payload.', e1.message);
    const { error: e2 } = await supabaseAdmin
      .from('tenants')
      .update({
        signature: dataUrl,
        signature_saved_at: signedAt,
        signature_signer_name: cleanName || null,
        signature_token: null,
        signature_token_expires_at: null
      })
      .eq('id', t.id);
    upErr = e2 || null;
  } else {
    upErr = e1 || null;
  }
  if (upErr) return res.status(500).json({ error: upErr.message });

  // Acknowledge to the public sign page immediately. PDF generation, upload,
  // and confirmation emails happen asynchronously so the tenant never sits
  // on a spinner waiting for Resend / Storage round-trips.
  res.json({ ok: true });

  setImmediate(async () => {
    let pdfBytes = null;
    try {
      pdfBytes = await _buildSignedAgreementPdf(t, {
        dataUrl, signerName: cleanName, signedAt, signedIp, signedUA
      });
      const pdfPath = await _uploadSignedAgreementPdf(t.org_id, t.id, pdfBytes);
      if (pdfPath) {
        const { error: pErr } = await supabaseAdmin
          .from('tenants')
          .update({ signed_agreement_pdf_path: pdfPath })
          .eq('id', t.id);
        if (pErr) console.warn('[sign PDF] could not save pdf_path:', pErr.message);
      }
    } catch (err) {
      console.warn('[sign PDF] generation/upload failed:', err && err.message);
    }
    try {
      await _sendSignedConfirmationEmails(
        t,
        { signedAt, signerName: cleanName, signedIp, signedUA },
        pdfBytes
      );
    } catch (err) {
      console.warn('[sign confirmation email] failed:', err && err.message);
    }
  });
});

// Builds + sends the two-party confirmation email after a signature submission.
// Skipped silently if RESEND_API_KEY is not configured.
async function _sendSignedConfirmationEmails(tenant, audit, pdfBytes) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey || !tenant) return;
  const { data: org } = await supabaseAdmin
    .from('organisations')
    .select('billing_email, owner_email, name, app_config')
    .eq('id', tenant.org_id)
    .maybeSingle();
  const cfg = (org && org.app_config && org.app_config.config) || {};
  const companyName = cfg.portfolioName || cfg.siteTitle || (org && org.name) || 'LandlordApp';
  const ownerEmail = String((org && (org.billing_email || org.owner_email)) || '').trim();
  const tenantEmail = String(tenant.email || '').trim();
  const niceWhen = (() => {
    try { return new Date(audit.signedAt).toLocaleString('en-GB', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
    catch (_e) { return audit.signedAt; }
  })();
  const tenantLabel = tenant.name || 'the tenant';
  const propLabel = (tenant.property_name || '') + (tenant.room_number ? ' · Room ' + tenant.room_number : '');

  // Reuses the agreement HTML snapshot the tenant signed — guarantees both
  // parties get a copy of EXACTLY what was signed, not a re-render.
  const agreementBlock = tenant.signed_agreement_html
    ? '<div style="border:1px solid #E5E7EB;border-radius:10px;padding:18px;background:#fff;font-family:Georgia,serif;font-size:13px;line-height:1.7;color:#111;margin:18px 0">' + tenant.signed_agreement_html + '</div>'
    : '';

  const auditBlock =
    '<div style="background:#F8F9FB;border:1px solid #E5E7EB;border-radius:10px;padding:14px 18px;margin:18px 0;font-size:12px;color:#475569;line-height:1.7">'
    + '<div style="font-weight:700;color:#0F172A;margin-bottom:6px">Audit trail</div>'
    + '<div><strong>Signed by:</strong> ' + _esc(audit.signerName || tenantLabel) + '</div>'
    + '<div><strong>When:</strong> ' + _esc(niceWhen) + '</div>'
    + (audit.signedIp  ? '<div><strong>IP address:</strong> ' + _esc(audit.signedIp)  + '</div>' : '')
    + (audit.signedUA  ? '<div style="word-break:break-all"><strong>Device:</strong> ' + _esc(audit.signedUA) + '</div>' : '')
    + '<div style="margin-top:8px;font-size:11px;color:#94A3B8">Captured under the Electronic Communications Act 2000, s.7.</div>'
    + '</div>';

  function renderEmail(audience) {
    const greeting = audience === 'tenant'
      ? 'Hi ' + (tenantLabel.split(' ')[0] || 'there') + ','
      : 'Hi,';
    const intro = audience === 'tenant'
      ? '<p style="font-size:15px;color:#475569;line-height:1.65;margin:0 0 14px">Thanks for signing your tenancy agreement. A full copy is below — keep this email for your records.</p>'
      : '<p style="font-size:15px;color:#475569;line-height:1.65;margin:0 0 14px"><strong>' + _esc(tenantLabel) + '</strong> has signed their tenancy agreement for <strong>' + _esc(propLabel || 'the property') + '</strong>. A copy is below for your records.</p>';
    return '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#F8F9FB;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">'
      + '<div style="max-width:680px;margin:0 auto;background:#F8F9FB">'
      +   '<div style="background:linear-gradient(135deg,#14B8A6 0%,#0D9488 100%);padding:24px 28px;color:#fff">'
      +     '<div style="font-size:20px;font-weight:800">' + _esc(companyName) + '</div>'
      +     '<div style="font-size:12px;color:rgba(255,255,255,.78);margin-top:4px">Signed tenancy agreement</div>'
      +   '</div>'
      +   '<div style="background:#fff;padding:32px 28px">'
      +     '<p style="font-size:18px;font-weight:700;color:#0F172A;margin:0 0 12px">' + _esc(greeting) + '</p>'
      +     '<div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:10px;padding:14px 18px;margin:0 0 18px;color:#065F46;font-size:14px;line-height:1.55"><strong>✓ Agreement signed on ' + _esc(niceWhen) + '</strong></div>'
      +     intro
      +     auditBlock
      +     '<div style="font-size:13px;color:#475569;font-weight:700;margin:24px 0 6px">Signed agreement</div>'
      +     (agreementBlock || '<p style="font-size:13px;color:#94A3B8;font-style:italic">(Agreement preview not available — view it on your dashboard.)</p>')
      +     '<hr style="border:none;border-top:1px solid #E8ECF0;margin:24px 0">'
      +     '<p style="font-size:12px;color:#94A3B8;margin:0">If you didn\'t expect this email, please reply — it goes to ' + _esc(companyName) + '.</p>'
      +   '</div>'
      +   '<div style="background:#F8F9FB;padding:18px 28px;border-top:1px solid #E8ECF0;font-size:11px;color:#94A3B8;text-align:center">Sent via <a href="https://landlordapp.io" style="color:#0D9488;text-decoration:none">landlordapp.io</a> on behalf of ' + _esc(companyName) + '</div>'
      + '</div></body></html>';
  }

  const subject = 'Signed: tenancy agreement for ' + (propLabel || tenantLabel);
  const fromAddr = process.env.LIFECYCLE_MAIL_FROM
    || process.env.AUTH_LIFECYCLE_MAIL_FROM
    || 'LandlordApp <admin@landlordapp.io>';

  // The signed agreement PDF is attached to BOTH emails so each party gets
  // a self-contained, downloadable copy alongside the inline HTML preview.
  const attachments = pdfBytes ? [{
    filename: 'signed-tenancy-agreement.pdf',
    content: Buffer.from(pdfBytes).toString('base64')
  }] : null;

  async function _send(to, htmlBody) {
    if (!to || !to.includes('@')) return;
    const payload = { from: fromAddr, to: [to], subject, html: htmlBody };
    if (attachments) payload.attachments = attachments;
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:'Bearer ' + resendKey },
        body: JSON.stringify(payload)
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        console.warn('[sign confirmation email] Resend error for', to, d && (d.error || d.message));
      }
    } catch (err) {
      console.warn('[sign confirmation email] network error for', to, err && err.message);
    }
  }

  await Promise.all([
    _send(tenantEmail, renderEmail('tenant')),
    _send(ownerEmail,  renderEmail('landlord')),
  ]);
}

function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Signed-agreement PDF generation ──────────────────────────────────────────
// Renders the signed agreement (HTML snapshot, both signatures, audit trail)
// to a flat PDF using pdf-lib. No headless Chrome — runs anywhere Node runs.
// Layout is plain-text + embedded PNG signatures; pixel-perfect HTML fidelity
// isn't a goal, legal defensibility is.
async function _buildSignedAgreementPdf(tenant, audit) {
  const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);

  const PAGE_W = 595, PAGE_H = 842, MARGIN = 50;
  const MAX_W = PAGE_W - 2 * MARGIN;
  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  function ensure(h) {
    if (y - h < MARGIN) { page = pdf.addPage([PAGE_W, PAGE_H]); y = PAGE_H - MARGIN; }
  }
  function wrap(text, f, size) {
    const words = String(text || '').split(/\s+/);
    const lines = []; let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (f.widthOfTextAtSize(test, size) > MAX_W) {
        if (line) lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }
  function drawPara(text, opts) {
    const f = (opts && opts.bold) ? bold : font;
    const size = (opts && opts.size) || 11;
    const lh = size + 3;
    const lines = wrap(text, f, size);
    for (const l of lines) {
      ensure(lh);
      page.drawText(l, { x: MARGIN, y: y - size, font: f, size, color: rgb(0.05, 0.08, 0.13) });
      y -= lh;
    }
    y -= 4;
  }
  function drawHeading(t) {
    ensure(22);
    page.drawText(t, { x: MARGIN, y: y - 14, font: bold, size: 13, color: rgb(0, 0, 0) });
    y -= 22;
  }
  function drawHr() {
    ensure(12);
    page.drawLine({
      start: { x: MARGIN, y: y - 4 },
      end:   { x: PAGE_W - MARGIN, y: y - 4 },
      thickness: 0.5, color: rgb(0.7, 0.74, 0.78)
    });
    y -= 14;
  }
  async function drawSig(dataUrl, label) {
    if (!dataUrl) return false;
    try {
      const bytes = _dataUrlToBytes(dataUrl);
      const img = /^data:image\/jpeg/.test(dataUrl)
        ? await pdf.embedJpg(bytes)
        : await pdf.embedPng(bytes);
      const w = 180;
      const h = w * (img.height / img.width);
      ensure(h + 10);
      page.drawImage(img, { x: MARGIN, y: y - h, width: w, height: h });
      y -= h + 4;
      return true;
    } catch (e) {
      console.warn('[PDF] could not embed', label, 'signature:', e && e.message);
      return false;
    }
  }

  // Header
  drawPara('SIGNED TENANCY AGREEMENT', { bold: true, size: 16 });
  drawPara('Property: ' + (tenant.property_name || '—') + (tenant.room_number ? ' · Room ' + tenant.room_number : ''));
  drawPara('Tenant: ' + (tenant.name || '—'));
  drawHr();

  // Agreement body — flatten the HTML snapshot to paragraphs.
  drawHeading('Agreement');
  const paras = _htmlToParagraphs(tenant.signed_agreement_html);
  if (paras.length === 0) {
    drawPara('(Agreement copy not captured at signing time.)', { size: 10 });
  } else {
    for (const p of paras) drawPara(p);
  }

  // Landlord side
  drawHr();
  drawHeading('Landlord signature');
  await drawSig(tenant.signed_landlord_sig, 'landlord');
  drawPara((tenant.signed_landlord_name || '—') + (tenant.signed_landlord_title ? ' — ' + tenant.signed_landlord_title : ''));
  if (tenant.signed_landlord_date) {
    try {
      drawPara('Dated: ' + new Date(tenant.signed_landlord_date)
        .toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }));
    } catch (_) {}
  }

  // Tenant side
  drawHr();
  drawHeading('Tenant signature');
  await drawSig(audit.dataUrl, 'tenant');
  drawPara(audit.signerName || tenant.name || '—');
  try {
    drawPara('Dated: ' + new Date(audit.signedAt)
      .toLocaleString('en-GB', { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' }));
  } catch (_) {}

  // Audit trail — what makes this legally defensible (ECA 2000 s.7).
  drawHr();
  drawHeading('Audit trail');
  drawPara('Signed at: ' + audit.signedAt, { size: 10 });
  if (audit.signedIp) drawPara('IP address: ' + audit.signedIp, { size: 10 });
  if (audit.signedUA) drawPara('Device: ' + audit.signedUA, { size: 10 });
  drawPara('Captured under the Electronic Communications Act 2000, s.7.', { size: 9 });

  return await pdf.save();
}

function _dataUrlToBytes(dataUrl) {
  const m = /^data:image\/(png|jpeg);base64,(.*)$/.exec(String(dataUrl || ''));
  if (!m) throw new Error('Invalid data URL');
  return Buffer.from(m[2], 'base64');
}

// Lightweight HTML → paragraph-string flattener. Not a full HTML parser —
// agreement templates are well-structured (server-generated, sanitised at
// token-issue time), so this gets us readable PDF body text without pulling
// in jsdom or a parser.
function _htmlToParagraphs(html) {
  if (!html) return [];
  let s = String(html);
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<\/(p|div|h[1-6]|li|tr|blockquote)>/gi, '\n\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
       .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  s = s.split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).join('\n');
  s = s.replace(/\n{3,}/g, '\n\n').trim();
  return s.split(/\n{2,}/).filter(p => p && p.length > 0);
}

// Uploads the PDF buffer to the private 'signed-agreements' Storage bucket.
// Returns the storage path (e.g. "{org_id}/{tenant_id}-{epoch}.pdf") or null
// if the bucket is missing (e.g. migration hasn't been run on this project).
async function _uploadSignedAgreementPdf(orgId, tenantId, pdfBytes) {
  if (!supabaseAdmin || !pdfBytes) return null;
  const path = String(orgId) + '/' + String(tenantId) + '-' + Date.now() + '.pdf';
  const { error } = await supabaseAdmin.storage
    .from('signed-agreements')
    .upload(path, Buffer.from(pdfBytes), {
      contentType: 'application/pdf',
      upsert: true
    });
  if (error) {
    console.warn('[upload signed PDF] failed:', error.message);
    return null;
  }
  return path;
}

// ── Landlord-side PDF download ───────────────────────────────────────────────
// Auth-checked endpoint that streams the stored signed-agreement PDF for a
// tenant. Caller must be a member of the tenant's org. Used by the dashboard's
// "Download PDF" button — server-proxied so signed-URL expiry is never a UX
// problem and the bucket can stay private.
app.get('/api/signed-agreement/:tenantId/pdf', async (req, res) => {
  if (!supabaseAdmin) return res.status(500).json({ error: 'Server misconfigured' });
  const tenantId = req.params.tenantId;
  const authHeader = req.headers.authorization || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return res.status(401).json({ error: 'Missing auth' });
  const { data: userInfo, error: uErr } = await supabaseAdmin.auth.getUser(jwt);
  if (uErr || !userInfo || !userInfo.user) return res.status(401).json({ error: 'Invalid auth' });
  const { data: orgRows } = await supabaseAdmin
    .from('org_members').select('org_id').eq('user_id', userInfo.user.id).limit(1);
  const orgId = orgRows && orgRows[0] && orgRows[0].org_id;
  if (!orgId) return res.status(403).json({ error: 'No org membership' });
  const { data: tRow, error: tErr } = await supabaseAdmin
    .from('tenants')
    .select('id, org_id, name, signed_agreement_pdf_path')
    .eq('id', tenantId)
    .maybeSingle();
  if (tErr) return res.status(500).json({ error: tErr.message });
  if (!tRow) return res.status(404).json({ error: 'Tenant not found' });
  if (String(tRow.org_id) !== String(orgId)) return res.status(403).json({ error: 'Forbidden' });
  if (!tRow.signed_agreement_pdf_path) return res.status(404).json({ error: 'No signed PDF on file' });
  const { data: blob, error: dErr } = await supabaseAdmin.storage
    .from('signed-agreements')
    .download(tRow.signed_agreement_pdf_path);
  if (dErr || !blob) return res.status(500).json({ error: dErr ? dErr.message : 'Download failed' });
  const ab = await blob.arrayBuffer();
  const safeName = (tRow.name || 'tenant').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'tenant';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="signed-agreement-' + safeName + '.pdf"');
  res.send(Buffer.from(ab));
});

// ── Communication Hub ─────────────────────────────────────────────────────────
// Per-org editable templates (seeded with check-in / check-out / house rules /
// payment reminder in EN + PT-BR). Send via Resend (logs to email_log) or
// WhatsApp click-to-chat (logs intent to comm_log right before wa.me opens).


// ── HTML cache-busting middleware ─────────────────────────────────────────────
// Intercepts every direct .html request and applies the same cache-bust.
// Must sit BEFORE express.static so it wins for .html files.
app.use(function cacheBustHtml(req, res, next) {
  if (!req.path.match(/\.html$/i)) return next();
  if (!_serveHtmlWithCacheBust(res, req.path)) return next();
});

app.use(express.static(path.join(rootDir, 'public'), {
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    // HTML stays uncached because it receives fresh ?v=BUILD_TS asset URLs.
    // Versioned JS/CSS can be cached aggressively, which materially improves
    // first reload and tab-switch tests on the large dashboard bundle.
    if (ext === '.html') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (['.js', '.css'].includes(ext)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}));

// Fallback for unknown frontend routes (exclude /api/ to return proper 404s).
// Sends the marketing landing — visitors who type a non-existent path land on
// a useful page instead of an empty dashboard shell.
app.get(/^(?!\/api\/).*$/, (req, res) => {
  if (_serveHtmlWithCacheBust(res, 'propmanager-landing.html')) return;
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.sendFile(path.join(rootDir, 'public', 'propmanager-landing.html'));
});
};
