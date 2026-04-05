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
