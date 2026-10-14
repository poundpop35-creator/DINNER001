-- A private link identifies a study space without a login form.
-- Only the Edge Function's server role can access this table.
create table if not exists public.ru_study_personal_spaces (
  id uuid primary key default gen_random_uuid(),
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb,
  revision integer not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  check (payload is null or (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 4194304))
);
alter table public.ru_study_personal_spaces enable row level security;
revoke all on public.ru_study_personal_spaces from public, anon, authenticated;
grant select, insert, update, delete on public.ru_study_personal_spaces to service_role;
create policy personal_space_server_only on public.ru_study_personal_spaces
  for all to service_role using (true) with check (true);
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('ru-study-personal-notes','ru-study-personal-notes',false,5242880,
  array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do nothing;
