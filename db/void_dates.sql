create table public.void_dates (
  id uuid not null default extensions.uuid_generate_v4 (),
  property_id uuid null,
  room_number integer null,
  void_since date null,
  constraint void_dates_pkey primary key (id),
  constraint void_dates_property_id_room_number_key unique (property_id, room_number),
  constraint void_dates_property_id_fkey foreign KEY (property_id) references properties (id) on delete CASCADE
) TABLESPACE pg_default;