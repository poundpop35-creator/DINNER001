-- Personal workspaces are accessible only to their authenticated owner.
begin;
create table public.ru_study_workspaces (
 user_id uuid primary key references auth.users(id) on delete cascade,
 payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 4194304),
 revision bigint not null default 1 check (revision > 0),
 updated_at timestamptz not null default now()
);
alter table public.ru_study_workspaces enable row level security;
revoke all on public.ru_study_workspaces from public, anon, authenticated;
grant select, insert, update on public.ru_study_workspaces to authenticated;
create policy own_workspace_read on public.ru_study_workspaces for select to authenticated using ((select auth.uid()) = user_id);
create policy own_workspace_insert on public.ru_study_workspaces for insert to authenticated with check ((select auth.uid()) = user_id);
create policy own_workspace_update on public.ru_study_workspaces for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Optimistic revision check: two devices cannot silently replace each other's changes.
create function public.ru_study_save_workspace(expected_revision bigint, new_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result public.ru_study_workspaces;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if expected_revision < 0 or jsonb_typeof(new_payload) <> 'object' or octet_length(new_payload::text) > 4194304 then
  raise exception 'Invalid workspace' using errcode='22023';
 end if;
 if expected_revision = 0 then
  insert into public.ru_study_workspaces(user_id,payload) values(auth.uid(),new_payload)
  on conflict(user_id) do nothing returning * into result;
 else
  update public.ru_study_workspaces set payload=new_payload,revision=revision+1,updated_at=now()
  where user_id=auth.uid() and revision=expected_revision returning * into result;
 end if;
 if result.user_id is null then raise exception 'Workspace changed on another device' using errcode='40001'; end if;
 return jsonb_build_object('revision',result.revision,'updated_at',result.updated_at);
end;
$$;
revoke all on function public.ru_study_save_workspace(bigint,jsonb) from public,anon;
grant execute on function public.ru_study_save_workspace(bigint,jsonb) to authenticated;

-- Images are private. App uses authenticated download, never a permanent public URL.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ru-study-notes','ru-study-notes',false,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do nothing;
create policy own_note_images_read on storage.objects for select to authenticated
using(bucket_id='ru-study-notes' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy own_note_images_insert on storage.objects for insert to authenticated
with check(bucket_id='ru-study-notes' and (storage.foldername(name))[1]=(select auth.uid())::text);
-- Immutable image IDs avoid overwriting images referenced by another saved note.
commit;
