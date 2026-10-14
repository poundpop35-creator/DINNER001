-- Runs against the study project only. Every synthetic user and row rolls back.
begin;
select set_config('test.owner',gen_random_uuid()::text,true),set_config('test.other',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('test.owner')::uuid),(current_setting('test.other')::uuid);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true);
select public.ru_study_save_workspace(0,'{"version":1,"test":true}'::jsonb);
do $$ begin
 if (select count(*) from public.ru_study_workspaces) <> 1 then raise exception 'Owner cannot read own workspace'; end if;
 begin perform public.ru_study_save_workspace(0,'{}'::jsonb); raise exception 'Revision conflict was not rejected'; exception when serialization_failure then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.other'),true);
do $$ begin
 if (select count(*) from public.ru_study_workspaces) <> 0 then raise exception 'Cross-user read leak'; end if;
 begin insert into public.ru_study_workspaces(user_id,payload) values(current_setting('test.owner')::uuid,'{}'::jsonb); raise exception 'Cross-user write allowed'; exception when insufficient_privilege then null; end;
 begin insert into storage.objects(bucket_id,name) values('ru-study-notes',current_setting('test.owner')||'/test.png'); raise exception 'Cross-user image write allowed'; exception when insufficient_privilege then null; end;
end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 if jsonb_array_length(public.ru_study_catalog()->'lessons') <> 35 then raise exception 'Public catalog unavailable'; end if;
 begin perform * from public.ru_study_workspaces; raise exception 'Anonymous private read allowed'; exception when insufficient_privilege then null; end;
 begin perform public.ru_study_save_workspace(0,'{}'::jsonb); raise exception 'Anonymous write allowed'; exception when insufficient_privilege then null; end;
 begin update public.ru_study_courses set title='bad' where id='POL1101'; raise exception 'Anonymous content write allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: owner access, cross-user isolation, anonymous denial and revision conflict; test data rolled back' as result;
rollback;
