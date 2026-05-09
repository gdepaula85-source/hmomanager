-- ────────────────────────────────────────────────────────────────────────────
-- communication_templates_seed.sql
-- Seeds the four built-in message templates (check-in, check-out, house rules,
-- payment reminder) in English + Brazilian Portuguese for every existing org,
-- and installs a trigger so future orgs are seeded automatically.
-- Idempotent — safe to re-run.
--
-- Run AFTER communication_templates.sql.
-- Run on both TEST and PROD Supabase projects.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION _seed_builtin_communication_templates(_org_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- ── EN ────────────────────────────────────────────────────────────────────
  INSERT INTO communication_templates (org_id, slug, name, language, channel, subject, body_text, is_builtin)
  VALUES
  (_org_id, 'check_in', 'Check-In Welcome', 'en', 'both',
    'Welcome to {{property_name}}',
    E'Hi {{tenant_name}},\n\nWelcome to {{property_name}}! Your check-in is scheduled for {{move_in}} in Room {{room_number}}.\n\nYour rent is {{currency_symbol}}{{rent_amount}}, due each {{pay_day}}.\n\nIf you have any questions, just reply to this message.\n\n— {{landlord_name}}',
    TRUE),
  (_org_id, 'check_out', 'Check-Out Reminder', 'en', 'both',
    'Check-out details — {{property_name}}',
    E'Hi {{tenant_name}},\n\nThis is a reminder that your tenancy at {{property_name}} (Room {{room_number}}) ends on {{move_out_date}}.\n\nPlease ensure the room is clean, all keys are returned, and any outstanding balance is settled.\n\nIf you need anything in the meantime, get in touch.\n\n— {{landlord_name}}',
    TRUE),
  (_org_id, 'house_rules', 'House Rules', 'en', 'both',
    'House rules — {{property_name}}',
    E'Hi {{tenant_name}},\n\nA quick reminder of the house rules at {{property_name}}:\n\n• Quiet hours: 22:00 — 07:00\n• No smoking inside the property\n• Keep shared spaces (kitchen, bathroom, hallway) clean\n• No overnight guests without prior agreement\n• Report any maintenance issues straight away\n\nThanks for helping keep things friendly.\n\n— {{landlord_name}}',
    TRUE),
  (_org_id, 'payment_reminder', 'Payment Reminder', 'en', 'both',
    'Rent reminder — {{property_name}}',
    E'Hi {{tenant_name}},\n\nA quick reminder that your rent of {{currency_symbol}}{{rent_amount}} is due on {{pay_day}}.\n\nCurrent balance: {{currency_symbol}}{{arrears}}\n\nIf you have already paid, please ignore this message. Otherwise, please get in touch if anything needs sorting.\n\n— {{landlord_name}}',
    TRUE)
  ON CONFLICT (org_id, slug, language) DO NOTHING;

  -- ── PT-BR ─────────────────────────────────────────────────────────────────
  INSERT INTO communication_templates (org_id, slug, name, language, channel, subject, body_text, is_builtin)
  VALUES
  (_org_id, 'check_in', 'Boas-vindas (entrada)', 'pt-BR', 'both',
    'Bem-vindo(a) a {{property_name}}',
    E'Olá {{tenant_name}},\n\nSeja bem-vindo(a) a {{property_name}}! Sua entrada está marcada para {{move_in}}, no quarto {{room_number}}.\n\nO valor do aluguel é {{currency_symbol}}{{rent_amount}}, com vencimento toda {{pay_day}}.\n\nQualquer dúvida, é só responder esta mensagem.\n\n— {{landlord_name}}',
    TRUE),
  (_org_id, 'check_out', 'Lembrete de saída', 'pt-BR', 'both',
    'Detalhes da saída — {{property_name}}',
    E'Olá {{tenant_name}},\n\nEste é um lembrete de que sua locação em {{property_name}} (quarto {{room_number}}) termina em {{move_out_date}}.\n\nPor favor, deixe o quarto limpo, devolva todas as chaves e quite qualquer saldo pendente.\n\nQualquer coisa, me avise.\n\n— {{landlord_name}}',
    TRUE),
  (_org_id, 'house_rules', 'Regras da casa', 'pt-BR', 'both',
    'Regras da casa — {{property_name}}',
    E'Olá {{tenant_name}},\n\nSegue um lembrete rápido das regras da casa em {{property_name}}:\n\n• Silêncio das 22h às 07h\n• Proibido fumar dentro da casa\n• Manter as áreas comuns (cozinha, banheiro, corredor) limpas\n• Visitas para dormir só com aviso prévio\n• Avisar imediatamente sobre qualquer problema de manutenção\n\nObrigado por ajudar a manter o clima tranquilo.\n\n— {{landlord_name}}',
    TRUE),
  (_org_id, 'payment_reminder', 'Lembrete de pagamento', 'pt-BR', 'both',
    'Lembrete de aluguel — {{property_name}}',
    E'Olá {{tenant_name}},\n\nLembrete rápido: o aluguel de {{currency_symbol}}{{rent_amount}} vence na {{pay_day}}.\n\nSaldo atual: {{currency_symbol}}{{arrears}}\n\nSe já efetuou o pagamento, por favor desconsidere. Caso contrário, qualquer coisa é só me chamar.\n\n— {{landlord_name}}',
    TRUE)
  ON CONFLICT (org_id, slug, language) DO NOTHING;
END;
$$;

-- Seed every existing org (idempotent)
DO $$
DECLARE _org RECORD;
BEGIN
  FOR _org IN SELECT id FROM organisations LOOP
    PERFORM _seed_builtin_communication_templates(_org.id);
  END LOOP;
END;
$$;

-- Auto-seed on new org creation
CREATE OR REPLACE FUNCTION _seed_builtin_communication_templates_trg()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM _seed_builtin_communication_templates(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_builtin_comm_templates ON organisations;
CREATE TRIGGER trg_seed_builtin_comm_templates
AFTER INSERT ON organisations
FOR EACH ROW EXECUTE FUNCTION _seed_builtin_communication_templates_trg();

NOTIFY pgrst, 'reload schema';
