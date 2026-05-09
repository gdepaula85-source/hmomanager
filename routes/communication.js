module.exports = function registerCommunicationRoutes(ctx) {
  const {
    app, supabaseAdmin, emailLimiter, isUuidString, renderTextTemplate, renderHtmlTemplate,
    buildEmailHtmlFromPublicTemplate, logEmail,
  } = ctx;

function _commBuildTenantVars(tenantRow, orgRow, landlordEmailFallback) {
  const t = tenantRow || {};
  const o = orgRow || {};
  const symbol = String(o.currency_symbol || '£');
  const rentNum = Number(t.rent || 0);
  const rentFormatted = isFinite(rentNum) && rentNum > 0
    ? rentNum.toLocaleString('en-GB', { maximumFractionDigits: 2 })
    : '';
  const arrearsNum = Number(t.arrears || 0);
  const arrearsFormatted = isFinite(arrearsNum) && arrearsNum !== 0
    ? arrearsNum.toLocaleString('en-GB', { maximumFractionDigits: 2 })
    : '0';
  const propertyName = t.property_name || t.property || '';
  const moveIn = t.move_in || t.start_date || '';
  const moveOut = t.move_out_date || '';
  const payDay = t.freq === 'monthly' && t.pay_day_of_month
    ? String(t.pay_day_of_month) + (t.pay_day_of_month === 1 ? 'st' : t.pay_day_of_month === 2 ? 'nd' : t.pay_day_of_month === 3 ? 'rd' : 'th') + ' of the month'
    : (t.pay_day || '');
  return {
    tenant_name: t.name || '',
    property_name: propertyName,
    room_number: t.room_number != null ? String(t.room_number) : (t.room || ''),
    rent_amount: rentFormatted,
    currency_symbol: symbol,
    pay_day: payDay,
    move_in: moveIn,
    move_out_date: moveOut,
    arrears: arrearsFormatted,
    landlord_name: o.name || '',
    landlord_email: o.billing_email || o.owner_email || landlordEmailFallback || '',
    org_name: o.name || '',
    if_arrears: arrearsNum > 0,
    if_pending: t.status === 'pending_review',
  };
}

function _commRenderForChannel(template, vars, channel) {
  const subject = renderTextTemplate(template.subject || '', vars);
  const text = renderTextTemplate(template.body_text || '', vars);
  if (channel === 'whatsapp') return { text };
  let html;
  if (template.body_html) {
    html = renderHtmlTemplate(template.body_html, vars);
  } else {
    const wrap = buildEmailHtmlFromPublicTemplate(template.name || 'LandlordApp', subject || template.name || 'LandlordApp')
      || null;
    if (wrap) {
      html = wrap.replace('</body>',
        '<div style="padding:24px 28px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;font-size:14px;line-height:1.55;color:#0f172a;white-space:pre-wrap">'
        + text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        + '</div></body>');
    } else {
      html = '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;font-size:14px;line-height:1.55;color:#0f172a;max-width:600px;margin:0 auto;padding:24px;white-space:pre-wrap">'
        + text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        + '</div>';
    }
  }
  return { subject, text, html };
}

async function _commAuthAndAuthz(req, res, opts) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) { res.status(401).json({ error: 'Authentication required' }); return null; }
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) { res.status(401).json({ error: 'Invalid session' }); return null; }
  const orgId = (opts && opts.orgId) || '';
  if (!orgId || !isUuidString(orgId)) { res.status(400).json({ error: 'orgId required' }); return null; }
  const { data: mem } = await supabaseAdmin.from('org_members').select('id,role').eq('org_id', orgId).eq('user_id', userData.user.id).maybeSingle();
  if (!mem) { res.status(403).json({ error: 'Not a member of this organisation' }); return null; }
  if (opts && opts.requireWrite) {
    const role = String(mem.role || '').toLowerCase();
    if (!['admin','manager','owner'].includes(role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return null;
    }
  }
  return { user: userData.user, role: mem.role };
}

// 1. List templates
app.get('/api/comm/templates', async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Service unavailable' });
  const orgId = req.query.orgId;
  const ctx = await _commAuthAndAuthz(req, res, { orgId });
  if (!ctx) return;
  let q = supabaseAdmin.from('communication_templates').select('*').eq('org_id', orgId).eq('is_archived', false);
  if (req.query.language) q = q.eq('language', req.query.language);
  const { data, error } = await q.order('is_builtin', { ascending: false }).order('name', { ascending: true });
  if (error) {
    // Table not yet created (run db/communication_templates.sql migration) — return empty list
    // with a flag so the frontend can show a helpful setup message instead of a hard error.
    const missingTable = error.code === '42P01' || /does not exist/i.test(error.message || '');
    if (missingTable) return res.status(200).json({ templates: [], _setup_required: true });
    return res.status(500).json({ error: error.message });
  }
  return res.status(200).json({ templates: data || [] });
});

