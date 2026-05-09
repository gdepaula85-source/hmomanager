const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../server');

test('GET /api/health returns healthy status', async () => {
  const res = await request(app).get('/api/health').expect(200);

  assert.equal(res.body.status, 'success');
});

test('GET /config.js exposes only public frontend config', async () => {
  const res = await request(app).get('/config.js').expect(200);

  assert.match(res.text, /window\.ENV/);
  assert.doesNotMatch(res.text, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(res.text, /RESEND_API_KEY/);
  assert.doesNotMatch(res.text, /STRIPE_SECRET_KEY/);
});

test('POST /api/stripe/webhook is still registered before JSON parsing', async () => {
  const res = await request(app)
    .post('/api/stripe/webhook')
    .set('Content-Type', 'application/json')
    .send('{}')
    .expect(503);

  assert.match(res.body.error, /Stripe webhook not configured/);
});

test('POST /api/stripe/create-checkout-session smoke response', async () => {
  const res = await request(app)
    .post('/api/stripe/create-checkout-session')
    .send({})
    .expect(503);

  assert.match(res.body.error, /Supabase service role not configured/);
});

test('POST /api/tenant-portal/login smoke response', async () => {
  const res = await request(app)
    .post('/api/tenant-portal/login')
    .send({})
    .expect(503);

  assert.equal(res.body.error, 'Service unavailable');
});

test('POST /api/marketing/capture-lead smoke response', async () => {
  const res = await request(app)
    .post('/api/marketing/capture-lead')
    .send({ email: 'test@example.com', source: 'smoke' })
    .expect(503);

  assert.equal(res.body.error, 'Server is not configured for this endpoint');
});

test('POST /api/ai/public-chat is public but requires AI configuration', async () => {
  const res = await request(app)
    .post('/api/ai/public-chat')
    .send({ messages: [{ role: 'user', content: 'What is LandlordApp?' }] })
    .expect(503);

  assert.equal(res.body.error, 'Anthropic API not configured on server');
});
