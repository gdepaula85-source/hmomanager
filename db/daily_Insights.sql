create table public.daily_insights (
  id uuid not null default extensions.uuid_generate_v4 (),
  score integer null,
  score_label text null,
  score_color text null,
  summary text null,
  insights jsonb null,
  tasks jsonb null,
  created_at timestamp with time zone null default now(),
  constraint daily_insights_pkey primary key (id)
) TABLESPACE pg_default;