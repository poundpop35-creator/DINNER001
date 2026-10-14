-- Schema reference for the NEW, separate RU Study Planner Supabase project.
-- Not applied to the registration project's database.
-- Apply as one migration through Supabase after its project ID is confirmed.
begin;
create table public.ru_study_terms (
 id integer primary key check (id >= 0), name text not null, label text not null,
 cap integer not null check (cap > 0)
);
create table public.ru_study_courses (
 id text primary key check (id ~ '^POL[0-9]{4}$'), title text not null,
 category text not null check (category in ('core','required','elective','faculty')),
 load text not null check (load in ('หนัก','กลาง','เบากว่า')),
 term integer not null references public.ru_study_terms(id),
 exam date, slot text check (slot in ('A','B')), reason text not null,
 credits integer not null check (credits > 0), enrolled boolean not null default false,
 position integer not null unique,
 check ((exam is null and slot is null) or (exam is not null and slot is not null))
);
create index ru_study_courses_term_idx on public.ru_study_courses(term);
create table public.ru_study_lessons (
 id text primary key, course text not null references public.ru_study_courses(id),
 n integer not null check (n > 0), title text not null,
 content jsonb not null check (jsonb_typeof(content) = 'object'),
 unique(course,n), check (id = course || '-' || n::text)
);
create table public.ru_study_exam_guides (
 course text primary key references public.ru_study_courses(id),
 content jsonb not null check (jsonb_typeof(content) = 'object')
);
create table public.ru_study_class_schedules (
 id text primary key, course text not null references public.ru_study_courses(id),
 term text not null, weekday integer not null check (weekday between 0 and 6),
 start_time time not null, end_time time not null, room text not null,
 source text not null, page integer not null check (page > 0),
 check (start_time < end_time)
);
create index ru_study_class_schedules_course_idx on public.ru_study_class_schedules(course);
create table public.ru_study_settings (
 key text primary key check (key in ('config','counts','updated')),
 value jsonb not null
);

-- Only public educational content is stored in these tables.
-- Notes, answers, grades and reading progress are not uploaded or exposed.
alter table public.ru_study_terms enable row level security;
alter table public.ru_study_courses enable row level security;
alter table public.ru_study_lessons enable row level security;
alter table public.ru_study_exam_guides enable row level security;
alter table public.ru_study_class_schedules enable row level security;
alter table public.ru_study_settings enable row level security;
revoke all on public.ru_study_terms, public.ru_study_courses, public.ru_study_lessons,
 public.ru_study_exam_guides, public.ru_study_class_schedules, public.ru_study_settings from anon, authenticated;
grant select on public.ru_study_terms, public.ru_study_courses, public.ru_study_lessons,
 public.ru_study_exam_guides, public.ru_study_class_schedules, public.ru_study_settings to anon, authenticated;
create policy read_published_content on public.ru_study_terms for select to anon,authenticated using (true);
create policy read_published_content on public.ru_study_courses for select to anon,authenticated using (true);
create policy read_published_content on public.ru_study_lessons for select to anon,authenticated using (true);
create policy read_published_content on public.ru_study_exam_guides for select to anon,authenticated using (true);
create policy read_published_content on public.ru_study_class_schedules for select to anon,authenticated using (true);
create policy read_published_content on public.ru_study_settings for select to anon,authenticated using (true);

-- One snapshot avoids mixing half-updated tables across multiple HTTP requests.
-- SECURITY INVOKER keeps table grants and RLS in force.
create function public.ru_study_catalog() returns jsonb
language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object(
  'version',1,
  'updated',(select value from public.ru_study_settings where key='updated'),
  'counts',(select value from public.ru_study_settings where key='counts'),
  'config',(select value from public.ru_study_settings where key='config'),
  'terms',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.ru_study_terms t),'[]'::jsonb),
  'courses',coalesce((select jsonb_agg(to_jsonb(c)-'position' order by c.position) from public.ru_study_courses c),'[]'::jsonb),
  'lessons',coalesce((select jsonb_agg(l.content || jsonb_build_object('id',l.id,'course',l.course,'n',l.n,'title',l.title) order by c.position,l.n) from public.ru_study_lessons l join public.ru_study_courses c on c.id=l.course),'[]'::jsonb),
  'prep',coalesce((select jsonb_object_agg(g.course,g.content) from public.ru_study_exam_guides g),'{}'::jsonb),
  'schedules',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'course',s.course,'term',s.term,'weekday',s.weekday,'startTime',to_char(s.start_time,'HH24:MI'),'endTime',to_char(s.end_time,'HH24:MI'),'room',s.room,'source',s.source,'page',s.page) order by s.course) from public.ru_study_class_schedules s),'[]'::jsonb)
 );
$$;
revoke all on function public.ru_study_catalog() from public;
grant execute on function public.ru_study_catalog() to anon, authenticated;
comment on function public.ru_study_catalog() is 'Public curriculum snapshot only; no personal learning records. Read-only SECURITY INVOKER.';
commit;
