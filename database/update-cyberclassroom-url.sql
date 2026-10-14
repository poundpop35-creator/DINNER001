-- University directory https://www.ru.ac.th/th/study_online links to HTTP.
-- Update only the public livestream reference; personal workspaces are untouched.
update public.ru_study_settings as settings
set value = jsonb_set(settings.value, '{sources}', (
  select jsonb_agg(
    case when source->>'id' = 'live'
      then jsonb_set(source, '{url}', to_jsonb('http://cyberclassroom.ru.ac.th/'::text))
      else source end order by ordinal
  )
  from jsonb_array_elements(settings.value->'sources') with ordinality as entry(source, ordinal)
))
where settings.key = 'config'
  and exists (
    select 1 from jsonb_array_elements(settings.value->'sources') as source
    where source->>'id' = 'live' and source->>'url' = 'https://cyberclassroom.ru.ac.th/'
  );
