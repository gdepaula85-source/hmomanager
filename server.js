if (require.main === module) {
  require('dotenv').config();
}
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

const registerCoreRoutes = require('./routes/core');
const createBillingRoutes = require('./routes/billing');
const registerPublicApiRoutes = require('./routes/public-api');
const registerEmailRoutes = require('./routes/email');
const registerTenantPortalRoutes = require('./routes/tenant-portal');
const registerBackupRoutes = require('./routes/backup');
const registerPublicPageRoutes = require('./routes/public-pages');
const registerCommunicationRoutes = require('./routes/communication');


const app = express();

// ── Cache-busting version stamp ───────────────────────────────────────────────
// Re-read the dashboard bundle's mtime on every request so a rebuilt bundle
// invalidates the browser cache immediately — no server restart required.
const SERVER_BOOT_TS = Date.now().toString(36);
function BUILD_TS_FN() {
  try {
    var bundlePath = path.join(__dirname, 'public', 'js', 'dashboard.bundle.js');
    if (fs.existsSync(bundlePath)) return fs.statSync(bundlePath).mtimeMs.toString(36);
  } catch (e) {}
  return SERVER_BOOT_TS;
}
Object.defineProperty(global, 'BUILD_TS', { get: BUILD_TS_FN });

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}
const PORT = process.env.PORT || 3000;

const supabaseUrl = process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin =
  supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const stripeClient = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const stripePriceByPlan = {
  starter: process.env.STRIPE_PRICE_STARTER || '',
  professional: process.env.STRIPE_PRICE_PROFESSIONAL || '',
  business: process.env.STRIPE_PRICE_BUSINESS || '',
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE || 'price_1TPooTJ78dmPbvOx3o1uyxDw',
};
const stripePlanByPrice = Object.fromEntries(
  Object.entries(stripePriceByPlan)
    .filter(([, priceId]) => !!priceId)
    .map(([plan, priceId]) => [priceId, plan])
);
const appBaseUrl = process.env.APP_BASE_URL || `http://localhost:${PORT}`;

const corsOrigin = process.env.CORS_ORIGIN;
const corsOptions =
  corsOrigin && corsOrigin !== '*'
    ? { origin: corsOrigin.split(',').map((s) => s.trim()), credentials: true }
    : process.env.NODE_ENV === 'production'
      ? { origin: (process.env.APP_BASE_URL || '').replace(/\/$/, ''), credentials: true }
      : {};

app.use(cors(corsOptions));

// ── Security headers ──────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});


let emailRoutes;
const routeContext = {
  app, express, path, fs, crypto, supabaseAdmin, stripeClient, stripePriceByPlan, stripePlanByPrice,
  appBaseUrl, aiLimiter: null, emailLimiter: null, authLifecycleEmailLimiter: null, tenantPortalLimiter: null, stripeLimiter: null,
  isUuidString: null, isSuperadminUser: null, rootDir: __dirname,
};
function sendLifecycleForOrgProxy() {
  if (!emailRoutes || typeof emailRoutes.sendLifecycleForOrg !== 'function') {
    throw new Error('Email lifecycle routes are not initialized');
  }
  return emailRoutes.sendLifecycleForOrg.apply(null, arguments);
}
Object.assign(routeContext, {
  sendLifecycleForOrg: sendLifecycleForOrgProxy,
  formatDate: function() {
    if (!emailRoutes || typeof emailRoutes.formatDate !== 'function') {
      const d = new Date(arguments[0]);
      return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    return emailRoutes.formatDate.apply(null, arguments);
  },
});
const billingRoutes = createBillingRoutes(routeContext);
billingRoutes.registerStripeWebhook();

// Bumped to 40mb so /api/email/send can carry PDF attachments (~20-30MB max).
app.use(express.json({ limit: '40mb' }));
app.use(express.urlencoded({ extended: true, limit: '40mb' }));

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AI_RATE_LIMIT_MAX || 80),
  standardHeaders: true,
  legacyHeaders: false,
});

const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.EMAIL_RATE_LIMIT_MAX || 60),
  standardHeaders: true,
  legacyHeaders: false,
});

const authLifecycleEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_EMAIL_RATE_LIMIT_MAX || 25),
  standardHeaders: true,
  legacyHeaders: false,
});

const tenantPortalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.TENANT_PORTAL_RATE_LIMIT_MAX || 25),
  standardHeaders: true,
  legacyHeaders: false,
});

const stripeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

function isUuidString(v) {
  return (
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

async function isSuperadminUser(user) {
  if (!supabaseAdmin || !user) return false;
  const email = String(user.email || '').toLowerCase().trim();
  const userId = String(user.id || '').trim();

  if (email) {
    const byEmail = await supabaseAdmin
      .from('superadmin_allowlist')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (byEmail?.data?.id) return true;
    if (byEmail?.error) throw byEmail.error;
  }

  if (userId) {
    const byUserId = await supabaseAdmin
      .from('superadmin_allowlist')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (byUserId?.data?.id) return true;
    if (byUserId?.error) throw byUserId.error;
  }

  return false;
}

Object.assign(routeContext, {
  aiLimiter,
  emailLimiter,
  authLifecycleEmailLimiter,
  tenantPortalLimiter,
  stripeLimiter,
  isUuidString,
  isSuperadminUser,
});

registerCoreRoutes(routeContext);
registerPublicApiRoutes(routeContext);
emailRoutes = registerEmailRoutes(routeContext);
registerTenantPortalRoutes(routeContext);
billingRoutes.registerBillingRoutes();
registerBackupRoutes(routeContext);
registerPublicPageRoutes(routeContext);
registerCommunicationRoutes(Object.assign({}, routeContext, emailRoutes));

module.exports = app;

// ── Startup env-var validation ─────────────────────────────────
(function validateEnv() {
  const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.warn('⚠️  Missing required env vars:', missing.join(', '));
    console.warn('   The app will start but authentication and data access will fail.');
  }
  const recommended = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'RESEND_API_KEY', 'ANTHROPIC_API_KEY'];
  const missingRec = recommended.filter((k) => !process.env[k]);
  if (missingRec.length) {
    console.warn('ℹ️  Optional env vars not set:', missingRec.join(', '), '— related features will be disabled.');
  }
})();

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