// 2. Create custom template
app.post('/api/comm/templates', async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Service unavailable' });
  const body = req.body || {};
  const ctx = await _commAuthAndAuthz(req, res, { orgId: body.orgId, requireWrite: true });
  if (!ctx) return;
  const { name, language, channel, subject, body_text, body_html } = body;
  if (!name || !body_text) return res.status(400).json({ error: 'name and body_text required' });
  if (channel && !['email','whatsapp','both'].includes(channel)) return res.status(400).json({ error: 'invalid channel' });
  const slug = 'custom_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const { data, error } = await supabaseAdmin.from('communication_templates').insert({
    org_id: body.orgId,
    slug,
    name,
    language: language || 'en',
    channel: channel || 'both',
    subject: subject || null,
    body_text,
    body_html: body_html || null,
    is_builtin: false,
    created_by: ctx.user.id,
  }).select('*').maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ template: data });
});

// 3. Update template (built-ins editable in content, but slug/is_builtin locked)
app.put('/api/comm/templates/:id', async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Service unavailable' });
  const id = req.params.id;
  const body = req.body || {};
  const ctx = await _commAuthAndAuthz(req, res, { orgId: body.orgId, requireWrite: true });
  if (!ctx) return;
  const { data: existing } = await supabaseAdmin.from('communication_templates').select('id,org_id').eq('id', id).maybeSingle();
  if (!existing || existing.org_id !== body.orgId) return res.status(404).json({ error: 'Template not found' });
  const patch = {};
  ['name','language','channel','subject','body_text','body_html'].forEach((k) => {
    if (body[k] !== undefined) patch[k] = body[k];
  });
  if (patch.channel && !['email','whatsapp','both'].includes(patch.channel)) return res.status(400).json({ error: 'invalid channel' });
  const { data, error } = await supabaseAdmin.from('communication_templates').update(patch).eq('id', id).select('*').maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ template: data });
});

// 4. Duplicate
app.post('/api/comm/templates/:id/duplicate', async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Service unavailable' });
  const id = req.params.id;
  const body = req.body || {};
  const ctx = await _commAuthAndAuthz(req, res, { orgId: body.orgId, requireWrite: true });
  if (!ctx) return;
  const { data: src } = await supabaseAdmin.from('communication_templates').select('*').eq('id', id).maybeSingle();
  if (!src || src.org_id !== body.orgId) return res.status(404).json({ error: 'Template not found' });
  const newSlug = 'custom_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const { data, error } = await supabaseAdmin.from('communication_templates').insert({
    org_id: src.org_id,
    slug: newSlug,
    name: src.name + ' (copy)',
    language: src.language,
    channel: src.channel,
    subject: src.subject,
    body_text: src.body_text,
    body_html: src.body_html,
    is_builtin: false,
    created_by: ctx.user.id,
  }).select('*').maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ template: data });
});

// 5. Soft-delete (archive). Built-ins refused.
app.delete('/api/comm/templates/:id', async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Service unavailable' });
  const id = req.params.id;
  const orgId = req.query.orgId;
  const ctx = await _commAuthAndAuthz(req, res, { orgId, requireWrite: true });
  if (!ctx) return;
  const { data: existing } = await supabaseAdmin.from('communication_templates').select('id,org_id,is_builtin').eq('id', id).maybeSingle();
  if (!existing || existing.org_id !== orgId) return res.status(404).json({ error: 'Template not found' });
  if (existing.is_builtin) return res.status(400).json({ error: 'Built-in templates cannot be deleted (you can edit them instead)' });
  const { error } = await supabaseAdmin.from('communication_templates').update({ is_archived: true }).eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
});

// 6. Preview (renders both channels with tenant substitution; no DB writes)
app.post('/api/comm/preview', async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Service unavailable' });
  const body = req.body || {};
  const ctx = await _commAuthAndAuthz(req, res, { orgId: body.orgId });
  if (!ctx) return;
  const { templateId, tenantId } = body;
  if (!templateId || !tenantId) return res.status(400).json({ error: 'templateId and tenantId required' });
  const [{ data: template }, { data: tenant }, { data: org }] = await Promise.all([
    supabaseAdmin.from('communication_templates').select('*').eq('id', templateId).maybeSingle(),
    supabaseAdmin.from('tenants').select('*').eq('id', tenantId).maybeSingle(),
    supabaseAdmin.from('organisations').select('id,name,billing_email,owner_email,currency_symbol,language').eq('id', body.orgId).maybeSingle(),
  ]);
  if (!template || template.org_id !== body.orgId) return res.status(404).json({ error: 'Template not found' });
  if (!tenant || tenant.org_id !== body.orgId) return res.status(404).json({ error: 'Tenant not found' });
  const vars = _commBuildTenantVars(tenant, org);
  const email = _commRenderForChannel(template, vars, 'email');
  const whatsapp = _commRenderForChannel(template, vars, 'whatsapp');
  return res.status(200).json({
    email,
    whatsapp,
    vars,
    tenant: { id: tenant.id, name: tenant.name, email: tenant.email, whatsapp: tenant.whatsapp },
  });
});

