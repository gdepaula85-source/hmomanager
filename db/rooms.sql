create table public.rooms (
  id uuid not null default extensions.uuid_generate_v4 (),
  property_id uuid not null,
  room_number integer not null,
  type text null default 'Single'::text,
  price numeric(10, 2) null default 0,
  status text null default 'vacant'::text,
  created_at timestamp with time zone null default now(),
  constraint rooms_pkey primary key (id),
  constraint rooms_property_id_room_number_key unique (property_id, room_number),
  constraint rooms_property_id_fkey foreign KEY (property_id) references properties (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_rooms_property on public.rooms using btree (property_id) TABLESPACE pg_default;