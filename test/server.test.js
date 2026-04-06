'use strict';

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

let app;

before(() => {
  delete require.cache[require.resolve('../server.js')];
  app = require('../server.js');
});

test('GET /api/health returns JSON success', async () => {
  const res = await request(app).get('/api/health').expect(200);
  assert.equal(res.body.status, 'success');
});

test('POST /api/ai/messages returns 503 when Supabase admin is not configured', async () => {
  const res = await request(app)
    .post('/api/ai/messages')
    .set('Authorization', 'Bearer x')
    .send({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'hi' }],
    });
  assert.equal(res.status, 503);
  assert.match(String(res.body.error || ''), /Supabase|service role/i);
});

test('POST /api/ai/messages returns 401 without bearer token when AI route is active', async () => {
  const prev = {
    url: process.env.SUPABASE_URL,
    sr: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ak: process.env.ANTHROPIC_API_KEY,
  };
  process.env.SUPABASE_URL = 'https://xyzcompany.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-for-unit-test';
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
  delete require.cache[require.resolve('../server.js')];
  const app2 = require('../server.js');
  try {
    const res = await request(app2).post('/api/ai/messages').send({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 50,
      messages: [{ role: 'user', content: 'x' }],
    });
    assert.equal(res.status, 401);
  } finally {
    if (prev.url !== undefined) process.env.SUPABASE_URL = prev.url;
    else delete process.env.SUPABASE_URL;
    if (prev.sr !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = prev.sr;
    else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (prev.ak !== undefined) process.env.ANTHROPIC_API_KEY = prev.ak;
    else delete process.env.ANTHROPIC_API_KEY;
    delete require.cache[require.resolve('../server.js')];
  }
});

test('POST /api/email/send returns 503 when Resend is not configured', async () => {
  const prev = {
    url: process.env.SUPABASE_URL,
    sr: process.env.SUPABASE_SERVICE_ROLE_KEY,
    re: process.env.RESEND_API_KEY,
  };
  process.env.SUPABASE_URL = 'https://xyzcompany.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-for-unit-test';
  delete process.env.RESEND_API_KEY;
  delete require.cache[require.resolve('../server.js')];
  const appEmail = require('../server.js');
  try {
    const res = await request(appEmail)
      .post('/api/email/send')
      .set('Authorization', 'Bearer x')
      .send({
        orgId: '00000000-0000-0000-0000-000000000001',
        to: ['a@b.com'],
        subject: 't',
        text: 'body',
      });
    assert.equal(res.status, 503);
    assert.match(String(res.body.error || ''), /RESEND|Email sending/i);
  } finally {
    if (prev.url !== undefined) process.env.SUPABASE_URL = prev.url;
    else delete process.env.SUPABASE_URL;
    if (prev.sr !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = prev.sr;
    else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (prev.re !== undefined) process.env.RESEND_API_KEY = prev.re;
    else delete process.env.RESEND_API_KEY;
    delete require.cache[require.resolve('../server.js')];
  }
});

test('POST /api/email/send returns 401 without bearer token', async () => {
  const prev = {
    url: process.env.SUPABASE_URL,
    sr: process.env.SUPABASE_SERVICE_ROLE_KEY,
    re: process.env.RESEND_API_KEY,
  };
  process.env.SUPABASE_URL = 'https://xyzcompany.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-for-unit-test';
  process.env.RESEND_API_KEY = 're_test_key';
  delete require.cache[require.resolve('../server.js')];
  const appEmail = require('../server.js');
  try {
    const res = await request(appEmail).post('/api/email/send').send({
      orgId: '00000000-0000-0000-0000-000000000001',
      to: ['a@b.com'],
      subject: 's',
      text: 't',
    });
    assert.equal(res.status, 401);
  } finally {
    if (prev.url !== undefined) process.env.SUPABASE_URL = prev.url;
    else delete process.env.SUPABASE_URL;
    if (prev.sr !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = prev.sr;
    else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (prev.re !== undefined) process.env.RESEND_API_KEY = prev.re;
    else delete process.env.RESEND_API_KEY;
    delete require.cache[require.resolve('../server.js')];
  }
});

test('POST /api/stripe/create-checkout-session returns 503 when Stripe is not configured', async () => {
  const prev = {
    url: process.env.SUPABASE_URL,
    sr: process.env.SUPABASE_SERVICE_ROLE_KEY,
    sk: process.env.STRIPE_SECRET_KEY,
  };
  process.env.SUPABASE_URL = 'https://xyzcompany.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-for-unit-test';
  delete process.env.STRIPE_SECRET_KEY;
  delete require.cache[require.resolve('../server.js')];
  const appStripe = require('../server.js');
  try {
    const res = await request(appStripe)
      .post('/api/stripe/create-checkout-session')
      .set('Authorization', 'Bearer x')
      .send({
        orgId: '00000000-0000-0000-0000-000000000001',
        plan: 'starter',
      });
    assert.equal(res.status, 503);
    assert.match(String(res.body.error || ''), /Stripe/i);
  } finally {
    if (prev.url !== undefined) process.env.SUPABASE_URL = prev.url;
    else delete process.env.SUPABASE_URL;
    if (prev.sr !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = prev.sr;
    else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (prev.sk !== undefined) process.env.STRIPE_SECRET_KEY = prev.sk;
    else delete process.env.STRIPE_SECRET_KEY;
    delete require.cache[require.resolve('../server.js')];
  }
});

test('POST /api/stripe/create-checkout-session returns 401 without bearer token', async () => {
  const prev = {
    url: process.env.SUPABASE_URL,
    sr: process.env.SUPABASE_SERVICE_ROLE_KEY,
    sk: process.env.STRIPE_SECRET_KEY,
  };
  process.env.SUPABASE_URL = 'https://xyzcompany.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-for-unit-test';
  process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  delete require.cache[require.resolve('../server.js')];
  const appStripe = require('../server.js');
  try {
    const res = await request(appStripe)
      .post('/api/stripe/create-checkout-session')
      .send({
        orgId: '00000000-0000-0000-0000-000000000001',
        plan: 'starter',
      });
    assert.equal(res.status, 401);
  } finally {
    if (prev.url !== undefined) process.env.SUPABASE_URL = prev.url;
    else delete process.env.SUPABASE_URL;
    if (prev.sr !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = prev.sr;
    else delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (prev.sk !== undefined) process.env.STRIPE_SECRET_KEY = prev.sk;
    else delete process.env.STRIPE_SECRET_KEY;
    delete require.cache[require.resolve('../server.js')];
  }
});