// 7. Send email via the Communication Hub (uses Resend; logs to email_log).
app.post('/api/comm/send-email', emailLimiter, async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Service unavailable' });
  if (!process.env.RESEND_API_KEY) return res.status(503).json({ error: 'Email not configured' });
  const body = req.body || {};
  const ctx = await _commAuthAndAuthz(req, res, { orgId: body.orgId, requireWrite: true });
  if (!ctx) return;
  const { templateId, tenantId } = body;
  if (!templateId || !tenantId) return res.status(400).json({ error: 'templateId and tenantId required' });
  const [{ data: template }, { data: tenant }, { data: org }] = await Promise.all([
    supabaseAdmin.from('communication_templates').select('*').eq('id', templateId).maybeSingle(),
    supabaseAdmin.from('tenants').select('*').eq('id', tenantId).maybeSingle(),
    supabaseAdmin.from('organisations').select('id,name,billing_email,owner_email,currency_symbol,language').eq('id', body.orgId).maybeSingle(),
  ]);
  if (!template || template.org_id !== body.orgId) return res.status(404).json({ error: 'Template not found' });
  if (!tenant || tenant.org_id !== body.orgId) return res.status(404).json({ error: 'Tenant not found' });
  const recipient = (body.to && String(body.to).includes('@')) ? String(body.to) : String(tenant.email || '');
  if (!recipient.includes('@')) return res.status(400).json({ error: 'Tenant has no email on file' });
  const vars = _commBuildTenantVars(tenant, org);
  const { subject, text, html } = _commRenderForChannel(template, vars, 'email');
  const finalSubject = subject || ('Message from ' + (org?.name || 'LandlordApp'));
  const mailFrom = process.env.MAIL_FROM || 'landlordapp.io <noreply@landlordapp.io>';
  const trackedTemplateId = 'comm_' + (template.slug || 'unknown');
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: mailFrom,
        to: [recipient],
        subject: finalSubject,
        html,
        text,
        reply_to: org?.billing_email || org?.owner_email || undefined,
      })
    });
    const ok = r.ok;
    await logEmail(body.orgId, tenantId, recipient, trackedTemplateId, finalSubject, ok ? 'sent' : 'failed', { template_name: template.name, language: template.language });
    if (!ok) {
      let errBody = '';
      try { errBody = await r.text(); } catch (_) {}
      return res.status(502).json({ error: 'Resend rejected the request', detail: errBody.slice(0, 400) });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    await logEmail(body.orgId, tenantId, recipient, trackedTemplateId, finalSubject, 'failed', { error: e.message });
    return res.status(502).json({ error: 'Email send failed' });
  }
});

// 8. Log a WhatsApp click-to-chat intent (called by frontend right before wa.me opens)
app.post('/api/comm/log-whatsapp', async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Service unavailable' });
  const body = req.body || {};
  const ctx = await _commAuthAndAuthz(req, res, { orgId: body.orgId, requireWrite: true });
  if (!ctx) return;
  const { tenantId, templateId, recipient_handle, subject, preview } = body;
  const { error } = await supabaseAdmin.from('comm_log').insert({
    org_id: body.orgId,
    tenant_id: tenantId || null,
    template_id: templateId || null,
    channel: 'whatsapp',
    recipient_handle: recipient_handle || null,
    subject: subject || null,
    preview: (preview || '').slice(0, 240),
    metadata: body.metadata || {},
    created_by: ctx.user.id,
  });
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
});

// 9. Merged history log (email_log comm rows + comm_log)
app.get('/api/comm/log', async (req, res) => {
  if (!supabaseAdmin) return res.status(503).json({ error: 'Service unavailable' });
  const orgId = req.query.orgId;
  const ctx = await _commAuthAndAuthz(req, res, { orgId });
  if (!ctx) return;
  const tenantId = req.query.tenantId || null;
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
  const eq = (qb) => tenantId ? qb.eq('tenant_id', tenantId) : qb;

  const [emailRes, commRes] = await Promise.all([
    eq(supabaseAdmin.from('email_log').select('id,org_id,tenant_id,recipient_email,template_id,subject,status,metadata,created_at')
      .eq('org_id', orgId)
      .like('template_id', 'comm_%')
      .order('created_at', { ascending: false })
      .limit(limit)),
    eq(supabaseAdmin.from('comm_log').select('id,org_id,tenant_id,template_id,channel,recipient_handle,subject,preview,metadata,created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit)),
  ]);

  const emails = (emailRes.data || []).map((r) => ({
    id: r.id,
    channel: 'email',
    tenant_id: r.tenant_id,
    recipient: r.recipient_email,
    template_id: r.template_id,
    template_name: (r.metadata && r.metadata.template_name) || r.template_id,
    subject: r.subject || '',
    preview: '',
    status: r.status,
    created_at: r.created_at,
  }));
  const wa = (commRes.data || []).map((r) => ({
    id: r.id,
    channel: r.channel,
    tenant_id: r.tenant_id,
    recipient: r.recipient_handle || '',
    template_id: r.template_id,
    template_name: (r.metadata && r.metadata.template_name) || '',
    subject: r.subject || '',
    preview: r.preview || '',
    status: 'opened',
    created_at: r.created_at,
  }));
  const merged = emails.concat(wa).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, limit);
  return res.status(200).json({ entries: merged });
});

};
